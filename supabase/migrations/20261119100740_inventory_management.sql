-- Only the owning pharmacist can set shelf quantity and price. An existing
-- reservation's held units cannot be erased by an inventory edit.
create function private.set_stock(p_medicine_id uuid,p_quantity integer,
  p_selling_price numeric,p_expiry_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_id uuid;
begin
  select pharmacy_id into v_shop from public.profiles
    where id=(select auth.uid()) and role='pharmacist' and pharmacy_id is not null;
  if not found then raise exception 'Pharmacy account required'; end if;
  if p_medicine_id is null or p_quantity is null or p_quantity<0 or
     p_selling_price is null or p_selling_price<=0 or p_expiry_date is null then
    raise exception 'Invalid stock details';
  end if;
  perform private.expire_shop(v_shop);
  insert into public.pharmacy_stock(pharmacy_id,medicine_id,quantity,
    held_quantity,selling_price,expiry_date)
    values(v_shop,p_medicine_id,p_quantity,0,p_selling_price,p_expiry_date)
  on conflict (pharmacy_id,medicine_id) do update
    set quantity=excluded.quantity,selling_price=excluded.selling_price,
      expiry_date=excluded.expiry_date,updated_at=now()
    where public.pharmacy_stock.held_quantity<=excluded.quantity
  returning id into v_id;
  if v_id is null then raise exception 'Quantity cannot be below reserved units'; end if;
  return v_id;
end;
$$;
create function public.set_stock(p_medicine_id uuid,p_quantity integer,
  p_selling_price numeric,p_expiry_date date)
returns uuid language sql security invoker set search_path = '' as $$
  select private.set_stock(p_medicine_id,p_quantity,p_selling_price,p_expiry_date);
$$;
revoke execute on function private.set_stock(uuid,integer,numeric,date) from public,anon;
revoke execute on function public.set_stock(uuid,integer,numeric,date) from public,anon;
grant execute on function private.set_stock(uuid,integer,numeric,date) to authenticated;
grant execute on function public.set_stock(uuid,integer,numeric,date) to authenticated;

-- An item can expire while on hold. Collection must then stop; the owner can
-- cancel the reservation or wait for its hold to expire, but cannot hand it over.
create or replace function private.collect_reservation(p_reservation_id uuid,p_pickup_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_shop uuid;
  v_res public.reservations%rowtype; v_expired_name text;
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
  select m.brand_name into v_expired_name from public.reservation_items i
    join public.pharmacy_stock s on s.pharmacy_id=v_shop and s.medicine_id=i.medicine_id
    join public.medicines m on m.id=i.medicine_id
    where i.reservation_id=p_reservation_id
      and s.expiry_date < (now() at time zone 'Asia/Dhaka')::date
    order by i.medicine_id limit 1;
  if found then raise exception '% has passed its expiry date',v_expired_name; end if;
  update public.pharmacy_stock s set quantity=s.quantity-i.quantity,
    held_quantity=s.held_quantity-i.quantity,updated_at=now()
    from public.reservation_items i
    where i.reservation_id=p_reservation_id and s.pharmacy_id=v_shop
      and s.medicine_id=i.medicine_id;
  update public.reservations set status='collected' where id=p_reservation_id;
end;
$$;
