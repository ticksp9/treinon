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

-- ── Event answers: each one answers for himself; only the organisers see everybody ──
SET ROLE authenticated;
-- parent of the Sub-13 player goes to the team dinner with 3 people
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
INSERT INTO public.club_event_rsvps (event_id, status, people) VALUES ('98000000-0000-0000-0000-000000000001', 'yes', 3);
-- the second parent does not go
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', false);
INSERT INTO public.club_event_rsvps (event_id, status) VALUES ('98000000-0000-0000-0000-000000000001', 'no');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.club_event_rsvps) = 1, 'a parent sees only his own answer';
  ASSERT (SELECT count(*) FROM public.get_event_rsvps('98000000-0000-0000-0000-000000000001')) = 0, 'and cannot list the others';
  BEGIN
    INSERT INTO public.club_event_rsvps (event_id, user_id, status) VALUES ('98000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 'no');
    RAISE EXCEPTION 'answered for someone else';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN NULL;
  END;
END $$;
-- a parent of another club cannot answer an event he does not see
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.club_event_rsvps (event_id, status) VALUES ('98000000-0000-0000-0000-000000000001', 'yes');
    RAISE EXCEPTION 'answered an event of another club';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- the head coach who published it sees both answers with names and the children
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.club_event_rsvps WHERE event_id = '98000000-0000-0000-0000-000000000001') = 2, 'organiser sees all answers';
  ASSERT (SELECT sum(people) FROM public.get_event_rsvps('98000000-0000-0000-0000-000000000001') WHERE status = 'yes') = 3, 'three people are coming';
  ASSERT (SELECT players FROM public.get_event_rsvps('98000000-0000-0000-0000-000000000001') WHERE status = 'yes') = 'Rui', 'with the child''s name';
END $$;
RESET ROLE;

-- ── Coordinator alerts: two trainings missed without a reason; overdue fees ──
INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000031', 'coord@clube.pt');
INSERT INTO public.profiles (id, email, full_name, username) VALUES ('a0000000-0000-0000-0000-000000000031', 'coord@clube.pt', 'Coordenador', 'coord1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.club_staff (club_id, user_id, name, role, is_active) VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000031', 'Coordenador', 'coordenador', true);
INSERT INTO public.players (id, name, owner_id, team_id) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'Tiago', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000003', 'Vasco', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001');
INSERT INTO public.training_sessions (id, owner_id, team_id, date, status) VALUES
  ('97000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', current_date - 6, 'completed'),
  ('97000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', current_date - 4, 'completed'),
  ('97000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', current_date - 1, 'completed');
-- Rui: present, absent, absent (no reason)  -> alert
-- Tiago: absent, absent (ill), absent       -> no alert (a reason was given for one of the last two)
-- Vasco: absent, absent, present            -> no alert (came back)
INSERT INTO public.training_attendance (session_id, player_id, owner_id, present, notes) VALUES
  ('97000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', true, null),
  ('97000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', false, null),
  ('97000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', false, '  '),
  ('97000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', false, null),
  ('97000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', false, 'Doente, a mãe avisou'),
  ('97000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', false, null),
  ('97000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', false, null),
  ('97000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', false, null),
  ('97000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', true, null);

DO $$ BEGIN
  ASSERT (SELECT array_agg(player_name) FROM public.team_absence_alerts('b0000000-0000-0000-0000-000000000001')) = ARRAY['Rui'], 'only the player with two unexplained absences in a row';
  ASSERT 'coord@clube.pt' IN (SELECT email FROM public.team_coordinator_emails('b0000000-0000-0000-0000-000000000001')), 'the team coordinator is who gets warned';
  ASSERT (SELECT count(*) FROM public.team_coordinator_emails('b0000000-0000-0000-0000-000000000009')) = 0, 'a team without a club has no coordinator';
END $$;

SET ROLE authenticated;
-- the coordinator sees the alert and marks it as dealt with
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', false);
DO $$ DECLARE k text; BEGIN
  ASSERT (SELECT count(*) FROM public.get_coordinator_alerts() WHERE kind = 'absence' AND NOT resolved) = 1, 'coordinator sees the absence alert';
  SELECT ref_key INTO k FROM public.get_coordinator_alerts() WHERE kind = 'absence';
  PERFORM public.resolve_coordinator_alert('absence', 'd0000000-0000-0000-0000-000000000001', k, 'Falei com a mãe');
  ASSERT (SELECT resolved AND note = 'Falei com a mãe' FROM public.get_coordinator_alerts() WHERE kind = 'absence'), 'alert marked as dealt with, note kept';
  PERFORM public.resolve_coordinator_alert('absence', 'd0000000-0000-0000-0000-000000000001', k, NULL, false);
  ASSERT (SELECT NOT resolved FROM public.get_coordinator_alerts() WHERE kind = 'absence'), 'and can be reopened';
END $$;
-- a coach is not a coordinator: sees nothing and cannot resolve
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.get_coordinator_alerts()) = 0, 'a coach gets no coordinator alerts';
  BEGIN
    PERFORM public.resolve_coordinator_alert('absence', 'd0000000-0000-0000-0000-000000000001', 'x', NULL);
    RAISE EXCEPTION 'coach resolved an alert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- the club owner sees it too
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.get_coordinator_alerts() WHERE kind = 'absence') = 1, 'club admin sees the alerts';
END $$;
RESET ROLE;

-- ── Answers everywhere: deadline on events, match call-ups, trainings ──
DO $$ BEGIN
  -- parent 11 answered the dinner, parent 12 too; nobody pending with an account except none
  ASSERT (SELECT count(*) FROM public.event_pending_emails('98000000-0000-0000-0000-000000000001')) = 0, 'everyone invited to the dinner has answered';
  ASSERT (SELECT count(*) FROM public.event_pending_emails('98000000-0000-0000-0000-000000000002')) = 2, 'the club party still waits for both parents';
END $$;
UPDATE public.club_events SET rsvp_deadline = now() - interval '1 hour' WHERE id = '98000000-0000-0000-0000-000000000002';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  -- after the deadline the answer is refused
  BEGIN
    INSERT INTO public.club_event_rsvps (event_id, status) VALUES ('98000000-0000-0000-0000-000000000002', 'yes');
    RAISE EXCEPTION 'answered after the deadline';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- the parent sees the team's training sessions and says the child will miss one
  ASSERT (SELECT count(*) FROM public.training_sessions WHERE team_id = 'b0000000-0000-0000-0000-000000000001') = 3, 'parent sees the team sessions';
  INSERT INTO public.training_rsvps (session_id, player_id, status, reason) VALUES ('97000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'no', 'Doente');
  -- not for a child that is not his
  BEGIN
    INSERT INTO public.training_rsvps (session_id, player_id, status) VALUES ('97000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'no');
    RAISE EXCEPTION 'answered a training for someone else''s child';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- call-up: confirms his own child, not another player
  INSERT INTO public.callup_confirmations (match_id, player_id, confirmed_by, status, responded_at)
  VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 'confirmed', now());
  BEGIN
    INSERT INTO public.callup_confirmations (match_id, player_id, confirmed_by, status)
    VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011', 'declined');
    RAISE EXCEPTION 'confirmed a call-up for someone else''s child';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- a parent of another club sees none of it
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.training_sessions WHERE team_id = 'b0000000-0000-0000-0000-000000000001') = 0, 'other parent sees no sessions of this team';
  ASSERT (SELECT count(*) FROM public.training_rsvps) = 0, 'nor the answers';
END $$;
-- the coach sees who warned that he will miss the training, and the call-up answer
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  ASSERT (SELECT reason FROM public.training_rsvps WHERE session_id = '97000000-0000-0000-0000-000000000003') = 'Doente', 'coach sees the reason given by the parent';
  ASSERT (SELECT status FROM public.callup_confirmations WHERE match_id = 'e0000000-0000-0000-0000-000000000001' AND player_id = 'd0000000-0000-0000-0000-000000000001') = 'confirmed', 'coach sees the call-up confirmation';
END $$;
RESET ROLE;

-- ── Overdue fees for the daily job and for the coordinator's page ──
INSERT INTO public.charges (club_id, player_id, description, original_amount, final_amount, balance_due, due_date, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Mensalidade setembro', 25, 25, 25, current_date - 40, 'pending'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Mensalidade outubro', 25, 25, 10, current_date - 9, 'partial'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Mensalidade outubro', 25, 25, 0, current_date - 9, 'paid'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mensalidade novembro', 25, 25, 25, current_date + 20, 'pending');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.overdue_fee_alerts()) = 1, 'only the player with unpaid charges past the due date';
  ASSERT (SELECT items = 2 AND amount = 35 AND player_name = 'Tiago' AND since = current_date - 40 FROM public.overdue_fee_alerts()), 'two fees, 35 euros, since the oldest one';
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', false);
DO $$ BEGIN
  ASSERT (SELECT amount FROM public.get_coordinator_alerts() WHERE kind = 'payment') = 35, 'the coordinator page shows the same debt';
END $$;
RESET ROLE;
