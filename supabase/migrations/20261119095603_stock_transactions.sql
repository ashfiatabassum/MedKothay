-- All stock operations take a transaction advisory lock for their pharmacy,
-- then lock stock rows in medicine-id order. The advisory lock also makes a
-- reservation created while search expires old holds agree with that search.
create function private.expire_shop(p_pharmacy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('shop:' || p_pharmacy_id::text, 0));
  perform 1 from public.pharmacy_stock
    where pharmacy_id=p_pharmacy_id order by medicine_id for update;
  for v_id in
    select id from public.reservations
    where pharmacy_id=p_pharmacy_id and status='active' and expires_at<=now()
    order by id for update
  loop
    update public.pharmacy_stock s
      set held_quantity=s.held_quantity-i.quantity,updated_at=now()
    from public.reservation_items i
    where i.reservation_id=v_id and s.pharmacy_id=p_pharmacy_id
      and s.medicine_id=i.medicine_id;
    update public.reservations set status='expired' where id=v_id;
  end loop;
end;
$$;
revoke execute on function private.expire_shop(uuid) from public,anon,authenticated;

create function private.reserve(
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
  -- Serializes concurrent attempts by one customer, including the max-three
  -- rule and client request idempotency across all pharmacies.
  perform pg_advisory_xact_lock(hashtextextended('customer:' || v_user::text,0));
  select * into v_existing from public.reservations
    where customer_id=v_user and client_request_id=p_request_id;
  if found then
    return jsonb_build_object('status','reserved','reservationId',v_existing.id,
      'pickupCode',v_existing.pickup_code,'expiresAt',v_existing.expires_at,
      'alreadyCreated',true);
  end if;
  -- Release the caller's expired reservations before counting active holds.
  -- Shop locks are always acquired in UUID order.
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
    raise exception 'You can have at most 3 active reservations';
  end if;
  if not exists (select 1 from public.pharmacies where id=p_pharmacy_id
      and status='approved'
      and licence_expiry >= (now() at time zone 'Asia/Dhaka')::date) then
    raise exception 'This pharmacy is not taking reservations right now';
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
    select s.quantity,s.held_quantity,s.selling_price,s.expiry_date,m.brand_name
      into v_stock from public.pharmacy_stock s
      join public.medicines m on m.id=s.medicine_id
      where s.pharmacy_id=p_pharmacy_id and s.medicine_id=v_item.medicine_id
      for update of s;
    if not found then raise exception 'A medicine is no longer stocked here'; end if;
    if v_stock.expiry_date < (now() at time zone 'Asia/Dhaka')::date then
      raise exception '% has passed its expiry date',v_stock.brand_name;
    end if;
    if v_stock.quantity-v_stock.held_quantity < v_item.quantity then
      raise exception 'There is not enough % in stock',v_stock.brand_name;
    end if;
    if v_stock.selling_price <> v_item.expected_unit_price then
      v_changed := true;
      v_prices := v_prices || jsonb_build_array(jsonb_build_object(
        'medicineId',v_item.medicine_id,'brandName',v_stock.brand_name,
        'unitPrice',v_stock.selling_price));
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
  v_code := lpad(floor(random()*1000000)::integer::text,6,'0');
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

create function private.cancel_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_shop uuid; v_status text;
begin
  if v_user is null or not exists(select 1 from public.profiles
      where id=v_user and role='customer') then
    raise exception 'Customer account required';
  end if;
  select pharmacy_id into v_shop from public.reservations
    where id=p_reservation_id and customer_id=v_user;
  if not found then raise exception 'Reservation not found'; end if;
  perform private.expire_shop(v_shop);
  select status into v_status from public.reservations
    where id=p_reservation_id and customer_id=v_user for update;
  if v_status <> 'active' then raise exception 'Reservation is no longer active'; end if;
  update public.pharmacy_stock s set held_quantity=s.held_quantity-i.quantity,
    updated_at=now() from public.reservation_items i
    where i.reservation_id=p_reservation_id and s.pharmacy_id=v_shop
      and s.medicine_id=i.medicine_id;
  update public.reservations set status='cancelled' where id=p_reservation_id;
end;
$$;

create function private.collect_reservation(p_reservation_id uuid,p_pickup_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_shop uuid; v_res public.reservations%rowtype;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=v_user and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  perform private.expire_shop(v_shop);
  select * into v_res from public.reservations
    where id=p_reservation_id and pharmacy_id=v_shop for update;
  if not found or v_res.status <> 'active' then
    raise exception 'Active reservation not found';
  end if;
  if p_pickup_code is null or p_pickup_code !~ '^[0-9]{6}$' or
     p_pickup_code <> v_res.pickup_code then
    raise exception 'Pickup code does not match';
  end if;
  update public.pharmacy_stock s set quantity=s.quantity-i.quantity,
    held_quantity=s.held_quantity-i.quantity,updated_at=now()
    from public.reservation_items i
    where i.reservation_id=p_reservation_id and s.pharmacy_id=v_shop
      and s.medicine_id=i.medicine_id;
  update public.reservations set status='collected' where id=p_reservation_id;
end;
$$;

create function private.complete_sale(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid()); v_shop uuid; v_item record; v_stock record;
  v_seen uuid[] := '{}'; v_sale uuid; v_total numeric := 0;
  v_lines jsonb := '[]'::jsonb;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=v_user and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or
     jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Invalid sale basket';
  end if;
  perform private.expire_shop(v_shop);
  for v_item in select * from jsonb_to_recordset(p_items)
    as x(medicine_id uuid,quantity integer) order by medicine_id
  loop
    if v_item.medicine_id is null or v_item.quantity is null or
       v_item.quantity <= 0 or v_item.medicine_id = any(v_seen) then
      raise exception 'Invalid sale item';
    end if;
    v_seen := array_append(v_seen,v_item.medicine_id);
    select s.quantity,s.held_quantity,s.selling_price,s.expiry_date,m.brand_name
      into v_stock from public.pharmacy_stock s
      join public.medicines m on m.id=s.medicine_id
      where s.pharmacy_id=v_shop and s.medicine_id=v_item.medicine_id
      for update of s;
    if not found then raise exception 'Medicine is not stocked here'; end if;
    if v_stock.expiry_date < (now() at time zone 'Asia/Dhaka')::date then
      raise exception '% has passed its expiry date',v_stock.brand_name;
    end if;
    if v_stock.quantity-v_stock.held_quantity < v_item.quantity then
      raise exception 'Not enough % available; % units are reserved for pickup',
        v_stock.brand_name,v_stock.held_quantity;
    end if;
    v_total := v_total + v_item.quantity*v_stock.selling_price;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'medicineId',v_item.medicine_id,'quantity',v_item.quantity,
      'unitPrice',v_stock.selling_price));
  end loop;
  if array_length(v_seen,1) <> jsonb_array_length(p_items) then
    raise exception 'Invalid sale item';
  end if;
  insert into public.sales(pharmacy_id,total) values(v_shop,v_total)
    returning id into v_sale;
  insert into public.sale_items(sale_id,medicine_id,quantity,unit_price)
    select v_sale,(x.value->>'medicineId')::uuid,(x.value->>'quantity')::integer,
      (x.value->>'unitPrice')::numeric from jsonb_array_elements(v_lines) x;
  update public.pharmacy_stock s set quantity=s.quantity-i.quantity,
    updated_at=now() from public.sale_items i
    where i.sale_id=v_sale and s.pharmacy_id=v_shop and s.medicine_id=i.medicine_id;
  return jsonb_build_object('saleId',v_sale,'total',v_total);
end;
$$;

-- The Data API sees only invoker wrappers. The implementations perform all
-- role checks with auth.uid() and own the stock mutations atomically.
create function public.reserve(p_pharmacy_id uuid,p_items jsonb,p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.reserve(p_pharmacy_id,p_items,p_request_id);
$$;
create function public.cancel_reservation(p_reservation_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.cancel_reservation(p_reservation_id);
$$;
create function public.collect_reservation(p_reservation_id uuid,p_pickup_code text)
returns void language sql security invoker set search_path = '' as $$
  select private.collect_reservation(p_reservation_id,p_pickup_code);
$$;
create function public.complete_sale(p_items jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.complete_sale(p_items);
$$;

revoke execute on function private.reserve(uuid,jsonb,uuid) from public,anon;
revoke execute on function private.cancel_reservation(uuid) from public,anon;
revoke execute on function private.collect_reservation(uuid,text) from public,anon;
revoke execute on function private.complete_sale(jsonb) from public,anon;
revoke execute on function public.reserve(uuid,jsonb,uuid) from public,anon;
revoke execute on function public.cancel_reservation(uuid) from public,anon;
revoke execute on function public.collect_reservation(uuid,text) from public,anon;
revoke execute on function public.complete_sale(jsonb) from public,anon;
grant execute on function private.reserve(uuid,jsonb,uuid) to authenticated;
grant execute on function private.cancel_reservation(uuid) to authenticated;
grant execute on function private.collect_reservation(uuid,text) to authenticated;
grant execute on function private.complete_sale(jsonb) to authenticated;
grant execute on function public.reserve(uuid,jsonb,uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.collect_reservation(uuid,text) to authenticated;
grant execute on function public.complete_sale(jsonb) to authenticated;
