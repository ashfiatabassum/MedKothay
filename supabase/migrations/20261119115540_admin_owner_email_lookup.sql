-- Only an admin may obtain the email for a pharmacy decision. Auth users are
-- not exposed to the Data API; the wrapper reveals just this one value.
create function private.pharmacy_owner_email(p_pharmacy_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_email text;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  select u.email into v_email from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'pharmacist' and p.pharmacy_id = p_pharmacy_id
  limit 1;
  return v_email;
end;
$$;

create function public.pharmacy_owner_email(p_pharmacy_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select private.pharmacy_owner_email(p_pharmacy_id);
$$;
revoke execute on function private.pharmacy_owner_email(uuid) from public, anon, authenticated;
revoke execute on function public.pharmacy_owner_email(uuid) from public, anon, authenticated;
grant execute on function private.pharmacy_owner_email(uuid) to authenticated;
grant execute on function public.pharmacy_owner_email(uuid) to authenticated;
