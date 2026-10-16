-- Medical department: who sees an injury and who sees the diagnosis (run after scouting-smoke.sql).
\set ON_ERROR_STOP 1
RESET ROLE;
-- a physio and a doctor for the club, and a player of the club team
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000051', 'fisio@clube.pt'),
  ('a0000000-0000-0000-0000-000000000052', 'medico@clube.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES
  ('a0000000-0000-0000-0000-000000000051', 'fisio@clube.pt', 'Fisio', 'fisio1'),
  ('a0000000-0000-0000-0000-000000000052', 'medico@clube.pt', 'Medico', 'medico1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.players (id, name, owner_id, team_id) VALUES
  ('d0000000-0000-0000-0000-000000000060', 'Lesionado', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001');

SET ROLE authenticated;
-- the club admin names them; a coach cannot
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
SELECT public.set_medical_staff('c0000000-0000-0000-0000-000000000001', 'FISIO@clube.pt', 'physio');
SELECT public.set_medical_staff('c0000000-0000-0000-0000-000000000001', 'medico@clube.pt', 'medico');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.club_medical_staff('c0000000-0000-0000-0000-000000000001')) = 2, 'two medical staff listed';
  BEGIN
    PERFORM public.set_medical_staff('c0000000-0000-0000-0000-000000000001', 'ninguem@nada.pt', 'physio');
    RAISE EXCEPTION 'FAIL: named somebody without an account';
  EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_medical_staff('c0000000-0000-0000-0000-000000000001', 'adjunto@clube.pt', 'physio');
    RAISE EXCEPTION 'FAIL: a coach named a physio';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- the head coach reports an injury, with what the doctor told him
INSERT INTO public.player_injuries (id, player_id, owner_id, injury_date, body_part, injury_type, mechanism, clinical_status, can_play, diagnosis, clinical_notes)
VALUES ('1e000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000060', 'a0000000-0000-0000-0000-000000000002', CURRENT_DATE, 'knee', 'sprain', 'contact', 'inapto', false, 'Entorse grau II LLI', 'Gelo 48h');
DO $$ BEGIN
  ASSERT (SELECT diagnosis IS NULL AND clinical_notes IS NULL FROM public.player_injuries WHERE id = '1e000000-0000-0000-0000-000000000001'), 'the diagnosis left the shared record';
  ASSERT (SELECT count(*) FROM public.player_injury_clinical) = 0, 'a club coach does not read the diagnosis';
  ASSERT (SELECT count(*) FROM public.player_injuries WHERE id = '1e000000-0000-0000-0000-000000000001') = 1, 'the coach sees the injury';
  ASSERT NOT public.can_see_injury_clinical('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000060'), 'club coach: no clinical access';
END $$;

-- the physio reads everything, assesses, writes the treatment
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000051', false);
DO $$ BEGIN
  ASSERT (SELECT diagnosis FROM public.player_injury_clinical WHERE injury_id = '1e000000-0000-0000-0000-000000000001') = 'Entorse grau II LLI', 'physio reads the diagnosis';
  UPDATE public.player_injuries SET assessed_at = now(), clinical_status = 'em_recuperacao', expected_return_date = CURRENT_DATE + 21 WHERE id = '1e000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'physio updates the injury';
  UPDATE public.player_injury_clinical SET treatment_plan = 'Fase 1: controlo da dor' WHERE injury_id = '1e000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'physio writes the treatment';
  ASSERT (SELECT count(*) FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000060') = 1, 'physio sees the club player';
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000052', false);
DO $$ BEGIN
  ASSERT (SELECT treatment_plan FROM public.player_injury_clinical WHERE injury_id = '1e000000-0000-0000-0000-000000000001') = 'Fase 1: controlo da dor', 'doctor reads it too';
END $$;

-- the club admin (leadership) sees the status, not the diagnosis
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT clinical_status FROM public.player_injuries WHERE id = '1e000000-0000-0000-0000-000000000001') = 'em_recuperacao', 'admin sees the status';
  ASSERT (SELECT count(*) FROM public.player_injury_clinical) = 0, 'admin does not read the diagnosis';
END $$;

-- outsider and the parent of another child: nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.player_injuries WHERE id = '1e000000-0000-0000-0000-000000000001') = 0, 'outsider sees no injury';
  ASSERT (SELECT count(*) FROM public.player_injury_clinical) = 0, 'outsider sees no clinical data';
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.player_injuries WHERE id = '1e000000-0000-0000-0000-000000000001') = 0, 'a parent of another child sees nothing';
END $$;

-- the physio is removed: access ends
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
SELECT public.set_medical_staff('c0000000-0000-0000-0000-000000000001', 'fisio@clube.pt', 'none');
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000051', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.player_injury_clinical) = 0, 'former physio reads nothing';
END $$;
RESET ROLE;
SELECT 'medical smoke: OK' AS result;
