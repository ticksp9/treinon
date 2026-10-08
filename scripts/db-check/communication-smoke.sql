-- Team groups fill themselves (run after team-staff-smoke.sql: reuses its club, team, coaches and player).
\set ON_ERROR_STOP 1
RESET ROLE;

-- two parents: one already linked to the player, one linked later
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000011', 'mae@familia.pt'),
  ('a0000000-0000-0000-0000-000000000012', 'pai@familia.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES
  ('a0000000-0000-0000-0000-000000000011', 'mae@familia.pt', 'Mae', 'mae1'),
  ('a0000000-0000-0000-0000-000000000012', 'pai@familia.pt', 'Pai', 'pai1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.guardian_profiles (id, user_id, full_name, email) VALUES
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'Mae', 'mae@familia.pt'),
  ('f0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'Pai', 'pai@familia.pt');
INSERT INTO public.player_guardians (player_id, guardian_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000011');

-- the head coach creates the parents' group of the team
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.communication_channels (id, club_id, created_by, name, channel_type, team_id, allow_guardians, allow_coaches)
VALUES ('99000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Pais Sub-13', 'team', 'b0000000-0000-0000-0000-000000000001', true, true);
-- and a staff-only group
INSERT INTO public.communication_channels (id, club_id, created_by, name, channel_type, team_id, allow_guardians, allow_coaches)
VALUES ('99000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Equipa tecnica', 'team', 'b0000000-0000-0000-0000-000000000001', false, true);
RESET ROLE;

DO $$
DECLARE
  parents CONSTANT uuid := '99000000-0000-0000-0000-000000000001';
  staff CONSTANT uuid := '99000000-0000-0000-0000-000000000002';
  has boolean;
BEGIN
  -- owner + 2 coaches + the linked parent
  ASSERT (SELECT count(*) FROM communication_channel_members WHERE channel_id = parents) = 4, 'parents group: owner, 2 coaches and the linked parent';
  ASSERT (SELECT role FROM communication_channel_members WHERE channel_id = parents AND user_id = 'a0000000-0000-0000-0000-000000000001') = 'admin', 'team owner manages the group';
  ASSERT EXISTS (SELECT 1 FROM communication_channel_members WHERE channel_id = parents AND user_id = 'a0000000-0000-0000-0000-000000000011' AND profile_type = 'guardian'), 'linked parent is in';
  ASSERT NOT EXISTS (SELECT 1 FROM communication_channel_members WHERE channel_id = parents AND user_id = 'a0000000-0000-0000-0000-000000000004'), 'outsider is not in';
  -- staff group has no parents
  ASSERT (SELECT count(*) FROM communication_channel_members WHERE channel_id = staff) = 3, 'staff group: owner and 2 coaches';

  -- a parent linked later joins the parents group only
  INSERT INTO player_guardians (player_id, guardian_id) VALUES ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000012');
  ASSERT EXISTS (SELECT 1 FROM communication_channel_members WHERE channel_id = parents AND user_id = 'a0000000-0000-0000-0000-000000000012'), 'parent linked later joins';
  ASSERT NOT EXISTS (SELECT 1 FROM communication_channel_members WHERE channel_id = staff AND user_id = 'a0000000-0000-0000-0000-000000000012'), 'but not the staff group';

  -- opening the staff group to parents brings them in
  UPDATE communication_channels SET allow_guardians = true WHERE id = staff;
  ASSERT (SELECT count(*) FROM communication_channel_members WHERE channel_id = staff) = 5, 'opening a group to parents adds them';

  -- private groups are never filled automatically
  INSERT INTO communication_channels (id, club_id, created_by, name, channel_type, team_id, allow_guardians, visibility_scope)
  VALUES ('99000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Privado', 'team', 'b0000000-0000-0000-0000-000000000001', true, 'private');
  ASSERT (SELECT count(*) FROM communication_channel_members WHERE channel_id = '99000000-0000-0000-0000-000000000003') = 0, 'private group stays empty';
END $$;

-- the parent can read the group and its messages; the outsider cannot
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.communication_messages (channel_id, sender_id, content) VALUES ('99000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Treino amanha as 18h');
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM communication_channels WHERE id = '99000000-0000-0000-0000-000000000001') = 1, 'parent sees the group';
  ASSERT (SELECT count(*) FROM communication_messages WHERE channel_id = '99000000-0000-0000-0000-000000000001') = 1, 'parent reads the message';
END $$;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM communication_messages WHERE channel_id = '99000000-0000-0000-0000-000000000001') = 0, 'outsider reads nothing';
END $$;
RESET ROLE;

-- ── Events: parents and players see what concerns their team / club, nothing else ──
-- a second club with its own team and parent (must never see club 1's events)
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000021', 'outro.pai@familia.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES ('a0000000-0000-0000-0000-000000000021', 'outro.pai@familia.pt', 'Outro Pai', 'opai1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.teams (id, name, owner_id, sport_type) VALUES ('b0000000-0000-0000-0000-000000000009', 'Outra equipa', 'a0000000-0000-0000-0000-000000000004', 'football_7');
INSERT INTO public.players (id, name, owner_id, team_id) VALUES ('d0000000-0000-0000-0000-000000000009', 'Outro', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000009');
INSERT INTO public.guardian_profiles (id, user_id, full_name) VALUES ('f0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000021', 'Outro Pai');
INSERT INTO public.player_guardians (player_id, guardian_id) VALUES ('d0000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000021');

-- head coach: a dinner for his team
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.club_events (id, club_id, team_id, title, kind, starts_at)
VALUES ('98000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Jantar da equipa', 'social', now() + interval '5 days');
-- but a coach cannot publish for the whole club
DO $$ BEGIN
  BEGIN
    INSERT INTO public.club_events (club_id, title, starts_at) VALUES ('c0000000-0000-0000-0000-000000000001', 'Festa do clube', now() + interval '9 days');
    RAISE EXCEPTION 'coach published a club-wide event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- the club owner can
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
INSERT INTO public.club_events (id, club_id, title, kind, starts_at)
VALUES ('98000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Festa do clube', 'activity', now() + interval '9 days');
-- the outsider coach: an event for all his own teams
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
INSERT INTO public.club_events (id, title, starts_at) VALUES ('98000000-0000-0000-0000-000000000003', 'Convivio', now() + interval '3 days');
-- and he cannot publish into someone else's team
DO $$ BEGIN
  BEGIN
    INSERT INTO public.club_events (club_id, team_id, title, starts_at) VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Intruso', now());
    RAISE EXCEPTION 'outsider published in another team';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- the parent of the Sub-13 player: team dinner + club party, not the other coach's event
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.club_events) = 2, 'parent sees the team event and the club event';
  ASSERT (SELECT count(*) FROM public.my_family_teams()) = 1, 'parent has one child in one team';
  ASSERT (SELECT count(*) FROM public.matches WHERE team_id = 'b0000000-0000-0000-0000-000000000001') >= 1, 'parent sees the team matches';
  BEGIN
    INSERT INTO public.club_events (club_id, team_id, title, starts_at) VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Pai a publicar', now());
    RAISE EXCEPTION 'a parent published an event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- the parent of the other team: only his coach's event
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', false);
DO $$ BEGIN
  ASSERT (SELECT array_agg(title) FROM public.club_events) = ARRAY['Convivio'], 'other parent sees only his coach''s event';
  ASSERT (SELECT count(*) FROM public.matches WHERE team_id = 'b0000000-0000-0000-0000-000000000001') = 0, 'and none of the other club''s matches';
END $$;
-- the assistant coach of the team sees both club events
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.club_events) = 2, 'assistant sees team and club events';
END $$;
RESET ROLE;
