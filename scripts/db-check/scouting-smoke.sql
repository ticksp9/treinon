-- Opponent scouting: who works on an opponent's sheet (run after backup-smoke.sql; reuses the people of team-staff-smoke.sql).
\set ON_ERROR_STOP 1
RESET ROLE;
SET ROLE authenticated;

-- the head coach files an opponent in the club's archive, with a player, a scheme and an observation
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.scout_opponents (id, club_id, name, category, sport_type)
VALUES ('5c000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Rival FC', 'Sub-13', 'football_9');
INSERT INTO public.scout_opponent_players (opponent_id, shirt_number, name, position, is_key) VALUES ('5c000000-0000-0000-0000-000000000001', '10', 'Dez', 'CM', true);
INSERT INTO public.scout_opponent_schemes (id, opponent_id, moment, title, board_data)
VALUES ('5c000000-0000-0000-0000-0000000000a1', '5c000000-0000-0000-0000-000000000001', 'attack', 'Saida a tres', '{"sport":"football_9","tokens":[],"drawings":[],"steps":[]}');
INSERT INTO public.scout_opponent_observations (opponent_id, against, result, notes) VALUES ('5c000000-0000-0000-0000-000000000001', 'Outro', '2-1', 'Pressionam alto');
-- and one in his own archive (no club)
INSERT INTO public.scout_opponents (id, name) VALUES ('5c000000-0000-0000-0000-000000000002', 'Pessoal do principal');
DO $$ BEGIN
  -- nobody files a sheet in a club he does not belong to, or in somebody else's name
  BEGIN
    INSERT INTO public.scout_opponents (name, owner_id) VALUES ('Falso', 'a0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: created a sheet in another person''s name';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- the assistant (same club, same team) works on both
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_opponents WHERE id IN ('5c000000-0000-0000-0000-000000000001', '5c000000-0000-0000-0000-000000000002')) = 2, 'assistant sees the club sheet and the head coach''s own';
  ASSERT (SELECT count(*) FROM public.scout_opponent_schemes WHERE opponent_id = '5c000000-0000-0000-0000-000000000001') = 1, 'assistant sees the schemes';
  UPDATE public.scout_opponents SET strengths = 'Bolas paradas' WHERE id = '5c000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'assistant can add to the sheet';
  INSERT INTO public.scout_opponent_schemes (opponent_id, moment, title, board_data) VALUES ('5c000000-0000-0000-0000-000000000001', 'defense', 'Bloco medio', '{}');
  DELETE FROM public.scout_opponents WHERE id = '5c000000-0000-0000-0000-000000000001';
  ASSERT NOT FOUND, 'assistant cannot delete a sheet he did not create';
  BEGIN
    UPDATE public.scout_opponents SET club_id = NULL WHERE id = '5c000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL: moved a sheet out of the club';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
END $$;

-- an outsider and a parent see nothing and cannot write
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_opponents) = 0, 'outsider sees no sheets';
  ASSERT (SELECT count(*) FROM public.scout_opponent_players) = 0 AND (SELECT count(*) FROM public.scout_opponent_schemes) = 0 AND (SELECT count(*) FROM public.scout_opponent_observations) = 0, 'outsider sees no details';
  BEGIN
    INSERT INTO public.scout_opponent_players (opponent_id, shirt_number) VALUES ('5c000000-0000-0000-0000-000000000001', '9');
    RAISE EXCEPTION 'FAIL: outsider wrote on a sheet';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.scout_opponents (name, club_id) VALUES ('Intruso', 'c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: outsider filed a sheet in the club';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- his own archive works
  INSERT INTO public.scout_opponents (id, name) VALUES ('5c000000-0000-0000-0000-000000000003', 'Do estranho');
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_opponents) = 0 AND (SELECT count(*) FROM public.scout_opponent_schemes) = 0, 'a parent sees nothing of the scouting';
END $$;

-- the game plan of a match: the staff of that team, nobody else
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.match_plans (match_id, opponent_id, key_points, scheme_ids)
VALUES ('e0000000-0000-0000-0000-000000000001', '5c000000-0000-0000-0000-000000000001', ARRAY['Pressionar o central esquerdo', 'Atacar o segundo poste'], ARRAY['5c000000-0000-0000-0000-0000000000a1']::uuid[]);
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  ASSERT (SELECT cardinality(key_points) FROM public.match_plans WHERE match_id = 'e0000000-0000-0000-0000-000000000001') = 2, 'assistant reads the plan';
  UPDATE public.match_plans SET notes = 'Entrar forte' WHERE match_id = 'e0000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'assistant can change the plan';
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.match_plans) = 0, 'outsider sees no plans';
  BEGIN
    INSERT INTO public.match_plans (match_id) VALUES ('e0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: outsider wrote a plan';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN
    IF SQLSTATE = '23505' THEN RAISE EXCEPTION 'FAIL: outsider got past the policy'; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.match_plans) = 0, 'a parent does not see the game plan';
END $$;

-- the club's administrator sees the club's sheets (not the coaches' private ones of other people) and may delete
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_opponents WHERE id = '5c000000-0000-0000-0000-000000000003') = 0, 'the outsider''s archive stays his';
  DELETE FROM public.scout_opponents WHERE id = '5c000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'club admin deletes a club sheet';
  ASSERT (SELECT count(*) FROM public.scout_opponent_schemes WHERE opponent_id = '5c000000-0000-0000-0000-000000000001') = 0, 'its schemes go with it';
  ASSERT (SELECT opponent_id IS NULL AND cardinality(key_points) = 2 FROM public.match_plans WHERE match_id = 'e0000000-0000-0000-0000-000000000001'), 'the plan stays when the sheet is deleted';
END $$;
RESET ROLE;
SELECT 'scouting smoke: OK' AS result;

-- ── watched players ──
SET ROLE authenticated;
-- the head coach files a player in the club's archive and watches him twice
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.scout_players (id, club_id, name, birth_year, current_club, position)
VALUES ('5d000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Observado', 2014, 'Outro Clube', 'ST');
INSERT INTO public.scout_player_observations (scout_player_id, technical, tactical, physical, mental, potential, recommendation)
VALUES ('5d000000-0000-0000-0000-000000000001', 4, 3, 3, 4, 5, 'follow');
DO $$ BEGIN
  -- a contact is only kept with permission
  BEGIN
    INSERT INTO public.scout_player_contacts (scout_player_id, contact, permission_given) VALUES ('5d000000-0000-0000-0000-000000000001', '912000000', false);
    RAISE EXCEPTION 'FAIL: contact kept without permission';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.scout_player_contacts (scout_player_id, contact, permission_given, permission_note) VALUES ('5d000000-0000-0000-0000-000000000001', 'Pai: 912000000', true, 'Dado pelo pai no fim do jogo');
END $$;

-- the assistant works on the sheet but does not read the contact
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_players WHERE id = '5d000000-0000-0000-0000-000000000001') = 1, 'assistant sees the watched player';
  ASSERT (SELECT count(*) FROM public.scout_player_observations WHERE scout_player_id = '5d000000-0000-0000-0000-000000000001') = 1, 'assistant sees the observations';
  INSERT INTO public.scout_player_observations (scout_player_id, technical, recommendation) VALUES ('5d000000-0000-0000-0000-000000000001', 5, 'trial');
  UPDATE public.scout_players SET status = 'following' WHERE id = '5d000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'assistant can move the player along';
  ASSERT (SELECT count(*) FROM public.scout_player_contacts) = 0, 'assistant does not read the contact';
  DELETE FROM public.scout_players WHERE id = '5d000000-0000-0000-0000-000000000001';
  ASSERT NOT FOUND, 'assistant cannot delete a sheet he did not create';
END $$;

-- outsider and parent: nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_players) = 0 AND (SELECT count(*) FROM public.scout_player_observations) = 0 AND (SELECT count(*) FROM public.scout_player_contacts) = 0, 'outsider sees no watched players';
  BEGIN
    INSERT INTO public.scout_player_observations (scout_player_id, technical) VALUES ('5d000000-0000-0000-0000-000000000001', 1);
    RAISE EXCEPTION 'FAIL: outsider wrote an observation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.scout_players (name, club_id) VALUES ('Intruso', 'c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: outsider filed a player in the club';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_players) = 0 AND (SELECT count(*) FROM public.scout_player_contacts) = 0, 'a parent sees nothing of the watched players';
END $$;

-- the club's administrator reads the contact and may delete the sheet (the contact goes with it)
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_player_contacts WHERE scout_player_id = '5d000000-0000-0000-0000-000000000001') = 1, 'club admin reads the contact';
  DELETE FROM public.scout_players WHERE id = '5d000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'club admin deletes the sheet';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.scout_player_contacts) = 0 AND (SELECT count(*) FROM public.scout_player_observations) = 0, 'contact and observations are gone with the sheet';
END $$;
SELECT 'player scouting smoke: OK' AS result;
