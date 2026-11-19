-- W3: pickup code hardening (security review U3 M2), structured reserve
-- results, and the pharmacist's incoming-reservations read.

-- 1. Wrong pickup codes are counted per reservation; 5 wrong tries lock it.
alter table public.reservations
  add column failed_code_attempts smallint not null default 0
  check (failed_code_attempts >= 0);

-- 2. reserve: the pickup code comes from pgcrypto, and a basket that cannot be
-- held returns which item failed (by id) instead of raising. Nothing is held
-- on any of these returns; releasing lapsed holds (D10) still commits.
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

-- 3. Collection with a lockout. It returns a status instead of raising so a
-- wrong code's counter is kept. Another shop's or an unknown reservation gets
-- the same answer as a wrong code. Replaces collect_reservation (revoked
-- below, not dropped).
create function private.collect_pickup(p_reservation_id uuid,p_pickup_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_shop uuid;
  v_res public.reservations%rowtype; v_tries smallint; v_expired_name text;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=v_user and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  perform private.expire_shop(v_shop);
  select * into v_res from public.reservations
    where id=p_reservation_id and pharmacy_id=v_shop for update;
  if not found then return jsonb_build_object('status','no_match'); end if;
  if v_res.status <> 'active' then return jsonb_build_object('status','not_active'); end if;
  if v_res.failed_code_attempts >= 5 then return jsonb_build_object('status','locked'); end if;
  if p_pickup_code is null or p_pickup_code !~ '^[0-9]{6}$' or
     p_pickup_code <> v_res.pickup_code then
    update public.reservations set failed_code_attempts=failed_code_attempts+1
      where id=p_reservation_id returning failed_code_attempts into v_tries;
    return jsonb_build_object('status',
      case when v_tries >= 5 then 'locked' else 'no_match' end);
  end if;
  select m.brand_name || ' ' || m.strength into v_expired_name
    from public.reservation_items i
    join public.pharmacy_stock s on s.pharmacy_id=v_shop and s.medicine_id=i.medicine_id
    join public.medicines m on m.id=i.medicine_id
    where i.reservation_id=p_reservation_id
      and s.expiry_date < (now() at time zone 'Asia/Dhaka')::date
    order by i.medicine_id limit 1;
  if found then
    return jsonb_build_object('status','expired_item','name',v_expired_name);
  end if;
  update public.pharmacy_stock s set quantity=s.quantity-i.quantity,
    held_quantity=s.held_quantity-i.quantity,updated_at=now()
    from public.reservation_items i
    where i.reservation_id=p_reservation_id and s.pharmacy_id=v_shop
      and s.medicine_id=i.medicine_id;
  update public.reservations set status='collected' where id=p_reservation_id;
  return jsonb_build_object('status','collected');
end;
$$;
create function public.collect_pickup(p_reservation_id uuid,p_pickup_code text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.collect_pickup(p_reservation_id,p_pickup_code);
$$;

-- 4. The shop's reservations with customer names (profiles RLS hides other
-- users' rows). Releases lapsed holds first (D10). Never returns pickup codes.
create function private.get_shop_reservations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_result jsonb;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=(select auth.uid()) and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  perform private.expire_shop(v_shop);
  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb)
  into v_result from (
    select r.created_at, jsonb_build_object(
      'id',r.id,'customerName',pr.full_name,'status',r.status,
      'createdAt',r.created_at,
      'expiresAt',case when r.status='active' then r.expires_at end,
      'locked',r.failed_code_attempts >= 5,
      'items',(select coalesce(jsonb_agg(jsonb_build_object(
        'medicineId',m.id,'name',m.brand_name || ' ' || m.strength,
        'form',m.form,'prescriptionOnly',m.prescription_only,
        'quantity',i.quantity,'unitPrice',i.unit_price) order by m.brand_name),
        '[]'::jsonb) from public.reservation_items i
        join public.medicines m on m.id=i.medicine_id
        where i.reservation_id=r.id)) as obj
    from public.reservations r
    join public.profiles pr on pr.id=r.customer_id
    where r.pharmacy_id=v_shop
    order by r.created_at desc limit 100
  ) x;
  return v_result;
end;
$$;
create function public.get_shop_reservations()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_shop_reservations();
$$;

revoke execute on function private.collect_pickup(uuid,text) from public,anon;
revoke execute on function public.collect_pickup(uuid,text) from public,anon;
revoke execute on function private.get_shop_reservations() from public,anon;
revoke execute on function public.get_shop_reservations() from public,anon;
grant execute on function private.collect_pickup(uuid,text) to authenticated;
grant execute on function public.collect_pickup(uuid,text) to authenticated;
grant execute on function private.get_shop_reservations() to authenticated;
grant execute on function public.get_shop_reservations() to authenticated;
revoke execute on function private.collect_reservation(uuid,text) from authenticated;
revoke execute on function public.collect_reservation(uuid,text) from authenticated;

-- 5. Direct table reads no longer return the pickup code, the retry id or the
-- attempt counter. Customers get their code from get_my_reservations.
revoke select on public.reservations from authenticated;
grant select (id,pharmacy_id,customer_id,status,cancellation_reason,
  expires_at,created_at) on public.reservations to authenticated;
