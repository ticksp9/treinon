-- Deleting an account (run last: it deletes people the other checks use).
\set ON_ERROR_STOP 1
RESET ROLE;
-- the head coach (a…02) created players and a match in the club team, and has a team of his own
INSERT INTO public.teams (id, name, owner_id, club_id, sport_type) VALUES ('b0000000-0000-0000-0000-0000000000a2', 'Equipa propria', 'a0000000-0000-0000-0000-000000000002', NULL, 'football_7');
INSERT INTO public.players (id, name, owner_id, team_id) VALUES ('d0000000-0000-0000-0000-0000000000a2', 'Proprio', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-0000000000a2');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.players WHERE owner_id = 'a0000000-0000-0000-0000-000000000002' AND team_id = 'b0000000-0000-0000-0000-000000000001') > 0, 'setup: the coach owns club players';
END $$;

SET ROLE authenticated;
-- the club owner cannot delete the account
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.delete_my_account('APAGAR');
    RAISE EXCEPTION 'FAIL: the club owner deleted his account';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
END $$;
-- the head coach sees what will happen, then deletes his account
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$
DECLARE p jsonb := public.account_deletion_preview();
BEGIN
  ASSERT (p->>'own_teams')::int = 1, 'preview: one team of his own';
  ASSERT (p->>'own_players')::int = 1, 'preview: one player of his own';
  BEGIN
    PERFORM public.delete_my_account('sim');
    RAISE EXCEPTION 'FAIL: deleted without the confirmation word';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT public.delete_my_account('APAGAR');
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000002'), 'the account is gone';
  ASSERT (SELECT count(*) FROM public.players WHERE team_id = 'b0000000-0000-0000-0000-000000000001' AND owner_id = 'a0000000-0000-0000-0000-000000000001') > 0, 'club players stay, now with the club owner';
  ASSERT (SELECT count(*) FROM public.matches WHERE team_id = 'b0000000-0000-0000-0000-000000000001') > 0, 'club matches stay';
  ASSERT NOT EXISTS (SELECT 1 FROM public.teams WHERE id = 'b0000000-0000-0000-0000-0000000000a2'), 'his own team went with the account';
  ASSERT NOT EXISTS (SELECT 1 FROM public.players WHERE id = 'd0000000-0000-0000-0000-0000000000a2'), 'his own player went with the account';
  ASSERT NOT EXISTS (SELECT 1 FROM public.team_coaches WHERE coach_id = 'a0000000-0000-0000-0000-000000000002'), 'no memberships left';
END $$;
SELECT 'account smoke: OK' AS result;
