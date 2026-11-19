insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('licences','licences',false,5242880,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,
  allowed_mime_types=excluded.allowed_mime_types;

-- Folder one is the authenticated owner's UUID. This permits the first upload
-- before register_pharmacy links the profile to its new shop.
create policy licences_owner_insert on storage.objects for insert
to authenticated with check (
  bucket_id='licences'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='pharmacist')
);
create policy licences_owner_or_admin_read on storage.objects for select
to authenticated using (
  bucket_id='licences' and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or (select private.is_admin())
  )
);
create policy licences_owner_update on storage.objects for update
to authenticated using (
  bucket_id='licences' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='pharmacist')
) with check (
  bucket_id='licences' and (storage.foldername(name))[1]=(select auth.uid())::text
);
