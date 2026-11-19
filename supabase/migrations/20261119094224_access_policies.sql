-- Helpers live outside exposed API schemas. They read only the caller's
-- immutable role/shop fields so profile policies do not recurse.
create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
create function private.owns_pharmacy(p_pharmacy_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'pharmacist'
      and pharmacy_id = p_pharmacy_id
  );
$$;
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.owns_pharmacy(uuid) from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_pharmacy(uuid) to authenticated;

grant select on public.profiles to authenticated;
create policy profiles_read_self_or_admin on public.profiles for select
  to authenticated using (id = (select auth.uid()) or (select private.is_admin()));

grant select on public.medicines to anon, authenticated;
grant insert, update on public.medicines to authenticated;
create policy medicines_read on public.medicines for select
  to anon, authenticated using (true);
create policy medicines_admin_insert on public.medicines for insert
  to authenticated with check ((select private.is_admin()));
create policy medicines_admin_update on public.medicines for update
  to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Customers learn shop address/contact only through search, once approved.
-- Owner/admin can review full licence details through the direct table path.
grant select on public.pharmacies to authenticated;
create policy pharmacies_read_owner_admin on public.pharmacies for select
  to authenticated using (
    private.owns_pharmacy(id) or (select private.is_admin())
  );

grant select on public.pharmacy_stock to authenticated;
create policy pharmacy_stock_read_owner_admin on public.pharmacy_stock for select
  to authenticated using (
    private.owns_pharmacy(pharmacy_id) or (select private.is_admin())
  );

grant select on public.reservations to authenticated;
create policy reservations_read_participants on public.reservations for select
  to authenticated using (
    customer_id = (select auth.uid())
    or private.owns_pharmacy(pharmacy_id)
    or (select private.is_admin())
  );

grant select on public.reservation_items to authenticated;
create policy reservation_items_read_participants on public.reservation_items for select
  to authenticated using (exists (
    select 1 from public.reservations r
    where r.id = reservation_id and (
      r.customer_id = (select auth.uid())
      or private.owns_pharmacy(r.pharmacy_id)
      or (select private.is_admin())
    )
  ));

grant select on public.sales to authenticated;
create policy sales_read_owner_admin on public.sales for select
  to authenticated using (
    private.owns_pharmacy(pharmacy_id) or (select private.is_admin())
  );
grant select on public.sale_items to authenticated;
create policy sale_items_read_owner_admin on public.sale_items for select
  to authenticated using (exists (
    select 1 from public.sales s where s.id = sale_id and (
      private.owns_pharmacy(s.pharmacy_id) or (select private.is_admin())
    )
  ));
