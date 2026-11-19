-- Keep privileged implementations outside the Data API schema. Exposed
-- invoker wrappers do not gain rights; private functions check auth.uid().
alter function public.register_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) set schema private;
alter function public.resubmit_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) set schema private;
alter function public.approve_pharmacy(uuid) set schema private;
alter function public.reject_pharmacy(uuid,text) set schema private;
alter function public.duplicate_licence_pharmacies(text) set schema private;
alter function public.medicine_stock_usage(uuid) set schema private;

create function public.register_pharmacy(
  p_name text,p_address text,p_area text,p_latitude double precision,
  p_longitude double precision,p_phone text,p_licence_number text,
  p_licence_photo_url text,p_licence_expiry date,p_location_source text default 'area'
) returns uuid language sql security invoker set search_path = '' as $$
  select private.register_pharmacy(p_name,p_address,p_area,p_latitude,
    p_longitude,p_phone,p_licence_number,p_licence_photo_url,
    p_licence_expiry,p_location_source);
$$;
create function public.resubmit_pharmacy(
  p_name text,p_address text,p_area text,p_latitude double precision,
  p_longitude double precision,p_phone text,p_licence_number text,
  p_licence_photo_url text,p_licence_expiry date,p_location_source text default 'area'
) returns uuid language sql security invoker set search_path = '' as $$
  select private.resubmit_pharmacy(p_name,p_address,p_area,p_latitude,
    p_longitude,p_phone,p_licence_number,p_licence_photo_url,
    p_licence_expiry,p_location_source);
$$;
create function public.approve_pharmacy(p_pharmacy_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.approve_pharmacy(p_pharmacy_id);
$$;
create function public.reject_pharmacy(p_pharmacy_id uuid,p_reason text)
returns void language sql security invoker set search_path = '' as $$
  select private.reject_pharmacy(p_pharmacy_id,p_reason);
$$;
create function public.duplicate_licence_pharmacies(p_licence_number text)
returns table(id uuid,name text,status text)
language sql stable security invoker set search_path = '' as $$
  select * from private.duplicate_licence_pharmacies(p_licence_number);
$$;
create function public.medicine_stock_usage(p_medicine_id uuid)
returns integer language sql stable security invoker set search_path = '' as $$
  select private.medicine_stock_usage(p_medicine_id);
$$;

revoke execute on function public.register_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) from public,anon;
revoke execute on function public.resubmit_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) from public,anon;
revoke execute on function public.approve_pharmacy(uuid) from public,anon;
revoke execute on function public.reject_pharmacy(uuid,text) from public,anon;
revoke execute on function public.duplicate_licence_pharmacies(text) from public,anon;
revoke execute on function public.medicine_stock_usage(uuid) from public,anon;
grant execute on function public.register_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) to authenticated;
grant execute on function public.resubmit_pharmacy(text,text,text,double precision,double precision,text,text,text,date,text) to authenticated;
grant execute on function public.approve_pharmacy(uuid) to authenticated;
grant execute on function public.reject_pharmacy(uuid,text) to authenticated;
grant execute on function public.duplicate_licence_pharmacies(text) to authenticated;
grant execute on function public.medicine_stock_usage(uuid) to authenticated;
