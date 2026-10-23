-- Training dossier: plan, mesocycles, microcycles, the session record and the coordinator's review
-- (run after medical-smoke.sql; reuses the club, team and people of team-staff-smoke.sql).
\set ON_ERROR_STOP 1
RESET ROLE;
INSERT INTO public.seasons (id, name, owner_id, club_id, start_date, end_date)
VALUES ('5e0000d0-0000-0000-0000-0000000000d1', '2026/2027 dossier', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-07-01', '2027-06-30');
INSERT INTO public.training_sessions (id, team_id, owner_id, date, duration_minutes)
VALUES ('7d0000d0-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '2026-10-06 18:30+00', 75);

-- the head coach plans the season, a block and a week, and records the session
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.team_season_plans (team_id, season_id, objectives, periods)
VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', 'Oferecer duas linhas de passe ao portador',
        '[{"label":"Diagnóstico","from":"2026-07-01","to":"2026-08-31","priority":"Bases do modelo","control":"Avaliação inicial"}]');
INSERT INTO public.training_mesocycles (team_id, season_id, name, kind, start_date, end_date, focus)
VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', 'Mesociclo 1', 'preparation', '2026-09-01', '2026-10-04', 'Relação com bola');
INSERT INTO public.training_microcycles (team_id, season_id, week_start, objectives, intensity)
VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', '2026-10-05', 'Transições', 'medium');
UPDATE public.training_sessions SET exercises = 'Rondo 5x2; jogo 7x7', notes = 'Boa intensidade', actual_minutes = 70, session_rating = 4, closed_at = now()
WHERE id = '7d0000d0-0000-0000-0000-0000000000d1';
DO $$ BEGIN
  ASSERT (SELECT closed_by FROM training_sessions WHERE id = '7d0000d0-0000-0000-0000-0000000000d1') = 'a0000000-0000-0000-0000-000000000002', 'who closed the session is recorded';
  -- a microcycle starts on a Monday
  BEGIN
    INSERT INTO public.training_microcycles (team_id, week_start) VALUES ('b0000000-0000-0000-0000-000000000001', '2026-10-07');
    RAISE EXCEPTION 'FAIL: a week starting on a Wednesday';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- the head coach is not the supervisor of his own dossier
  BEGIN
    INSERT INTO public.dossier_reviews (team_id, season_id) VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1');
    RAISE EXCEPTION 'FAIL: the coach reviewed his own dossier';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- the assistant sees and fills it too
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM team_season_plans) = 1 AND (SELECT count(*) FROM training_microcycles) = 1, 'the assistant sees the plan';
END $$;
UPDATE public.training_microcycles SET review = 'Cumprido' WHERE week_start = '2026-10-05';

-- the club admin (supervisor) reviews it
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
INSERT INTO public.dossier_reviews (team_id, season_id, note) VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', 'Visto');
DO $$ BEGIN
  ASSERT (SELECT reviewed_by FROM dossier_reviews) = 'a0000000-0000-0000-0000-000000000001', 'review recorded with the reviewer';
END $$;

-- someone from outside sees nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM team_season_plans) = 0, 'outsider: no plan';
  ASSERT (SELECT count(*) FROM training_mesocycles) = 0, 'outsider: no mesocycles';
  ASSERT (SELECT count(*) FROM training_microcycles) = 0, 'outsider: no microcycles';
  ASSERT (SELECT count(*) FROM dossier_reviews) = 0, 'outsider: no reviews';
  BEGIN
    INSERT INTO public.training_microcycles (team_id, week_start) VALUES ('b0000000-0000-0000-0000-000000000001', '2026-10-12');
    RAISE EXCEPTION 'FAIL: outsider wrote a week';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'dossier smoke: OK' AS result;
