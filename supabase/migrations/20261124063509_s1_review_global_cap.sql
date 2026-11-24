-- S1 review fixes (24 Nov). Security review (Medium): sign-up is open with no
-- email confirmation, so the per-account limit alone can be farmed with new
-- accounts; add a global cap per Dhaka day. (A refund for failed reads was
-- considered and rejected: customers could call it after successful reads to
-- bypass the limit. Failed reads stay counted and the message says so.)

create index prescription_reads_created on public.prescription_reads (created_at);

create or replace function private.claim_prescription_read()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Dhaka')
    at time zone 'Asia/Dhaka';
  v_used integer;
  v_limit constant integer := 10;
  v_global_limit constant integer := 200;
begin
  if v_user is null or not exists (select 1 from public.profiles
      where id = v_user and role = 'customer') then
    raise exception 'Customer account required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rx:' || v_user::text, 0));
  select count(*) into v_used from public.prescription_reads
    where customer_id = v_user and created_at >= v_day_start;
  if v_used >= v_limit then
    return jsonb_build_object('status', 'limit', 'limit', v_limit);
  end if;
  -- One shared lock for the global count, so parallel customers cannot
  -- together overshoot it.
  perform pg_advisory_xact_lock(hashtextextended('rx:global', 0));
  if (select count(*) from public.prescription_reads
      where created_at >= v_day_start) >= v_global_limit then
    return jsonb_build_object('status', 'busy');
  end if;
  insert into public.prescription_reads (customer_id) values (v_user);
  return jsonb_build_object('status', 'ok', 'remaining', v_limit - v_used - 1);
end;
$$;

