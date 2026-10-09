-- "Vou / Não vou" beyond events:
--   * events get a deadline to answer and a reminder to whoever has not answered
--   * parents/players answer for matches (call-up) and for trainings
--   * a "não vai" to a training shows up as the reason in the coach's attendance sheet

-- ── events: deadline + reminder ──
ALTER TABLE public.club_events ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz;
ALTER TABLE public.club_events ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_answer_event(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_events e
     WHERE e.id = _event
       AND (e.rsvp_deadline IS NULL OR now() <= e.rsvp_deadline)
       AND public.can_see_club_event(_user, e.owner_id, e.club_id, e.team_id))
$$;

-- people with an account who are invited to the event and have not answered yet
CREATE OR REPLACE FUNCTION public.event_pending_emails(_event uuid)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (SELECT * FROM public.club_events WHERE id = _event),
  teams_in AS (
    SELECT t.id FROM public.teams t, ev
     WHERE (ev.team_id IS NOT NULL AND t.id = ev.team_id)
        OR (ev.team_id IS NULL AND ev.club_id IS NOT NULL AND t.club_id = ev.club_id)
        OR (ev.team_id IS NULL AND ev.club_id IS NULL AND t.owner_id = ev.owner_id AND t.club_id IS NULL)
  ),
  people AS (
    SELECT gp.user_id FROM public.players p
      JOIN teams_in ti ON ti.id = p.team_id
      JOIN public.player_guardians pg ON pg.player_id = p.id
      JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
    UNION
    SELECT pa.user_id FROM public.players p
      JOIN teams_in ti ON ti.id = p.team_id
      JOIN public.player_accounts pa ON pa.player_id = p.id
  )
  SELECT DISTINCT pr.email::text
    FROM people pe JOIN public.profiles pr ON pr.id = pe.user_id
   WHERE pr.email IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.club_event_rsvps r WHERE r.event_id = _event AND r.user_id = pe.user_id)
$$;
REVOKE ALL ON FUNCTION public.event_pending_emails(uuid) FROM PUBLIC, anon, authenticated;

-- ── matches: only the family of a player answers his call-up ──
-- (the old policy let any signed-in user write a confirmation for any player)
DROP POLICY IF EXISTS "Guardians manage callup confirmations" ON public.callup_confirmations;
DROP POLICY IF EXISTS "Family manage callup confirmations" ON public.callup_confirmations;
CREATE POLICY "Family manage callup confirmations" ON public.callup_confirmations
  FOR ALL TO authenticated
  USING (public.is_guardian_of_player(auth.uid(), player_id) OR player_id = public.get_player_account_id(auth.uid()))
  WITH CHECK (confirmed_by = auth.uid()
    AND (public.is_guardian_of_player(auth.uid(), player_id) OR player_id = public.get_player_account_id(auth.uid())));

-- ── trainings: families see the sessions of their team and say if the player comes ──
DROP POLICY IF EXISTS "Family can view team sessions" ON public.training_sessions;
CREATE POLICY "Family can view team sessions" ON public.training_sessions
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.family_team_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.training_rsvps (
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 120),
  answered_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, player_id)
);
ALTER TABLE public.training_rsvps ENABLE ROW LEVEL SECURITY;

-- the player is theirs and the session is of the player's team
CREATE OR REPLACE FUNCTION public.can_answer_training(_user uuid, _session uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.is_guardian_of_player(_user, _player) OR _player = public.get_player_account_id(_user))
     AND EXISTS (SELECT 1 FROM public.training_sessions s JOIN public.players p ON p.team_id = s.team_id
                  WHERE s.id = _session AND p.id = _player)
$$;
REVOKE ALL ON FUNCTION public.can_answer_training(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_answer_training(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "training_rsvps_select" ON public.training_rsvps;
CREATE POLICY "training_rsvps_select" ON public.training_rsvps FOR SELECT TO authenticated
  USING (public.is_guardian_of_player(auth.uid(), player_id)
      OR player_id = public.get_player_account_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND public.can_coach_team(auth.uid(), s.team_id)));

DROP POLICY IF EXISTS "training_rsvps_insert" ON public.training_rsvps;
CREATE POLICY "training_rsvps_insert" ON public.training_rsvps FOR INSERT TO authenticated
  WITH CHECK (answered_by = auth.uid() AND public.can_answer_training(auth.uid(), session_id, player_id));

DROP POLICY IF EXISTS "training_rsvps_update" ON public.training_rsvps;
CREATE POLICY "training_rsvps_update" ON public.training_rsvps FOR UPDATE TO authenticated
  USING (public.can_answer_training(auth.uid(), session_id, player_id))
  WITH CHECK (answered_by = auth.uid() AND public.can_answer_training(auth.uid(), session_id, player_id));

GRANT SELECT, INSERT, UPDATE ON public.training_rsvps TO authenticated;

-- ── daily job: remind who has not answered an event (only where pg_cron/pg_net exist) ──
-- The job calls the send-notice function with a secret kept outside the repository
-- (private.cron_config, filled in by hand when the project is set up).
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_config (key text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON private.cron_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.run_daily_notices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _url text; _secret text; _anon text;
BEGIN
  SELECT value INTO _url FROM private.cron_config WHERE key = 'functions_url';
  SELECT value INTO _secret FROM private.cron_config WHERE key = 'cron_secret';
  SELECT value INTO _anon FROM private.cron_config WHERE key = 'anon_key';
  IF _url IS NULL OR _secret IS NULL OR _anon IS NULL THEN RETURN; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, headers := $2, body := $3)'
    USING _url || '/send-notice',
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _anon, 'x-cron-secret', _secret),
          jsonb_build_object('kind', 'cron');
END $$;
REVOKE ALL ON FUNCTION private.run_daily_notices() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'treinon-daily-notices';
    -- 08:00 UTC = 09:00 in Lisbon in summer, 08:00 in winter
    PERFORM cron.schedule('treinon-daily-notices', '0 8 * * *', 'SELECT private.run_daily_notices()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'daily notices not scheduled: %', SQLERRM;
END $$;
