-- Owners can remove only their own unused uploads after a failed registration
-- or a successful replacement. Referenced licence photos remain immutable.
create policy licences_owner_delete_unreferenced on storage.objects for delete
to authenticated using (
  bucket_id = 'licences'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'pharmacist')
  and not exists (select 1 from public.pharmacies p
    where p.licence_photo_url = name)
);
