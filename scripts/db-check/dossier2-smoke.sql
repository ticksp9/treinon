-- Training dossier, phase 2: objectives (team and player), the club's guiding document, the space of
-- the training slots, materials and the written match review (run after dossier-smoke.sql).
\set ON_ERROR_STOP 1
RESET ROLE;

-- the head coach writes a team objective, a player objective and the match review
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.dossier_objectives (team_id, season_id, objective, indicator, target, deadline, evaluation)
VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', 'Sair a jogar desde o guarda-redes', 'Saídas curtas com sucesso', '60%', '2026-12-20', 'Vídeo de 3 jogos');
INSERT INTO public.dossier_objectives (team_id, season_id, player_id, objective, target)
VALUES ('b0000000-0000-0000-0000-000000000001', '5e0000d0-0000-0000-0000-0000000000d1', 'd0000000-0000-0000-0000-000000000001', 'Receção orientada com o pé esquerdo', '7 em 10');
INSERT INTO public.match_reviews (match_id, positives, improve) VALUES ('e0000000-0000-0000-0000-000000000001', 'Pressão alta', 'Bolas paradas defensivas');
UPDATE public.team_season_plans SET materials = '20 bolas n.º 4, 30 sinalizadores' WHERE team_id = 'b0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  ASSERT (SELECT updated_by FROM dossier_objectives WHERE player_id IS NOT NULL) = 'a0000000-0000-0000-0000-000000000002', 'who wrote the objective';
  ASSERT (SELECT materials FROM team_season_plans WHERE team_id = 'b0000000-0000-0000-0000-000000000001') LIKE '20 bolas%', 'materials saved';
  -- an objective for a player of another team is refused
  BEGIN
    INSERT INTO public.dossier_objectives (team_id, player_id, objective) VALUES ('b0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'X');
    RAISE EXCEPTION 'FAIL: objective for a player outside the team';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL;
  END;
  -- a coach does not write the club's guiding document
  BEGIN
    INSERT INTO public.club_guidelines (club_id, content) VALUES ('c0000000-0000-0000-0000-000000000001', '{"vision":"x"}');
    RAISE EXCEPTION 'FAIL: coach wrote the club guidelines';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- …but keeps their own when they have no club
INSERT INTO public.club_guidelines (owner_id, content) VALUES ('a0000000-0000-0000-0000-000000000002', '{"vision":"A minha forma de jogar"}');

-- the coordinator writes the guiding document and the space of a slot
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', false);
INSERT INTO public.club_guidelines (club_id, content)
VALUES ('c0000000-0000-0000-0000-000000000001', '{"vision":"Formar jogadores inteligentes","models":{"9":{"system":"1-3-3-2"}}}');
UPDATE public.team_training_slots SET space = 'half' WHERE team_id = 'b0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM team_training_slots WHERE space = 'half') = 1, 'space saved';
  BEGIN
    UPDATE public.team_training_slots SET space = 'garden';
    RAISE EXCEPTION 'FAIL: unknown space';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- the assistant and the head coach read the club's document but cannot change it
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
UPDATE public.club_guidelines SET content = '{"vision":"mudado"}' WHERE club_id IS NOT NULL;
DO $$ BEGIN
  ASSERT (SELECT content->>'vision' FROM club_guidelines WHERE club_id = 'c0000000-0000-0000-0000-000000000001') = 'Formar jogadores inteligentes', 'assistant reads, cannot change';
  ASSERT (SELECT count(*) FROM club_guidelines WHERE owner_id IS NOT NULL) = 0, 'someone else''s own document stays private';
  ASSERT (SELECT count(*) FROM dossier_objectives) = 2, 'the assistant sees the objectives';
END $$;
-- the club admin reads the match review (the assistant may have the matches permission taken away)
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM match_reviews) = 1, 'the club admin sees the match review';
END $$;

-- someone from outside sees nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM dossier_objectives) = 0, 'outsider: no objectives';
  ASSERT (SELECT count(*) FROM match_reviews) = 0, 'outsider: no match review';
  ASSERT (SELECT count(*) FROM club_guidelines) = 0, 'outsider: no guiding document';
  BEGIN
    INSERT INTO public.match_reviews (match_id, positives) VALUES ('e0000000-0000-0000-0000-000000000001', 'x');
    RAISE EXCEPTION 'FAIL: outsider wrote a match review';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'dossier phase 2 smoke: OK' AS result;
