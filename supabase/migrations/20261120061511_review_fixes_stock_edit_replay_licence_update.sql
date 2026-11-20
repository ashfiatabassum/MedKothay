-- W1–W3 review fixes (20 Nov): licence photos referenced by a shop cannot be
-- overwritten; stock edits refuse stale forms; a retried reserve of an ended
-- reservation is not reported as a fresh success. Nothing is dropped.

-- 1. Security review (Medium): UPDATE had no "unreferenced" check, so an owner
-- could overwrite or move an approved licence photo. Same rule as delete.
alter policy licences_owner_update on storage.objects
using (
  bucket_id = 'licences'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'pharmacist')
  and not exists (select 1 from public.pharmacies p
    where p.licence_photo_url = objects.name)
) with check (
  bucket_id = 'licences'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.pharmacies p
    where p.licence_photo_url = objects.name)
);

-- 2. Code review (Medium): save_stock takes the quantity the owner saw. NULL
-- means "add a new row" (refused if it already exists); otherwise the save is
-- refused when the shelf quantity changed since the form was opened (a sale,
-- a collection or another edit), so a stale form cannot undo a sale. Returns a
-- status so the screen can explain; invalid input still raises.
create function private.save_stock(p_medicine_id uuid,p_expected_quantity integer,
  p_quantity integer,p_selling_price numeric,p_expiry_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_row record;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=(select auth.uid()) and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  if p_medicine_id is null or p_quantity is null or p_quantity<0 or
     p_expected_quantity<0 or p_selling_price is null or p_selling_price<=0 or
     p_expiry_date is null then
    raise exception 'Invalid stock details';
  end if;
  -- Takes the shop lock and releases lapsed holds first (D10).
  perform private.expire_shop(v_shop);
  select quantity,held_quantity into v_row from public.pharmacy_stock
    where pharmacy_id=v_shop and medicine_id=p_medicine_id for update;
  if p_expected_quantity is null then
    if found then return jsonb_build_object('status','exists'); end if;
    insert into public.pharmacy_stock(pharmacy_id,medicine_id,quantity,
      held_quantity,selling_price,expiry_date)
      values(v_shop,p_medicine_id,p_quantity,0,p_selling_price,p_expiry_date);
    return jsonb_build_object('status','saved');
  end if;
  if not found then return jsonb_build_object('status','not_stocked'); end if;
  if v_row.quantity <> p_expected_quantity then
    return jsonb_build_object('status','changed','quantity',v_row.quantity);
  end if;
  if p_quantity < v_row.held_quantity then
    return jsonb_build_object('status','below_held','held',v_row.held_quantity);
  end if;
  update public.pharmacy_stock set quantity=p_quantity,
    selling_price=p_selling_price,expiry_date=p_expiry_date,updated_at=now()
    where pharmacy_id=v_shop and medicine_id=p_medicine_id;
  return jsonb_build_object('status','saved');
end;
$$;
create function public.save_stock(p_medicine_id uuid,p_expected_quantity integer,
  p_quantity integer,p_selling_price numeric,p_expiry_date date)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_stock(p_medicine_id,p_expected_quantity,p_quantity,
    p_selling_price,p_expiry_date);
$$;
revoke execute on function private.save_stock(uuid,integer,integer,numeric,date) from public,anon;
revoke execute on function public.save_stock(uuid,integer,integer,numeric,date) from public,anon;
grant execute on function private.save_stock(uuid,integer,integer,numeric,date) to authenticated;
grant execute on function public.save_stock(uuid,integer,integer,numeric,date) to authenticated;

-- 3. Code review (Medium): replaying a request id returns the reservation
-- only while it is still active; otherwise 'ended' (D14 stays idempotent: no
-- second hold is ever created for the same id). Rest unchanged from W3.
create or replace function private.reserve(
  p_pharmacy_id uuid,p_items jsonb,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_role text;
  v_existing public.reservations%rowtype;
  v_shop uuid;
  v_item record;
  v_stock record;
  v_seen uuid[] := '{}';
  v_prices jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_changed boolean := false;
  v_id uuid;
  v_bytes bytea;
  v_code text;
  v_expires timestamptz;
begin
  if v_user is null then raise exception 'Sign in first'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role is distinct from 'customer' then raise exception 'Customer account required'; end if;
  if p_pharmacy_id is null or p_request_id is null or
     jsonb_typeof(p_items) is distinct from 'array' or
     jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Invalid reservation basket';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('customer:' || v_user::text,0));
  select * into v_existing from public.reservations
    where customer_id=v_user and client_request_id=p_request_id;
  if found then
    if v_existing.status <> 'active' or v_existing.expires_at <= now() then
      return jsonb_build_object('status','ended','reservationId',v_existing.id);
    end if;
    return jsonb_build_object('status','reserved','reservationId',v_existing.id,
      'pickupCode',v_existing.pickup_code,'expiresAt',v_existing.expires_at,
      'alreadyCreated',true);
  end if;
  for v_shop in select distinct x.pharmacy_id from (
    select p_pharmacy_id as pharmacy_id
    union all
    select pharmacy_id from public.reservations
      where customer_id=v_user and status='active'
  ) x order by x.pharmacy_id loop
    perform private.expire_shop(v_shop);
  end loop;
  if (select count(*) from public.reservations
      where customer_id=v_user and status='active') >= 3 then
    return jsonb_build_object('status','limit');
  end if;
  if not exists (select 1 from public.pharmacies where id=p_pharmacy_id
      and status='approved'
      and licence_expiry >= (now() at time zone 'Asia/Dhaka')::date) then
    return jsonb_build_object('status','shop_unavailable');
  end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(
      medicine_id uuid,quantity integer,expected_unit_price numeric)
      order by medicine_id
  loop
    if v_item.medicine_id is null or v_item.quantity not between 1 and 5 or
       v_item.expected_unit_price is null or v_item.expected_unit_price <= 0 or
       v_item.medicine_id = any(v_seen) then
      raise exception 'Invalid reservation item';
    end if;
    v_seen := array_append(v_seen,v_item.medicine_id);
    select s.quantity,s.held_quantity,s.selling_price,s.expiry_date
      into v_stock from public.pharmacy_stock s
      where s.pharmacy_id=p_pharmacy_id and s.medicine_id=v_item.medicine_id
      for update of s;
    if not found then
      return jsonb_build_object('status','unavailable','reason','not_stocked',
        'medicineId',v_item.medicine_id);
    end if;
    if v_stock.expiry_date < (now() at time zone 'Asia/Dhaka')::date then
      return jsonb_build_object('status','unavailable','reason','expired',
        'medicineId',v_item.medicine_id);
    end if;
    if v_stock.quantity-v_stock.held_quantity < v_item.quantity then
      return jsonb_build_object('status','unavailable','reason','short',
        'medicineId',v_item.medicine_id);
    end if;
    if v_stock.selling_price <> v_item.expected_unit_price then
      v_changed := true;
      v_prices := v_prices || jsonb_build_array(jsonb_build_object(
        'medicineId',v_item.medicine_id,'unitPrice',v_stock.selling_price));
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'medicineId',v_item.medicine_id,'quantity',v_item.quantity,
      'unitPrice',v_stock.selling_price));
  end loop;
  if array_length(v_seen,1) <> jsonb_array_length(p_items) then
    raise exception 'Invalid reservation item';
  end if;
  if v_changed then
    return jsonb_build_object('status','price_changed','prices',v_prices);
  end if;
  -- 32 random bits from pgcrypto, reduced to 6 digits.
  v_bytes := extensions.gen_random_bytes(4);
  -- << and | share one precedence level in Postgres, so each shift is bracketed.
  v_code := lpad((((get_byte(v_bytes,0)::bigint << 24) | (get_byte(v_bytes,1) << 16)
    | (get_byte(v_bytes,2) << 8) | get_byte(v_bytes,3)) % 1000000)::text,6,'0');
  v_expires := now()+interval '30 minutes';
  insert into public.reservations(pharmacy_id,customer_id,client_request_id,
    pickup_code,expires_at)
  values(p_pharmacy_id,v_user,p_request_id,v_code,v_expires) returning id into v_id;
  insert into public.reservation_items(reservation_id,medicine_id,quantity,unit_price)
    select v_id,(x.value->>'medicineId')::uuid,(x.value->>'quantity')::integer,
      (x.value->>'unitPrice')::numeric from jsonb_array_elements(v_lines) x;
  update public.pharmacy_stock s set held_quantity=s.held_quantity+i.quantity,
    updated_at=now() from public.reservation_items i
    where i.reservation_id=v_id and s.pharmacy_id=p_pharmacy_id
      and s.medicine_id=i.medicine_id;
  return jsonb_build_object('status','reserved','reservationId',v_id,
    'pickupCode',v_code,'expiresAt',v_expires,'alreadyCreated',false);
end;
$$;
