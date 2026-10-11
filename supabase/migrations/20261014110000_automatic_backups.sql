-- Automatic backups: every night each club and each coach without a club gets a copy of
-- their data in a private storage bucket (the last 14 are kept). The files are only reachable
-- through the `club-backup` function, which checks who is asking.

INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;
-- no storage policies on purpose: nobody reads this bucket directly, not even signed-in users

-- the scopes that get a nightly copy
CREATE OR REPLACE FUNCTION public.backup_scopes()
RETURNS TABLE (kind text, id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'club'::text, c.id FROM public.clubs c
  UNION ALL
  SELECT DISTINCT 'coach'::text, t.owner_id FROM public.teams t WHERE t.club_id IS NULL AND t.owner_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.backup_scopes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.run_daily_backups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _url text; _secret text; _anon text;
BEGIN
  SELECT value INTO _url FROM private.cron_config WHERE key = 'functions_url';
  SELECT value INTO _secret FROM private.cron_config WHERE key = 'cron_secret';
  SELECT value INTO _anon FROM private.cron_config WHERE key = 'anon_key';
  IF _url IS NULL OR _secret IS NULL OR _anon IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 120000)'
    USING _url || '/club-backup',
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon, 'x-cron-secret', _secret),
          jsonb_build_object('action', 'cron');
END $$;
REVOKE ALL ON FUNCTION private.run_daily_backups() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'treinon-daily-backups';
    -- 03:15 UTC: nobody is training
    PERFORM cron.schedule('treinon-daily-backups', '15 3 * * *', 'SELECT private.run_daily_backups()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'daily backups not scheduled: %', SQLERRM;
END $$;
