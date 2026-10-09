-- Personal data of minors: who can read it (run after communication-smoke.sql; reuses its people).
\set ON_ERROR_STOP 1
RESET ROLE;

-- the head coach (club) registers a player with everything, as the form or the Excel import would
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.players (id, name, owner_id, team_id, birth_date, address, tax_id, parent_name, parent_phone, parent_email, id_document_number)
VALUES ('d0000000-0000-0000-0000-000000000050', 'Miguel', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        '2014-03-02', 'Rua das Flores 1', '123456789', 'Maria Costa', '912345678', 'maria@familia.pt', 'CC998877');
DO $$ BEGIN
  -- the coach keeps what he needs
  ASSERT (SELECT name = 'Miguel' AND birth_date = '2014-03-02' FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000050'), 'coach sees name and date of birth';
  -- and none of the personal data, by any route
  ASSERT (SELECT coalesce(address, tax_id, parent_name, parent_phone, parent_email, id_document_number) IS NULL FROM public.players WHERE id = 'd0000000-0000-0000-0000-000000000050'), 'personal columns are empty on the player';
  ASSERT (SELECT count(*) FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = 0, 'club coach cannot read the private data';
  ASSERT NOT public.can_see_player_private('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000050'), 'club coach has no access';
  ASSERT (SELECT count(*) FROM public.guardian_profiles) = 0, 'club coach cannot read the parents'' profiles';
  -- editing the player with the personal fields empty (as his form sends them) erases nothing
  UPDATE public.players SET number = 9, address = '', parent_phone = NULL, parent_email = '' WHERE id = 'd0000000-0000-0000-0000-000000000050';
  -- emergency: he gets the phone, and it is recorded
  ASSERT (SELECT parent_phone FROM public.get_emergency_contact('d0000000-0000-0000-0000-000000000050')) = '912345678', 'emergency contact works for the coach';
  BEGIN
    UPDATE public.player_private SET address = 'x' WHERE player_id = 'd0000000-0000-0000-0000-000000000050';
    ASSERT NOT FOUND, 'club coach cannot change private data directly';
  END;
END $$;

-- the coordinator and the club owner read everything; the edit by the coach erased nothing
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', false);
DO $$ BEGIN
  ASSERT (SELECT address = 'Rua das Flores 1' AND parent_phone = '912345678' AND parent_email = 'maria@familia.pt' AND tax_id = '123456789'
            FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050'), 'coordinator reads the private data, intact';
  UPDATE public.player_private SET parent_phone = '930000000' WHERE player_id = 'd0000000-0000-0000-0000-000000000050';
  ASSERT (SELECT count(*) FROM public.guardian_profiles) >= 2, 'coordinator reads the parents'' profiles';
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT parent_phone FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = '930000000', 'club owner reads it too';
  ASSERT (SELECT count(*) FROM public.player_private_access_log WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = 1, 'the emergency look is on record for the club';
END $$;

-- a parent reads his own child's data, not another child's
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT public.can_see_player_private('a0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001'), 'parent sees his child';
  ASSERT (SELECT count(*) FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = 0, 'parent does not see another child';
END $$;

-- a coach without a club is responsible for his players' data: he reads it
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
UPDATE public.players SET parent_phone = '960000000' WHERE id = 'd0000000-0000-0000-0000-000000000009';
DO $$ BEGIN
  ASSERT (SELECT parent_phone FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000009') = '960000000', 'coach without a club reads his players'' data';
  ASSERT (SELECT count(*) FROM public.player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = 0, 'but nothing of another club';
  BEGIN
    PERFORM * FROM public.get_emergency_contact('d0000000-0000-0000-0000-000000000050');
    RAISE EXCEPTION 'outsider got an emergency contact';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
