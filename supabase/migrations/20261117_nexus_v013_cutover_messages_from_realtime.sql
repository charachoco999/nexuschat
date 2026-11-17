-- OPTIONAL CUTOVER STEP. Run only after the Cloudflare Worker, Supabase
-- Database Webhook, and EDGE_REALTIME_ENABLED=true have been verified in prod.
-- Removes just public.messages from Supabase Realtime; all other tables remain.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime drop table public.messages';
  end if;
end;
$$;
