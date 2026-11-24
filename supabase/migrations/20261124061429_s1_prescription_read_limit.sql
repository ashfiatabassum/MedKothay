-- S1 (24 Nov): daily limit for AI prescription reading. Each read is a paid
-- Gemini call, so only customers may read, at most 10 per Dhaka day. The
-- table stores who and when only: never the image or the medicine names.
create table public.prescription_reads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index prescription_reads_customer_created
  on public.prescription_reads (customer_id, created_at);
alter table public.prescription_reads enable row level security;
-- No client access at all; only the function below reads or writes it.
revoke all on public.prescription_reads from public, anon, authenticated;

-- Claims one read for the signed-in customer, counted before calling Gemini
-- (failed reads count too, which is what protects the bill). The advisory
-- lock stops two parallel uploads both passing the check.
create function private.claim_prescription_read()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_used integer;
  v_limit constant integer := 10;
begin
  if v_user is null or not exists (select 1 from public.profiles
      where id = v_user and role = 'customer') then
    raise exception 'Customer account required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rx:' || v_user::text, 0));
  select count(*) into v_used from public.prescription_reads
    where customer_id = v_user
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Dhaka')
        at time zone 'Asia/Dhaka');
  if v_used >= v_limit then
    return jsonb_build_object('status', 'limit', 'limit', v_limit);
  end if;
  insert into public.prescription_reads (customer_id) values (v_user);
  return jsonb_build_object('status', 'ok', 'remaining', v_limit - v_used - 1);
end;
$$;
create function public.claim_prescription_read()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.claim_prescription_read();
$$;
revoke execute on function private.claim_prescription_read() from public, anon;
revoke execute on function public.claim_prescription_read() from public, anon;
grant execute on function private.claim_prescription_read() to authenticated;
grant execute on function public.claim_prescription_read() to authenticated;
