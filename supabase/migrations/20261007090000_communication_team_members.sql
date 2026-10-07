-- Team groups fill themselves: whoever belongs to the team is in its group.
-- Before, a group only had its creator unless people accepted an invite AFTER the
-- group existed, so a coach creating "Pais Sub-13" ended up talking alone.

CREATE OR REPLACE FUNCTION public.sync_team_channel_members(_channel uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.communication_channels%ROWTYPE;
  n integer := 0;
BEGIN
  SELECT * INTO c FROM public.communication_channels WHERE id = _channel;
  IF NOT FOUND OR c.team_id IS NULL OR NOT c.is_active
     OR c.visibility_scope IN ('private', 'restricted', 'restricted_internal')
     -- internal and role groups are filled by hand / by invite, never from the team list
     OR c.channel_type IN ('restricted_internal', 'coaches_internal', 'staff_internal', 'coordination_internal', 'role_based') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.communication_channel_members (channel_id, user_id, role, membership_origin, profile_type)
  SELECT DISTINCT ON (x.user_id) _channel, x.user_id, x.role, 'auto_team', x.ptype
  FROM (
    -- the owner of the team always manages its groups
    SELECT t.owner_id AS user_id, 'admin'::text AS role, 'coach'::text AS ptype, 1 AS ord
      FROM public.teams t WHERE t.id = c.team_id
    UNION ALL
    SELECT tc.coach_id, 'member', 'coach', 2
      FROM public.team_coaches tc WHERE tc.team_id = c.team_id AND c.allow_coaches
    UNION ALL
    SELECT gp.user_id, 'member', 'guardian', 3
      FROM public.players p
      JOIN public.player_guardians pg ON pg.player_id = p.id
      JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
      WHERE p.team_id = c.team_id AND c.allow_guardians
    UNION ALL
    SELECT pa.user_id, 'member', 'player', 4
      FROM public.players p
      JOIN public.player_accounts pa ON pa.player_id = p.id
      WHERE p.team_id = c.team_id AND c.allow_players
  ) x
  WHERE x.user_id IS NOT NULL
  ORDER BY x.user_id, x.ord
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sync_team_channel_members(uuid) FROM PUBLIC, anon, authenticated;

-- a group is created, moved to a team, or opened to parents/players/coaches
CREATE OR REPLACE FUNCTION public.trg_channel_sync_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_team_channel_members(NEW.id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_channel_sync_members() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS channel_sync_members ON public.communication_channels;
CREATE TRIGGER channel_sync_members
  AFTER INSERT OR UPDATE OF team_id, allow_guardians, allow_players, allow_coaches, visibility_scope, is_active, channel_type
  ON public.communication_channels
  FOR EACH ROW EXECUTE FUNCTION public.trg_channel_sync_members();

-- someone joins the team later (parent linked, player account, new coach, player changes team)
CREATE OR REPLACE FUNCTION public.trg_team_people_sync_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _team uuid;
  ch record;
BEGIN
  IF TG_TABLE_NAME = 'team_coaches' THEN
    _team := NEW.team_id;
  ELSIF TG_TABLE_NAME = 'players' THEN
    _team := NEW.team_id;
  ELSE
    SELECT p.team_id INTO _team FROM public.players p WHERE p.id = NEW.player_id;
  END IF;
  IF _team IS NOT NULL THEN
    FOR ch IN SELECT id FROM public.communication_channels WHERE team_id = _team AND is_active LOOP
      PERFORM public.sync_team_channel_members(ch.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_team_people_sync_channels() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS team_people_sync_channels ON public.player_guardians;
CREATE TRIGGER team_people_sync_channels AFTER INSERT ON public.player_guardians
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_people_sync_channels();

DROP TRIGGER IF EXISTS team_people_sync_channels ON public.player_accounts;
CREATE TRIGGER team_people_sync_channels AFTER INSERT ON public.player_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_people_sync_channels();

DROP TRIGGER IF EXISTS team_people_sync_channels ON public.team_coaches;
CREATE TRIGGER team_people_sync_channels AFTER INSERT ON public.team_coaches
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_people_sync_channels();

DROP TRIGGER IF EXISTS team_people_sync_channels ON public.players;
CREATE TRIGGER team_people_sync_channels AFTER UPDATE OF team_id ON public.players
  FOR EACH ROW WHEN (NEW.team_id IS DISTINCT FROM OLD.team_id)
  EXECUTE FUNCTION public.trg_team_people_sync_channels();

-- groups that already exist get the people who should have been there
DO $$
DECLARE ch record;
BEGIN
  FOR ch IN SELECT id FROM public.communication_channels WHERE team_id IS NOT NULL AND is_active LOOP
    PERFORM public.sync_team_channel_members(ch.id);
  END LOOP;
END $$;
