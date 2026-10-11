-- Backup and restore (run last: reuses everything the other smoke tests created).
\set ON_ERROR_STOP 1
RESET ROLE;

-- ── the club's backup has what is the club's, and nothing of anyone else ──
CREATE TEMP TABLE _bk AS SELECT public.export_scope_data('c0000000-0000-0000-0000-000000000001', NULL) AS data;

DO $$
DECLARE b jsonb := (SELECT data FROM _bk); t jsonb := (SELECT data -> 'tables' FROM _bk);
  has_id boolean;
BEGIN
  ASSERT b ->> 'format' = 'treinon-backup', 'it says what it is';
  ASSERT jsonb_array_length(t -> 'clubs') = 1, 'the club';
  ASSERT jsonb_array_length(t -> 'teams') = (SELECT count(*) FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001'), 'its teams';
  ASSERT jsonb_array_length(t -> 'players') = (SELECT count(*) FROM players WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')), 'their players';
  ASSERT jsonb_array_length(t -> 'matches') = (SELECT count(*) FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')), 'their matches';
  ASSERT jsonb_array_length(t -> 'match_lineups') > 0 AND jsonb_array_length(t -> 'training_sessions') > 0 AND jsonb_array_length(t -> 'training_attendance') > 0, 'line-ups, trainings and attendance';
  ASSERT jsonb_array_length(t -> 'club_events') = 2, 'the club''s events (team and club-wide), not the other coach''s';
  -- tables without an id of their own come along too
  ASSERT jsonb_array_length(t -> 'player_private') > 0, 'the personal data of the players';
  ASSERT jsonb_array_length(t -> 'club_event_rsvps') = 2, 'the answers to the events';
  ASSERT jsonb_array_length(t -> 'guardian_consents') > 0, 'the parents'' consents';
  -- nothing from the coach without a club (team b…09, player d…09, his matches and his season)
  ASSERT NOT (t -> 'teams') @> '[{"id": "b0000000-0000-0000-0000-000000000009"}]', 'not another coach''s team';
  ASSERT NOT (t -> 'players') @> '[{"id": "d0000000-0000-0000-0000-000000000009"}]', 'nor his players';
  ASSERT NOT (t -> 'matches') @> '[{"id": "e0000000-0000-0000-0000-000000000092"}]', 'nor his matches';
  ASSERT NOT coalesce(t -> 'seasons', '[]') @> '[{"id": "5e000000-0000-0000-0000-000000000001"}]', 'nor his season';
  ASSERT NOT coalesce(t -> 'player_private', '[]') @> '[{"player_id": "d0000000-0000-0000-0000-000000000009"}]', 'nor his players'' personal data';
  -- the people of the club, without passwords
  ASSERT (b -> 'users') @> '[{"email": "admin@clube.pt"}]' AND (b -> 'users') @> '[{"email": "mae@familia.pt"}]', 'club owner and parents are listed';
  ASSERT NOT (b -> 'users') @> '[{"email": "outro.pai@familia.pt"}]', 'a parent of another team is not';
  ASSERT (b -> 'users')::text NOT ILIKE '%password%', 'no passwords in the file';
END $$;

-- ── the coach without a club gets his own things ──
DO $$
DECLARE t jsonb := public.export_scope_data(NULL, 'a0000000-0000-0000-0000-000000000004') -> 'tables';
BEGIN
  ASSERT (t -> 'teams') @> '[{"id": "b0000000-0000-0000-0000-000000000009"}]', 'his team';
  ASSERT (t -> 'players') @> '[{"id": "d0000000-0000-0000-0000-000000000009"}]', 'his player';
  ASSERT jsonb_array_length(t -> 'matches') = 2, 'his two matches';
  ASSERT (t -> 'seasons') @> '[{"id": "5e000000-0000-0000-0000-000000000001"}]', 'his season';
  ASSERT (t -> 'club_events') @> '[{"title": "Convivio"}]', 'his event';
  ASSERT NOT coalesce(t -> 'clubs', '[]') @> '[{"id": "c0000000-0000-0000-0000-000000000001"}]', 'not the club';
  ASSERT NOT (t -> 'players') @> '[{"id": "d0000000-0000-0000-0000-000000000001"}]', 'not the club''s players';
END $$;

-- ── restore: wipe the club (as a disaster, or a brand-new database) and load the file ──
CREATE TEMP TABLE _before AS
SELECT (SELECT count(*) FROM players WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')) AS players,
       (SELECT count(*) FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')) AS matches,
       (SELECT count(*) FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001'))) AS lineups,
       (SELECT parent_phone FROM player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') AS phone,
       (SELECT count(*) FROM club_event_rsvps) AS rsvps,
       (SELECT count(*) FROM players) AS all_players;

SET session_replication_role = replica;  -- delete without the cascades doing the work for us
DELETE FROM club_event_rsvps WHERE event_id IN (SELECT id FROM club_events WHERE club_id = 'c0000000-0000-0000-0000-000000000001');
DELETE FROM club_events WHERE club_id = 'c0000000-0000-0000-0000-000000000001';
DELETE FROM player_private WHERE player_id IN (SELECT id FROM players WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001'));
DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001'));
DELETE FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001');
DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001');
DELETE FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001';
DELETE FROM clubs WHERE id = 'c0000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE email = 'mae@familia.pt';
SET session_replication_role = origin;

DO $$
DECLARE res jsonb; b record;
BEGIN
  ASSERT (SELECT count(*) FROM clubs WHERE id = 'c0000000-0000-0000-0000-000000000001') = 0, 'the club is gone';
  res := public.import_backup_data((SELECT data FROM _bk));
  SELECT * INTO b FROM _before;
  ASSERT (SELECT count(*) FROM clubs WHERE id = 'c0000000-0000-0000-0000-000000000001') = 1, 'the club is back';
  ASSERT (SELECT count(*) FROM players WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')) = b.players, 'all the players are back';
  ASSERT (SELECT count(*) FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001')) = b.matches, 'all the matches';
  ASSERT (SELECT count(*) FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE team_id IN (SELECT id FROM teams WHERE club_id = 'c0000000-0000-0000-0000-000000000001'))) = b.lineups, 'all the line-ups';
  ASSERT (SELECT parent_phone FROM player_private WHERE player_id = 'd0000000-0000-0000-0000-000000000050') = b.phone, 'personal data exactly as it was';
  ASSERT (SELECT count(*) FROM club_event_rsvps) = b.rsvps, 'the answers to the events';
  ASSERT (SELECT count(*) FROM players) = b.all_players, 'and nobody else''s players were touched or duplicated';
  ASSERT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mae@familia.pt'), 'the missing account was created again';
  ASSERT (res ->> 'users_created')::int = 1, 'only the account that was missing';
  -- loading the same file twice changes nothing
  res := public.import_backup_data((SELECT data FROM _bk));
  ASSERT (SELECT count(*) FROM players) = b.all_players, 'loading twice does not duplicate';
  ASSERT (res ->> 'users_created')::int = 0, 'no account created the second time';
  ASSERT (res -> 'skipped') = '{}'::jsonb, format('nothing was skipped: %s', res -> 'skipped');
END $$;

-- a parent still cannot do any of this himself
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.export_scope_data('c0000000-0000-0000-0000-000000000001', NULL);
    RAISE EXCEPTION 'a signed-in user exported a club directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
