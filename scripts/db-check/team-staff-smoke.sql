-- Club with a head coach and an assistant: who can see and do what (run after all migrations).
\set ON_ERROR_STOP 1

-- A = club owner, H = head coach, S = assistant, X = outsider
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@clube.pt'),
  ('a0000000-0000-0000-0000-000000000002', 'principal@clube.pt'),
  ('a0000000-0000-0000-0000-000000000003', 'adjunto@clube.pt'),
  ('a0000000-0000-0000-0000-000000000004', 'estranho@outro.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@clube.pt', 'Admin', 'admin1'),
  ('a0000000-0000-0000-0000-000000000002', 'principal@clube.pt', 'Principal', 'princ1'),
  ('a0000000-0000-0000-0000-000000000003', 'adjunto@clube.pt', 'Adjunto', 'adj1'),
  ('a0000000-0000-0000-0000-000000000004', 'estranho@outro.pt', 'Estranho', 'estr1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, owner_id) VALUES ('c0000000-0000-0000-0000-000000000001', 'Clube Teste', 'a0000000-0000-0000-0000-000000000001');
INSERT INTO public.club_coaches (club_id, coach_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003');
INSERT INTO public.teams (id, name, owner_id, club_id, sport_type) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Sub-13', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'football_9');
INSERT INTO public.team_coaches (team_id, coach_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'head_coach'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'assistant_coach');

-- the invite table accepts coach/assistant invites now
INSERT INTO public.access_invites (scope_type, club_id, team_id, invite_type, recipient_name, invite_token_hash, invite_code, created_by)
VALUES ('club', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'assistant_coach', 'Novo', 'h', 'ABC234', 'a0000000-0000-0000-0000-000000000001');

-- Head coach creates a player and a match
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.players (id, name, owner_id, team_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Rui', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001');
INSERT INTO public.matches (id, owner_id, team_id, opponent_name, match_date) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Rival', '2026-10-04');
INSERT INTO public.match_lineups (match_id, player_id, owner_id, is_starter) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', true);

-- 1. The assistant sees the head coach's match, lineup and player, and can record events
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.matches WHERE id = 'e0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant cannot see match'; END IF;
  IF (SELECT count(*) FROM public.match_lineups WHERE match_id = 'e0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant cannot see lineup'; END IF;
  IF (SELECT count(*) FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant cannot see player'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000002') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant cannot see head coach name'; END IF;
END $$;
INSERT INTO public.match_events (match_id, event_type, minute, player_id, is_opponent, owner_id)
VALUES ('e0000000-0000-0000-0000-000000000001', 'goal', 12, 'd0000000-0000-0000-0000-000000000001', false, 'a0000000-0000-0000-0000-000000000003');
UPDATE public.match_lineups SET minutes_played = 30 WHERE match_id = 'e0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT minutes_played FROM public.match_lineups WHERE match_id = 'e0000000-0000-0000-0000-000000000001') <> 30 THEN RAISE EXCEPTION 'FAIL: assistant cannot update lineup'; END IF;
END $$;
-- …but cannot delete the team's players
DELETE FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant deleted a player'; END IF;
END $$;

-- 2. The club owner sees the club team and the coaches' names
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.matches WHERE id = 'e0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot see club match'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id IN ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')) <> 2 THEN RAISE EXCEPTION 'FAIL: owner cannot see coach names'; END IF;
END $$;

-- 3. An outsider sees nothing and cannot use the live-match functions or join the club
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.matches WHERE id = 'e0000000-0000-0000-0000-000000000001') <> 0 THEN RAISE EXCEPTION 'FAIL: outsider sees match'; END IF;
  IF (SELECT count(*) FROM public.players) <> 0 THEN RAISE EXCEPTION 'FAIL: outsider sees players'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000002') <> 0 THEN RAISE EXCEPTION 'FAIL: outsider sees coach profile'; END IF;
END $$;
DO $$ BEGIN
  PERFORM public.commit_substitution_batch('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 10, 0, '[]'::jsonb);
  RAISE EXCEPTION 'FAIL: outsider could call commit_substitution_batch';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: substitution function checks the caller';
END $$;
DO $$ BEGIN
  INSERT INTO public.teams (name, owner_id, club_id, sport_type) VALUES ('Intrusa', 'a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'football_7');
  RAISE EXCEPTION 'FAIL: outsider put a team in another club';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: cannot add teams to other clubs';
END $$;

-- 4. Leaving the club removes access to its teams
RESET ROLE;
DELETE FROM public.club_coaches WHERE coach_id = 'a0000000-0000-0000-0000-000000000003';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.matches WHERE id = 'e0000000-0000-0000-0000-000000000001') <> 0 THEN RAISE EXCEPTION 'FAIL: removed assistant still sees match'; END IF;
END $$;
RESET ROLE;

-- 5. Permissions per coach
INSERT INTO public.club_coaches (club_id, coach_id) VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003');
INSERT INTO public.team_coaches (team_id, coach_id, role) VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'assistant_coach');
INSERT INTO public.player_evaluations (player_id, owner_id, overall_rating)
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 7);
SET ROLE authenticated;

-- assistant by default: matches yes, evaluations no
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.match_lineups WHERE match_id = 'e0000000-0000-0000-0000-000000000001') <> 1 THEN RAISE EXCEPTION 'FAIL: assistant (default) cannot see lineup'; END IF;
  IF (SELECT count(*) FROM public.player_evaluations) <> 0 THEN RAISE EXCEPTION 'FAIL: assistant sees evaluations without permission'; END IF;
END $$;
-- an assistant cannot change the head coach's permissions
DO $$ BEGIN
  PERFORM public.set_team_coach_permissions('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '{"matches": false}');
  RAISE EXCEPTION 'FAIL: assistant changed head coach permissions';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: assistant cannot change permissions';
END $$;

-- head coach gives evaluations and takes matches away
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.player_evaluations) <> 1 THEN RAISE EXCEPTION 'FAIL: head coach cannot see evaluations'; END IF;
END $$;
SELECT public.set_team_coach_permissions('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '{"evaluations": true, "matches": false, "hack": true}');

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.player_evaluations) <> 1 THEN RAISE EXCEPTION 'FAIL: assistant with evaluations cannot see them'; END IF;
  IF (SELECT count(*) FROM public.match_lineups WHERE match_id = 'e0000000-0000-0000-0000-000000000001') <> 0 THEN RAISE EXCEPTION 'FAIL: assistant without matches sees lineup'; END IF;
  IF (public.team_perms_for(auth.uid(), 'b0000000-0000-0000-0000-000000000001') ->> 'matches')::boolean THEN RAISE EXCEPTION 'FAIL: team_perms_for'; END IF;
END $$;
UPDATE public.matches SET opponent_name = 'Mudado' WHERE id = 'e0000000-0000-0000-0000-000000000001';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT opponent_name FROM public.matches WHERE id = 'e0000000-0000-0000-0000-000000000001') <> 'Rival' THEN RAISE EXCEPTION 'FAIL: assistant without matches edited a match'; END IF;
  IF (SELECT permissions ? 'hack' FROM public.team_coaches WHERE coach_id = 'a0000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'FAIL: unknown permission key stored'; END IF;
END $$;

-- 6. Public club page: off by default, never shows players
SET ROLE anon;
DO $$ BEGIN
  IF public.get_public_club('clube-teste') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: page visible before being enabled'; END IF;
END $$;
RESET ROLE;
UPDATE public.clubs SET public_slug = 'clube-teste', public_page_enabled = true WHERE id = 'c0000000-0000-0000-0000-000000000001';
SET ROLE anon;
DO $$ DECLARE j jsonb; BEGIN
  j := public.get_public_club('Clube-Teste');
  IF j->>'name' <> 'Clube Teste' THEN RAISE EXCEPTION 'FAIL: public page name'; END IF;
  IF jsonb_array_length(j->'teams') <> 1 THEN RAISE EXCEPTION 'FAIL: public page teams'; END IF;
  IF position('Rui' IN j::text) > 0 THEN RAISE EXCEPTION 'FAIL: public page leaks a player name'; END IF;
END $$;
RESET ROLE;

SELECT 'TEAM STAFF SMOKE OK' AS result;

-- 7. Club map: coordinator writes training slots, club coaches read them and the fixtures
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000005', 'coord@clube.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES ('a0000000-0000-0000-0000-000000000005', 'coord@clube.pt', 'Coord', 'coord1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.club_staff (club_id, user_id, name, role) VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'Coord', 'coordenador');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', false);
INSERT INTO public.team_training_slots (team_id, weekday, start_time, end_time, location)
VALUES ('b0000000-0000-0000-0000-000000000001', 2, '18:30', '20:00', 'Campo 1');
INSERT INTO public.matches (id, owner_id, team_id, opponent_name, match_date, logistics)
VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Amigavel FC', now() + interval '2 days', '{"meet_time": "09:15"}');
-- head coach reads both
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.team_training_slots) <> 1 THEN RAISE EXCEPTION 'FAIL: coach cannot read training slots'; END IF;
  IF (SELECT count(*) FROM public.get_club_match_map('c0000000-0000-0000-0000-000000000001', now(), now() + interval '7 days') WHERE opponent_name = 'Amigavel FC' AND logistics->>'meet_time' = '09:15') <> 1 THEN RAISE EXCEPTION 'FAIL: coach cannot read club fixtures'; END IF;
  IF (SELECT count(*) FROM public.get_club_teams('c0000000-0000-0000-0000-000000000001')) <> 1 THEN RAISE EXCEPTION 'FAIL: get_club_teams'; END IF;
END $$;
-- a coach cannot change the coordinator's timetable
UPDATE public.team_training_slots SET location = 'Mudado';
-- an outsider sees nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.team_training_slots) <> 0 THEN RAISE EXCEPTION 'FAIL: outsider reads training slots'; END IF;
  IF (SELECT count(*) FROM public.get_club_match_map('c0000000-0000-0000-0000-000000000001', now(), now() + interval '7 days')) <> 0 THEN RAISE EXCEPTION 'FAIL: outsider reads club fixtures'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT location FROM public.team_training_slots LIMIT 1) <> 'Campo 1' THEN RAISE EXCEPTION 'FAIL: coach changed the timetable'; END IF;
END $$;

SELECT 'CLUB MAP SMOKE OK' AS result;

-- 8. Several coordinators, each with an area: a coordinator only manages their teams
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000006', 'coord2@clube.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES ('a0000000-0000-0000-0000-000000000006', 'coord2@clube.pt', 'Coord Seniores', 'coord2') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.teams (id, name, owner_id, club_id, sport_type) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'Seniores', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'football_11');
SET ROLE authenticated;
-- the admin makes user 6 a coordinator for the Seniores only
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
SELECT public.set_staff_role('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'coordenador');
SELECT public.set_coordinator_scope('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'Seniores', ARRAY['b0000000-0000-0000-0000-000000000002']::uuid[]);
-- a coordinator cannot set areas
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', false);
DO $$ BEGIN
  PERFORM public.set_coordinator_scope('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'x', NULL);
  RAISE EXCEPTION 'FAIL: coordinator changed another coordinator area';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: only the admin sets areas';
END $$;
-- the Seniores coordinator manages the Seniores, not the Sub-13
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000006', false);
INSERT INTO public.team_training_slots (team_id, weekday, start_time, end_time, location) VALUES ('b0000000-0000-0000-0000-000000000002', 4, '20:00', '21:30', 'Campo 1');
DO $$ BEGIN
  INSERT INTO public.team_training_slots (team_id, weekday, start_time, end_time) VALUES ('b0000000-0000-0000-0000-000000000001', 5, '18:00', '19:00');
  RAISE EXCEPTION 'FAIL: area coordinator wrote another team timetable';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: coordinator limited to their teams';
END $$;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_club_coordinators('c0000000-0000-0000-0000-000000000001')) <> 2 THEN RAISE EXCEPTION 'FAIL: get_club_coordinators'; END IF;
  -- still sees the whole club map (read)
  IF (SELECT count(*) FROM public.team_training_slots) <> 2 THEN RAISE EXCEPTION 'FAIL: coordinator cannot read the whole map'; END IF;
END $$;
RESET ROLE;

SELECT 'COORDINATORS SMOKE OK' AS result;
