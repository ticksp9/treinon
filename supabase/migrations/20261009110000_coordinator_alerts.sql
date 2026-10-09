-- Coordinator alerts: the coordinator must know, per age group, when
--   * a player misses two trainings in a row and nobody gave a reason
--   * monthly fees are overdue
-- Alerts are computed from the data (nothing to keep in sync); this table only remembers
-- which ones were already emailed and which ones the coordinator marked as dealt with.

CREATE TABLE IF NOT EXISTS public.coordinator_alert_state (
  kind text NOT NULL CHECK (kind IN ('absence', 'payment')),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- absence: date of the last missed training; payment: due date of the oldest unpaid charge
  ref_key text NOT NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  emailed_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, player_id, ref_key)
);
ALTER TABLE public.coordinator_alert_state ENABLE ROW LEVEL SECURITY;
-- no direct access: read through get_coordinator_alerts(), written by resolve_coordinator_alert()
-- and by the send-notice function (service role)
REVOKE ALL ON public.coordinator_alert_state FROM anon, authenticated;

-- Players of a team whose last two recorded trainings were both missed without a reason.
-- A reason = something written in the attendance notes ("doente", "avisou", ...).
CREATE OR REPLACE FUNCTION public.team_absence_alerts(_team uuid)
RETURNS TABLE (player_id uuid, player_name text, last_absence date, previous_absence date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT a.player_id, s.date::date AS d, a.present, nullif(trim(coalesce(a.notes, '')), '') AS reason,
           row_number() OVER (PARTITION BY a.player_id ORDER BY s.date DESC, s.created_at DESC) AS rn
      FROM public.training_attendance a
      JOIN public.training_sessions s ON s.id = a.session_id
     WHERE s.team_id = _team AND s.date::date <= current_date AND s.date::date >= current_date - 45
  )
  SELECT p.id, p.name::text, max(r.d) FILTER (WHERE r.rn = 1), max(r.d) FILTER (WHERE r.rn = 2)
    FROM ranked r
    JOIN public.players p ON p.id = r.player_id AND p.team_id = _team AND coalesce(p.is_active, true)
   WHERE r.rn <= 2
   GROUP BY p.id, p.name
  HAVING count(*) = 2 AND bool_and(NOT r.present AND r.reason IS NULL)
$$;
REVOKE ALL ON FUNCTION public.team_absence_alerts(uuid) FROM PUBLIC, anon, authenticated;

-- Everything the coordinator (or the club admin) has to look at, for the teams in his scope.
CREATE OR REPLACE FUNCTION public.get_coordinator_alerts()
RETURNS TABLE (
  kind text, player_id uuid, player_name text, team_id uuid, team_name text, club_id uuid,
  ref_key text, headline text, amount numeric, items integer, since date,
  resolved boolean, resolved_at timestamptz, note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_teams AS (
    SELECT t.id, t.name, t.club_id
      FROM public.teams t
     WHERE t.club_id IS NOT NULL
       AND (public.is_club_admin(auth.uid(), t.club_id) OR public.is_team_coordinator(auth.uid(), t.id))
  ),
  absences AS (
    SELECT 'absence'::text AS kind, a.player_id, a.player_name, mt.id AS team_id, mt.name::text AS team_name, mt.club_id,
           a.last_absence::text AS ref_key,
           ('Faltou aos treinos de ' || to_char(a.previous_absence, 'DD/MM') || ' e ' || to_char(a.last_absence, 'DD/MM') || ' sem motivo comunicado')::text AS headline,
           NULL::numeric AS amount, 2 AS items, a.previous_absence AS since
      FROM my_teams mt CROSS JOIN LATERAL public.team_absence_alerts(mt.id) a
  ),
  payments AS (
    SELECT 'payment'::text AS kind, p.id AS player_id, p.name::text AS player_name, mt.id AS team_id, mt.name::text AS team_name, mt.club_id,
           min(c.due_date)::text AS ref_key,
           (count(*) || CASE WHEN count(*) = 1 THEN ' mensalidade em atraso' ELSE ' mensalidades em atraso' END
             || ' desde ' || to_char(min(c.due_date), 'DD/MM/YYYY'))::text AS headline,
           sum(c.balance_due)::numeric AS amount, count(*)::integer AS items, min(c.due_date)::date AS since
      FROM public.charges c
      JOIN public.players p ON p.id = c.player_id
      JOIN my_teams mt ON mt.id = p.team_id AND mt.club_id = c.club_id
     WHERE c.balance_due > 0 AND c.due_date < current_date
       AND c.status::text NOT IN ('paid', 'cancelled', 'void', 'refunded')
     GROUP BY p.id, p.name, mt.id, mt.name, mt.club_id
  ),
  allrows AS (SELECT * FROM absences UNION ALL SELECT * FROM payments)
  SELECT r.kind, r.player_id, r.player_name, r.team_id, r.team_name, r.club_id, r.ref_key, r.headline, r.amount, r.items, r.since,
         (s.resolved_at IS NOT NULL), s.resolved_at, s.note
    FROM allrows r
    LEFT JOIN public.coordinator_alert_state s ON s.kind = r.kind AND s.player_id = r.player_id AND s.ref_key = r.ref_key
   ORDER BY (s.resolved_at IS NOT NULL), r.kind, r.since, r.player_name
$$;
REVOKE ALL ON FUNCTION public.get_coordinator_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_coordinator_alerts() TO authenticated;

-- "Tratado": the coordinator dealt with it (spoke to the parents, payment agreed, ...)
CREATE OR REPLACE FUNCTION public.resolve_coordinator_alert(_kind text, _player uuid, _ref_key text, _note text DEFAULT NULL, _resolved boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _club uuid;
BEGIN
  SELECT p.team_id, t.club_id INTO _team, _club FROM public.players p JOIN public.teams t ON t.id = p.team_id WHERE p.id = _player;
  IF _club IS NULL OR NOT (public.is_club_admin(auth.uid(), _club) OR public.is_team_coordinator(auth.uid(), _team)) THEN
    RAISE EXCEPTION 'Sem permissão para este alerta' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.coordinator_alert_state (kind, player_id, ref_key, club_id, resolved_at, resolved_by, note)
  VALUES (_kind, _player, _ref_key, _club, CASE WHEN _resolved THEN now() END, CASE WHEN _resolved THEN auth.uid() END, nullif(trim(coalesce(_note, '')), ''))
  ON CONFLICT (kind, player_id, ref_key) DO UPDATE
    SET resolved_at = CASE WHEN _resolved THEN now() END,
        resolved_by = CASE WHEN _resolved THEN auth.uid() END,
        note = coalesce(nullif(trim(coalesce(_note, '')), ''), public.coordinator_alert_state.note);
END $$;
REVOKE ALL ON FUNCTION public.resolve_coordinator_alert(text, uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_coordinator_alert(text, uuid, text, text, boolean) TO authenticated;

-- who to warn about a team: its coordinators, or the club owner when there is none
CREATE OR REPLACE FUNCTION public.team_coordinator_emails(_team uuid)
RETURNS TABLE (email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT id, club_id FROM public.teams WHERE id = _team AND club_id IS NOT NULL),
  coords AS (
    SELECT coalesce(nullif(trim(pr.email), ''), nullif(trim(cs.email), ''))::text AS email, coalesce(pr.display_name, pr.full_name, cs.name)::text AS name
      FROM t JOIN public.club_staff cs ON cs.club_id = t.club_id AND cs.is_active AND cs.role = 'coordenador'
        AND (cs.coord_team_ids IS NULL OR cardinality(cs.coord_team_ids) = 0 OR t.id = ANY (cs.coord_team_ids))
      LEFT JOIN public.profiles pr ON pr.id = cs.user_id
  )
  SELECT c.email, c.name FROM coords c WHERE c.email IS NOT NULL
  UNION ALL
  SELECT pr.email::text, coalesce(pr.display_name, pr.full_name, 'Clube')::text
    FROM t JOIN public.clubs cl ON cl.id = t.club_id JOIN public.profiles pr ON pr.id = cl.owner_id
   WHERE pr.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM coords c WHERE c.email IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.team_coordinator_emails(uuid) FROM PUBLIC, anon, authenticated;
