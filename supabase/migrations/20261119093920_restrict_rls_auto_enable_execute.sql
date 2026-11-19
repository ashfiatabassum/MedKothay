-- The existing ensure_rls event trigger continues to run as postgres.
-- Its trigger function does not need Data API execution rights.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
