ALTER TABLE public.player_season_snapshots
  ADD COLUMN IF NOT EXISTS starts_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainings_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainings_present integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assists integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yellow_cards integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_cards integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evaluations_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutes_by_role jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS predominant_role text;

CREATE UNIQUE INDEX IF NOT EXISTS player_season_snapshots_player_season_uniq
  ON public.player_season_snapshots (player_id, season_id)
  WHERE season_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.build_player_season_snapshots(p_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.seasons%ROWTYPE;
  v_count integer := 0;
  r RECORD;
  v_positions_exists boolean;
BEGIN
  SELECT * INTO v_season FROM public.seasons WHERE id = p_season_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Época não encontrada';
  END IF;

  IF NOT public.user_can_manage_season(auth.uid(), p_season_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar snapshots desta época';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'match_player_positions'
  ) INTO v_positions_exists;

  -- Attach season_id to legacy rows that already use the same label, so the
  -- (player_id, season_label) uniqueness never collides with the new upsert.
  UPDATE public.player_season_snapshots s
     SET season_id = p_season_id
   WHERE s.season_id IS NULL
     AND s.season_label = v_season.name
     AND EXISTS (
       SELECT 1 FROM public.season_player_enrollments e
        WHERE e.season_id = p_season_id AND e.player_id = s.player_id
     );

  FOR r IN
    SELECT DISTINCT ON (e.player_id)
           e.player_id, e.team_id, e.age_group_id
      FROM public.season_player_enrollments e
     WHERE e.season_id = p_season_id
     ORDER BY e.player_id, (e.status = 'active') DESC, e.created_at
  LOOP
    DECLARE
      v_games int := 0; v_minutes int := 0; v_starts int := 0;
      v_tr_total int := 0; v_tr_present int := 0;
      v_goals int := 0; v_assists int := 0; v_yellow int := 0; v_red int := 0;
      v_avg numeric := NULL; v_evals int := 0;
      v_strengths text := NULL; v_improve text := NULL;
      v_age_group text := NULL;
      v_roles jsonb := '{}'::jsonb;
      v_top_role text := NULL;
    BEGIN
      SELECT COUNT(*), COALESCE(SUM(COALESCE(l.minutes_played, 0)), 0),
             COUNT(*) FILTER (WHERE l.is_starter)
        INTO v_games, v_minutes, v_starts
        FROM public.match_lineups l
        JOIN public.matches m ON m.id = l.match_id
       WHERE l.player_id = r.player_id
         AND m.season_id = p_season_id
         AND COALESCE(m.is_deleted, false) = false;

      SELECT COUNT(*), COUNT(*) FILTER (WHERE a.present)
        INTO v_tr_total, v_tr_present
        FROM public.training_attendance a
        JOIN public.training_sessions ts ON ts.id = a.session_id
       WHERE a.player_id = r.player_id
         AND ts.season_id = p_season_id;

      SELECT COUNT(*) FILTER (WHERE ev.event_type = 'goal' AND ev.player_id = r.player_id),
             COUNT(*) FILTER (WHERE ev.event_type = 'yellow_card' AND ev.player_id = r.player_id),
             COUNT(*) FILTER (WHERE ev.event_type = 'red_card' AND ev.player_id = r.player_id),
             COUNT(*) FILTER (WHERE ev.assist_player_id = r.player_id)
        INTO v_goals, v_yellow, v_red, v_assists
        FROM public.match_events ev
        JOIN public.matches m ON m.id = ev.match_id
       WHERE (ev.player_id = r.player_id OR ev.assist_player_id = r.player_id)
         AND m.season_id = p_season_id
         AND COALESCE(m.is_deleted, false) = false;

      SELECT COUNT(*), AVG(pe.overall_rating)
        INTO v_evals, v_avg
        FROM public.player_evaluations pe
       WHERE pe.player_id = r.player_id
         AND (pe.season_id = p_season_id
              OR (pe.season_id IS NULL AND pe.season_label = v_season.name));

      SELECT pe.strengths_text, pe.improvement_text
        INTO v_strengths, v_improve
        FROM public.player_evaluations pe
       WHERE pe.player_id = r.player_id
         AND (pe.season_id = p_season_id
              OR (pe.season_id IS NULL AND pe.season_label = v_season.name))
       ORDER BY pe.evaluation_date DESC NULLS LAST
       LIMIT 1;

      IF v_strengths IS NULL OR v_improve IS NULL THEN
        SELECT COALESCE(v_strengths, pe.strengths), COALESCE(v_improve, pe.weaknesses)
          INTO v_strengths, v_improve
          FROM public.player_evaluations pe
         WHERE pe.player_id = r.player_id
           AND (pe.season_id = p_season_id
                OR (pe.season_id IS NULL AND pe.season_label = v_season.name))
         ORDER BY pe.evaluation_date DESC NULLS LAST
         LIMIT 1;
      END IF;

      SELECT ag.name INTO v_age_group
        FROM public.academy_age_groups ag
       WHERE ag.id = r.age_group_id;

      IF v_positions_exists THEN
        BEGIN
          EXECUTE $q$
            SELECT COALESCE(jsonb_object_agg(role, mins), '{}'::jsonb)
              FROM (
                SELECT COALESCE(p.role, 'unknown') AS role,
                       SUM(GREATEST(COALESCE(p.ends_at_minute_abs, 0) - COALESCE(p.starts_at_minute_abs, 0), 0)) AS mins
                  FROM public.match_player_positions p
                  JOIN public.matches m ON m.id = p.match_id
                 WHERE p.player_id = $1 AND m.season_id = $2
                 GROUP BY 1
              ) s
          $q$ INTO v_roles USING r.player_id, p_season_id;
        EXCEPTION WHEN OTHERS THEN
          v_roles := '{}'::jsonb;
        END;

        SELECT key INTO v_top_role
          FROM jsonb_each_text(v_roles)
         ORDER BY (value)::numeric DESC
         LIMIT 1;
      END IF;

      INSERT INTO public.player_season_snapshots AS s (
        player_id, season_id, season_label, team_id, age_group,
        games_count, minutes_total, starts_count,
        trainings_total, trainings_present, trainings_count, attendance_rate,
        goals, assists, yellow_cards, red_cards,
        avg_overall, evaluations_count,
        strengths_summary, improvements_summary,
        minutes_by_role, predominant_role, created_by
      ) VALUES (
        r.player_id, p_season_id, v_season.name, r.team_id, v_age_group,
        v_games, v_minutes, v_starts,
        v_tr_total, v_tr_present, v_tr_present,
        CASE WHEN v_tr_total > 0 THEN ROUND((v_tr_present::numeric / v_tr_total) * 100, 1) ELSE 0 END,
        v_goals, v_assists, v_yellow, v_red,
        v_avg, v_evals,
        v_strengths, v_improve,
        v_roles, v_top_role, auth.uid()
      )
      ON CONFLICT (player_id, season_id) WHERE season_id IS NOT NULL
      DO UPDATE SET
        season_label = EXCLUDED.season_label,
        team_id = EXCLUDED.team_id,
        age_group = COALESCE(EXCLUDED.age_group, s.age_group),
        games_count = EXCLUDED.games_count,
        minutes_total = EXCLUDED.minutes_total,
        starts_count = EXCLUDED.starts_count,
        trainings_total = EXCLUDED.trainings_total,
        trainings_present = EXCLUDED.trainings_present,
        trainings_count = EXCLUDED.trainings_count,
        attendance_rate = EXCLUDED.attendance_rate,
        goals = EXCLUDED.goals,
        assists = EXCLUDED.assists,
        yellow_cards = EXCLUDED.yellow_cards,
        red_cards = EXCLUDED.red_cards,
        avg_overall = EXCLUDED.avg_overall,
        evaluations_count = EXCLUDED.evaluations_count,
        strengths_summary = COALESCE(EXCLUDED.strengths_summary, s.strengths_summary),
        improvements_summary = COALESCE(EXCLUDED.improvements_summary, s.improvements_summary),
        minutes_by_role = EXCLUDED.minutes_by_role,
        predominant_role = EXCLUDED.predominant_role,
        updated_at = now();

      v_count := v_count + 1;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.build_player_season_snapshots(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_player_season_snapshots(uuid) TO authenticated;