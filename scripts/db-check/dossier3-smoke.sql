-- Training dossier, phase 3: a player's transition history and the club's internal training actions
-- (run after dossier2-smoke.sql).
\set ON_ERROR_STOP 1
RESET ROLE;
INSERT INTO public.teams (id, name, owner_id, club_id, sport_type, category)
VALUES ('b0000000-0000-0000-0000-0000000000d3', 'Sub-15', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'football_11', 'Sub-15');

-- the head coach records that Rui trained with the Sub-15
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.player_transitions (player_id, team_id, to_team_id, kind, event_date, note)
VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000d3', 'training', '2026-10-15', 'Adaptou-se bem');
DO $$ BEGIN
  ASSERT (SELECT created_by FROM player_transitions) = 'a0000000-0000-0000-0000-000000000002', 'who recorded it';
  -- the team of a record is the player's team
  BEGIN
    INSERT INTO public.player_transitions (player_id, team_id, to_team_name) VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000d3', 'X');
    RAISE EXCEPTION 'FAIL: record for a team the player is not in';
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
  END;
  -- somewhere to go is needed
  BEGIN
    INSERT INTO public.player_transitions (player_id, team_id) VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: record without a destination';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- a coach does not record the club's training actions
  BEGIN
    INSERT INTO public.club_training_actions (club_id, title, action_date) VALUES ('c0000000-0000-0000-0000-000000000001', 'X', '2026-09-10');
    RAISE EXCEPTION 'FAIL: coach wrote a club training action';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- …but keeps their own, without a club
INSERT INTO public.club_training_actions (owner_id, title, action_date) VALUES ('a0000000-0000-0000-0000-000000000002', 'Curso UEFA C', '2026-09-01');

-- the coordinator records an internal course and sees the transition (coordinator of the club)
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', false);
INSERT INTO public.club_training_actions (club_id, title, kind, action_date, duration_minutes, trainer, topics, all_staff)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Modelo de jogo do clube', 'course', '2026-09-10', 120, 'Coordenador técnico', 'Princípios do futebol de 9', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM player_transitions) = 1, 'the coordinator sees the transition';
  ASSERT (SELECT count(*) FROM club_training_actions) = 1, 'the coordinator sees only the club''s actions';
END $$;

-- the head coach reads the club's actions but cannot change them
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
UPDATE public.club_training_actions SET title = 'mudado' WHERE club_id IS NOT NULL;
DO $$ BEGIN
  ASSERT (SELECT title FROM club_training_actions WHERE club_id IS NOT NULL) = 'Modelo de jogo do clube', 'coach reads, cannot change';
  ASSERT (SELECT count(*) FROM club_training_actions) = 2, 'coach sees the club''s and their own';
END $$;

-- someone from outside sees nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM player_transitions) = 0, 'outsider: no transitions';
  ASSERT (SELECT count(*) FROM club_training_actions) = 0, 'outsider: no training actions';
  BEGIN
    INSERT INTO public.player_transitions (player_id, team_id, to_team_name) VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'X');
    RAISE EXCEPTION 'FAIL: outsider wrote a transition';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'dossier phase 3 smoke: OK' AS result;
