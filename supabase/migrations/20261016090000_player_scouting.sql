-- Scouting, part 3: players we are watching (any age group, seniors included).
-- Same archive rules as the opponents' sheets:
--   club_id set  -> the club's archive, for its coaches and staff
--   club_id null -> the coach's own, shared with the staff of his teams
-- A watched player is somebody from outside: the sheet keeps football data only.
-- A contact (the player's, or the parents' of a minor) lives in a separate table that only
-- who wrote it and the club's administrator can read, and only with permission recorded.

CREATE TABLE IF NOT EXISTS public.scout_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  birth_date date,
  birth_year smallint CHECK (birth_year IS NULL OR birth_year BETWEEN 1950 AND 2100),
  current_club text CHECK (current_club IS NULL OR char_length(current_club) <= 120),
  category text CHECK (category IS NULL OR char_length(category) <= 60),
  sport_type text NOT NULL DEFAULT 'football_11',
  position text CHECK (position IS NULL OR char_length(position) <= 20),
  other_positions text CHECK (other_positions IS NULL OR char_length(other_positions) <= 60),
  foot text CHECK (foot IS NULL OR foot IN ('right', 'left', 'both')),
  height_cm smallint CHECK (height_cm IS NULL OR height_cm BETWEEN 80 AND 230),
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'following', 'priority', 'trial', 'signed', 'discarded')),
  found_at text CHECK (found_at IS NULL OR char_length(found_at) <= 200),
  video_links text[] NOT NULL DEFAULT '{}' CHECK (cardinality(video_links) <= 10),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_players_owner_idx ON public.scout_players (owner_id, status);
CREATE INDEX IF NOT EXISTS scout_players_club_idx ON public.scout_players (club_id, status);

-- one row per time the player was watched: marks 1 to 5 in each area
CREATE TABLE IF NOT EXISTS public.scout_player_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_player_id uuid NOT NULL REFERENCES public.scout_players(id) ON DELETE CASCADE,
  observed_on date NOT NULL DEFAULT CURRENT_DATE,
  context text CHECK (context IS NULL OR char_length(context) <= 160),
  position_played text CHECK (position_played IS NULL OR char_length(position_played) <= 20),
  minutes_seen smallint CHECK (minutes_seen IS NULL OR minutes_seen BETWEEN 0 AND 200),
  technical smallint CHECK (technical IS NULL OR technical BETWEEN 1 AND 5),
  tactical smallint CHECK (tactical IS NULL OR tactical BETWEEN 1 AND 5),
  physical smallint CHECK (physical IS NULL OR physical BETWEEN 1 AND 5),
  mental smallint CHECK (mental IS NULL OR mental BETWEEN 1 AND 5),
  potential smallint CHECK (potential IS NULL OR potential BETWEEN 1 AND 5),
  strengths text CHECK (strengths IS NULL OR char_length(strengths) <= 2000),
  weaknesses text CHECK (weaknesses IS NULL OR char_length(weaknesses) <= 2000),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  recommendation text CHECK (recommendation IS NULL OR recommendation IN ('sign', 'trial', 'follow', 'discard')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_player_observations_idx ON public.scout_player_observations (scout_player_id, observed_on DESC);

-- the contact: apart from the sheet, and only with permission
CREATE TABLE IF NOT EXISTS public.scout_player_contacts (
  scout_player_id uuid PRIMARY KEY REFERENCES public.scout_players(id) ON DELETE CASCADE,
  contact text NOT NULL CHECK (char_length(trim(contact)) BETWEEN 1 AND 300),
  permission_given boolean NOT NULL CHECK (permission_given),
  permission_note text CHECK (permission_note IS NULL OR char_length(permission_note) <= 300),
  noted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_use_scout_player(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT public.can_use_opponent_archive(_user, p.owner_id, p.club_id)
                     FROM public.scout_players p WHERE p.id = _player), false)
$$;
REVOKE ALL ON FUNCTION public.can_use_scout_player(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_scout_player(uuid, uuid) TO authenticated;

-- the contact: who created the sheet, who wrote the contact, or the club's administrator
CREATE OR REPLACE FUNCTION public.can_see_scout_contact(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND coalesce((
    SELECT p.owner_id = _user
           OR (p.club_id IS NOT NULL AND public.is_club_admin(_user, p.club_id))
           OR EXISTS (SELECT 1 FROM public.scout_player_contacts c WHERE c.scout_player_id = p.id AND c.noted_by = _user)
      FROM public.scout_players p WHERE p.id = _player), false)
$$;
REVOKE ALL ON FUNCTION public.can_see_scout_contact(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_scout_contact(uuid, uuid) TO authenticated;

ALTER TABLE public.scout_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_player_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_player_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scout_players_read" ON public.scout_players;
CREATE POLICY "scout_players_read" ON public.scout_players FOR SELECT TO authenticated
  USING (public.can_use_opponent_archive(auth.uid(), owner_id, club_id));
DROP POLICY IF EXISTS "scout_players_insert" ON public.scout_players;
CREATE POLICY "scout_players_insert" ON public.scout_players FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
              AND (club_id IS NULL OR public.is_club_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id) OR public.is_club_staff_member(club_id, auth.uid())));
DROP POLICY IF EXISTS "scout_players_update" ON public.scout_players;
CREATE POLICY "scout_players_update" ON public.scout_players FOR UPDATE TO authenticated
  USING (public.can_use_opponent_archive(auth.uid(), owner_id, club_id))
  WITH CHECK (public.can_use_opponent_archive(auth.uid(), owner_id, club_id));
DROP POLICY IF EXISTS "scout_players_delete" ON public.scout_players;
CREATE POLICY "scout_players_delete" ON public.scout_players FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id)));

DROP TRIGGER IF EXISTS scout_players_guard ON public.scout_players;
CREATE TRIGGER scout_players_guard BEFORE UPDATE ON public.scout_players
  FOR EACH ROW EXECUTE FUNCTION public.scout_opponents_guard();

DROP POLICY IF EXISTS "scout_player_observations_all" ON public.scout_player_observations;
CREATE POLICY "scout_player_observations_all" ON public.scout_player_observations FOR ALL TO authenticated
  USING (public.can_use_scout_player(auth.uid(), scout_player_id))
  WITH CHECK (public.can_use_scout_player(auth.uid(), scout_player_id));
DROP TRIGGER IF EXISTS scout_player_observations_touch ON public.scout_player_observations;
CREATE TRIGGER scout_player_observations_touch BEFORE UPDATE ON public.scout_player_observations
  FOR EACH ROW EXECUTE FUNCTION public.scout_touch_updated_at();

DROP POLICY IF EXISTS "scout_player_contacts_read" ON public.scout_player_contacts;
CREATE POLICY "scout_player_contacts_read" ON public.scout_player_contacts FOR SELECT TO authenticated
  USING (public.can_see_scout_contact(auth.uid(), scout_player_id));
-- anybody working on the sheet may record a contact he was given; he then keeps seeing it
DROP POLICY IF EXISTS "scout_player_contacts_insert" ON public.scout_player_contacts;
CREATE POLICY "scout_player_contacts_insert" ON public.scout_player_contacts FOR INSERT TO authenticated
  WITH CHECK (noted_by = auth.uid() AND public.can_use_scout_player(auth.uid(), scout_player_id));
DROP POLICY IF EXISTS "scout_player_contacts_update" ON public.scout_player_contacts;
CREATE POLICY "scout_player_contacts_update" ON public.scout_player_contacts FOR UPDATE TO authenticated
  USING (public.can_see_scout_contact(auth.uid(), scout_player_id))
  WITH CHECK (public.can_see_scout_contact(auth.uid(), scout_player_id));
DROP POLICY IF EXISTS "scout_player_contacts_delete" ON public.scout_player_contacts;
CREATE POLICY "scout_player_contacts_delete" ON public.scout_player_contacts FOR DELETE TO authenticated
  USING (public.can_see_scout_contact(auth.uid(), scout_player_id));
DROP TRIGGER IF EXISTS scout_player_contacts_touch ON public.scout_player_contacts;
CREATE TRIGGER scout_player_contacts_touch BEFORE UPDATE ON public.scout_player_contacts
  FOR EACH ROW EXECUTE FUNCTION public.scout_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_players, public.scout_player_observations, public.scout_player_contacts TO authenticated;
REVOKE ALL ON public.scout_players, public.scout_player_observations, public.scout_player_contacts FROM anon;
