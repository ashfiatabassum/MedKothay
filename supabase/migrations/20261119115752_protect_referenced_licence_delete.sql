-- Qualify the outer Storage column: unqualified `name` in the subquery
-- resolved to pharmacies.name and mistakenly permitted referenced deletion.
drop policy licences_owner_delete_unreferenced on storage.objects;
create policy licences_owner_delete_unreferenced on storage.objects for delete
to authenticated using (
  bucket_id = 'licences'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'pharmacist')
  and not exists (select 1 from public.pharmacies p
    where p.licence_photo_url = objects.name)
);
