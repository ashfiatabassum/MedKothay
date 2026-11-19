create function private.search_medicine(q text,lat double precision,lng double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_q text := btrim(coalesce(q,''));
  v_shop uuid;
  v_within jsonb;
  v_outside jsonb;
begin
  if char_length(v_q)>100 then raise exception 'Search is too long'; end if;
  if lat is null or lng is null or lat::text in ('NaN','Infinity','-Infinity')
     or lng::text in ('NaN','Infinity','-Infinity')
     or lat not between -90 and 90 or lng not between -180 and 180 then
    return jsonb_build_object('query',v_q,'needsLocation',true,
      'withinRadius','[]'::jsonb,'outsideRadius','[]'::jsonb);
  end if;
  if v_q='' then return jsonb_build_object('query',v_q,'needsLocation',false,
      'withinRadius','[]'::jsonb,'outsideRadius','[]'::jsonb); end if;
  -- Every search releases expired holds before computing its stock bands.
  for v_shop in select id from public.pharmacies
    where status='approved' and licence_expiry >= (now() at time zone 'Asia/Dhaka')::date
    order by id loop
    perform private.expire_shop(v_shop);
  end loop;
  with matches as (
    select p.id as pharmacy_id,p.name,p.area,p.address,p.phone,
      p.latitude,p.longitude,m.id as medicine_id,m.brand_name,m.generic_name,
      m.manufacturer,m.strength,m.form,m.prescription_only,s.selling_price,
      s.quantity-s.held_quantity as available,
      2*6371*asin(sqrt(least(1,greatest(0,
        power(sin(radians((p.latitude-lat)/2)),2)
        +cos(radians(lat))*cos(radians(p.latitude))
        *power(sin(radians((p.longitude-lng)/2)),2)
      )))) as distance_km
    from public.pharmacy_stock s
    join public.pharmacies p on p.id=s.pharmacy_id
    join public.medicines m on m.id=s.medicine_id
    where p.status='approved'
      and p.licence_expiry >= (now() at time zone 'Asia/Dhaka')::date
      and s.expiry_date >= (now() at time zone 'Asia/Dhaka')::date
      and (position(lower(v_q) in lower(m.brand_name))>0
        or position(lower(v_q) in lower(m.generic_name))>0)
  ), near_stock as (
    select exists(select 1 from matches where distance_km<=5 and available>0) as found
  ), far_shops as (
    select pharmacy_id,min(distance_km) as distance_km from matches
    where distance_km>5 and available>0
    group by pharmacy_id order by distance_km,pharmacy_id limit 3
  ), result as (
    select m.pharmacy_id,m.distance_km,m.medicine_id,m.available,
      jsonb_build_object(
        'pharmacyId',m.pharmacy_id,'pharmacyName',m.name,'area',m.area,
        'address',m.address,'phone',m.phone,'latitude',m.latitude,
        'longitude',m.longitude,'distanceKm',m.distance_km,'verified',true,
        'medicine',jsonb_build_object('id',m.medicine_id,'brandName',m.brand_name,
          'genericName',m.generic_name,'manufacturer',m.manufacturer,
          'strength',m.strength,'form',m.form,'prescriptionOnly',m.prescription_only),
        'sellingPrice',m.selling_price,
        'stockBand',case when m.available<=0 then 'out'
          when m.available<=5 then 'low' else 'in' end
      ) as item
    from matches m
  )
  select
    coalesce(jsonb_agg(r.item order by r.distance_km,r.pharmacy_id,r.medicine_id)
      filter (where r.distance_km<=5),'[]'::jsonb),
    coalesce(jsonb_agg(r.item order by r.distance_km,r.pharmacy_id,r.medicine_id)
      filter (where r.distance_km>5 and r.available>0 and not n.found
        and exists(select 1 from far_shops f where f.pharmacy_id=r.pharmacy_id)),
      '[]'::jsonb)
  into v_within,v_outside from result r cross join near_stock n;
  return jsonb_build_object('query',v_q,'needsLocation',false,
    'withinRadius',v_within,'outsideRadius',v_outside);
end;
$$;

create function public.search_medicine(q text,lat double precision,lng double precision)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.search_medicine(q,lat,lng);
$$;

create function private.get_my_reservations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_shop uuid; v_result jsonb;
begin
  if v_user is null or not exists(select 1 from public.profiles
    where id=v_user and role='customer') then
    raise exception 'Customer account required';
  end if;
  for v_shop in select distinct pharmacy_id from public.reservations
    where customer_id=v_user and status='active' order by pharmacy_id loop
    perform private.expire_shop(v_shop);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'pharmacyId',p.id,'pharmacyName',p.name,
    'pharmacyAddress',p.address,'pharmacyPhone',p.phone,
    'pharmacyLatitude',p.latitude,'pharmacyLongitude',p.longitude,
    'pickupCode',case when r.status='active' then r.pickup_code else null end,
    'status',r.status,'cancellationReason',r.cancellation_reason,
    'createdAt',r.created_at,
    'expiresAt',case when r.status='active' then r.expires_at else null end,
    'items',(select coalesce(jsonb_agg(jsonb_build_object(
      'medicine',jsonb_build_object('id',m.id,'brandName',m.brand_name,
        'genericName',m.generic_name,'manufacturer',m.manufacturer,
        'strength',m.strength,'form',m.form,'prescriptionOnly',m.prescription_only),
      'quantity',i.quantity,'unitPrice',i.unit_price) order by m.brand_name),
      '[]'::jsonb) from public.reservation_items i
      join public.medicines m on m.id=i.medicine_id where i.reservation_id=r.id)
  ) order by (r.status='active') desc,
    case when r.status='active' then r.expires_at end asc nulls last,
    r.created_at desc),'[]'::jsonb)
  into v_result from public.reservations r join public.pharmacies p on p.id=r.pharmacy_id
  where r.customer_id=v_user;
  return v_result;
end;
$$;
create function public.get_my_reservations()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_my_reservations();
$$;

create function private.suspend_pharmacy(p_pharmacy_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 300 then
    raise exception 'Reason must be 10 to 300 characters';
  end if;
  perform private.expire_shop(p_pharmacy_id);
  select status into v_status from public.pharmacies
    where id=p_pharmacy_id for update;
  if not found or v_status<>'approved' then
    raise exception 'Only approved pharmacies can be suspended';
  end if;
  for v_id in select id from public.reservations
    where pharmacy_id=p_pharmacy_id and status='active' order by id for update
  loop
    update public.pharmacy_stock s set held_quantity=s.held_quantity-i.quantity,
      updated_at=now() from public.reservation_items i
      where i.reservation_id=v_id and s.pharmacy_id=p_pharmacy_id
        and s.medicine_id=i.medicine_id;
    update public.reservations set status='cancelled',
      cancellation_reason='pharmacy_unavailable' where id=v_id;
  end loop;
  update public.pharmacies set status='suspended',rejection_reason=btrim(p_reason),
    reviewed_at=now(),reviewed_by=(select auth.uid()) where id=p_pharmacy_id;
end;
$$;
create function public.suspend_pharmacy(p_pharmacy_id uuid,p_reason text)
returns void language sql security invoker set search_path = '' as $$
  select private.suspend_pharmacy(p_pharmacy_id,p_reason);
$$;

grant usage on schema private to anon;
revoke execute on function private.search_medicine(text,double precision,double precision) from public,anon,authenticated;
revoke execute on function private.get_my_reservations() from public,anon,authenticated;
revoke execute on function private.suspend_pharmacy(uuid,text) from public,anon,authenticated;
revoke execute on function public.search_medicine(text,double precision,double precision) from public,anon,authenticated;
revoke execute on function public.get_my_reservations() from public,anon,authenticated;
revoke execute on function public.suspend_pharmacy(uuid,text) from public,anon,authenticated;
grant execute on function private.search_medicine(text,double precision,double precision) to anon,authenticated;
grant execute on function public.search_medicine(text,double precision,double precision) to anon,authenticated;
grant execute on function private.get_my_reservations() to authenticated;
grant execute on function public.get_my_reservations() to authenticated;
grant execute on function private.suspend_pharmacy(uuid,text) to authenticated;
grant execute on function public.suspend_pharmacy(uuid,text) to authenticated;
