-- Ownership and role checks belong in each privileged function, not only RLS.
create function public.register_pharmacy(
  p_name text, p_address text, p_area text,
  p_latitude double precision, p_longitude double precision, p_phone text,
  p_licence_number text, p_licence_photo_url text, p_licence_expiry date,
  p_location_source text default 'area'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into v_profile from public.profiles where id = (select auth.uid()) for update;
  if not found or v_profile.role <> 'pharmacist' or v_profile.pharmacy_id is not null then
    raise exception 'A pharmacy account without a shop is required';
  end if;
  if p_licence_expiry < (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'Licence has expired';
  end if;
  if p_licence_photo_url is null or
    split_part(p_licence_photo_url, '/', 1) <> v_profile.id::text or
    not exists (select 1 from storage.objects where bucket_id = 'licences' and name = p_licence_photo_url)
  then raise exception 'Upload a licence photo first'; end if;
  insert into public.pharmacies(name,address,area,latitude,longitude,phone,
    licence_number,licence_photo_url,licence_expiry,location_source)
  values (p_name,p_address,p_area,p_latitude,p_longitude,p_phone,
    p_licence_number,p_licence_photo_url,p_licence_expiry,p_location_source)
  returning id into v_id;
  update public.profiles set pharmacy_id = v_id where id = v_profile.id;
  return v_id;
end;
$$;

create function public.resubmit_pharmacy(
  p_name text, p_address text, p_area text,
  p_latitude double precision, p_longitude double precision, p_phone text,
  p_licence_number text, p_licence_photo_url text, p_licence_expiry date,
  p_location_source text default 'area'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles%rowtype;
  v_shop public.pharmacies%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into v_profile from public.profiles where id = (select auth.uid()) for update;
  if not found or v_profile.role <> 'pharmacist' or v_profile.pharmacy_id is null then
    raise exception 'A pharmacy account with a shop is required';
  end if;
  select * into v_shop from public.pharmacies where id = v_profile.pharmacy_id for update;
  if not found or not (
    v_shop.status in ('rejected','suspended') or
    (v_shop.status = 'approved' and v_shop.licence_expiry < (now() at time zone 'Asia/Dhaka')::date)
  ) then raise exception 'This shop cannot be resubmitted'; end if;
  if p_licence_expiry < (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'Licence has expired';
  end if;
  if p_licence_photo_url is null or
    split_part(p_licence_photo_url, '/', 1) <> v_profile.id::text or
    not exists (select 1 from storage.objects where bucket_id = 'licences' and name = p_licence_photo_url)
  then raise exception 'Upload a licence photo first'; end if;
  update public.pharmacies set
    name=p_name,address=p_address,area=p_area,latitude=p_latitude,longitude=p_longitude,
    phone=p_phone,licence_number=p_licence_number,licence_photo_url=p_licence_photo_url,
    licence_expiry=p_licence_expiry,location_source=p_location_source,status='pending',
    previous_rejection_reason=coalesce(rejection_reason,previous_rejection_reason),
    rejection_reason=null,submitted_at=now(),reviewed_at=null,reviewed_by=null
  where id=v_shop.id;
  return v_shop.id;
end;
$$;

create function public.approve_pharmacy(p_pharmacy_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_expiry date;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  select licence_expiry into v_expiry from public.pharmacies
    where id=p_pharmacy_id and status='pending' for update;
  if not found then raise exception 'Pharmacy is not pending'; end if;
  if v_expiry < (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'Licence expired on %', v_expiry;
  end if;
  update public.pharmacies set status='approved',rejection_reason=null,
    reviewed_at=now(),reviewed_by=(select auth.uid())
  where id=p_pharmacy_id and status='pending';
end;
$$;

create function public.reject_pharmacy(p_pharmacy_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 300 then
    raise exception 'Reason must be 10 to 300 characters';
  end if;
  update public.pharmacies set status='rejected',rejection_reason=btrim(p_reason),
    reviewed_at=now(),reviewed_by=(select auth.uid())
  where id=p_pharmacy_id and status='pending';
  if not found then raise exception 'Pharmacy is not pending'; end if;
end;
$$;

create function public.duplicate_licence_pharmacies(p_licence_number text)
returns table(id uuid,name text,status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query select p.id,p.name,p.status from public.pharmacies p
    where p.licence_number_normalized = upper(regexp_replace(p_licence_number,'[[:space:]]','','g'));
end;
$$;

create function public.medicine_stock_usage(p_medicine_id uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  select count(distinct pharmacy_id)::integer into v_count
  from public.pharmacy_stock where medicine_id=p_medicine_id;
  return v_count;
end;
$$;

revoke execute on function public.register_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) from public,anon,authenticated;
revoke execute on function public.resubmit_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) from public,anon,authenticated;
revoke execute on function public.approve_pharmacy(uuid) from public,anon,authenticated;
revoke execute on function public.reject_pharmacy(uuid,text) from public,anon,authenticated;
revoke execute on function public.duplicate_licence_pharmacies(text) from public,anon,authenticated;
revoke execute on function public.medicine_stock_usage(uuid) from public,anon,authenticated;
grant execute on function public.register_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) to authenticated;
grant execute on function public.resubmit_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) to authenticated;
grant execute on function public.approve_pharmacy(uuid) to authenticated;
grant execute on function public.reject_pharmacy(uuid,text) to authenticated;
grant execute on function public.duplicate_licence_pharmacies(text) to authenticated;
grant execute on function public.medicine_stock_usage(uuid) to authenticated;
