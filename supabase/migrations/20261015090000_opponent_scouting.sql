-- Scouting, part 1: the opponents a team is going to face.
-- One sheet per opposing team, kept from match to match: how they play (tactical schemes
-- drawn on the board, by moment of the game), their squad and what was seen in each match.
--   club_id set  -> the club's archive: every coach and staff member of the club works on it
--   club_id null -> the coach's own archive, shared with the staff of his teams (assistants)
-- Parents and players never see any of this.

CREATE TABLE IF NOT EXISTS public.scout_opponents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  category text CHECK (category IS NULL OR char_length(category) <= 60),
  sport_type text NOT NULL DEFAULT 'football_11',
  competition text CHECK (competition IS NULL OR char_length(competition) <= 120),
  coach_name text CHECK (coach_name IS NULL OR char_length(coach_name) <= 120),
  usual_formation text CHECK (usual_formation IS NULL OR char_length(usual_formation) <= 20),
  strengths text CHECK (strengths IS NULL OR char_length(strengths) <= 4000),
  weaknesses text CHECK (weaknesses IS NULL OR char_length(weaknesses) <= 4000),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_opponents_owner_idx ON public.scout_opponents (owner_id, name);
CREATE INDEX IF NOT EXISTS scout_opponents_club_idx ON public.scout_opponents (club_id, name);

-- their squad: number, position, foot and what to remember about each one
CREATE TABLE IF NOT EXISTS public.scout_opponent_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES public.scout_opponents(id) ON DELETE CASCADE,
  shirt_number text CHECK (shirt_number IS NULL OR char_length(shirt_number) <= 3),
  name text CHECK (name IS NULL OR char_length(name) <= 120),
  position text CHECK (position IS NULL OR char_length(position) <= 20),
  foot text CHECK (foot IS NULL OR foot IN ('right', 'left', 'both')),
  is_key boolean NOT NULL DEFAULT false,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coalesce(nullif(trim(shirt_number), ''), nullif(trim(name), '')) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS scout_opponent_players_idx ON public.scout_opponent_players (opponent_id);

-- how they play: one drawing (a tactical board) per idea, filed under a moment of the game
CREATE TABLE IF NOT EXISTS public.scout_opponent_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES public.scout_opponents(id) ON DELETE CASCADE,
  moment text NOT NULL CHECK (moment IN ('attack', 'defense', 'transition_attack', 'transition_defense', 'set_piece_for', 'set_piece_against')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 4000),
  board_data jsonb NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_opponent_schemes_idx ON public.scout_opponent_schemes (opponent_id, moment);

-- what was seen in each match watched
CREATE TABLE IF NOT EXISTS public.scout_opponent_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES public.scout_opponents(id) ON DELETE CASCADE,
  observed_on date NOT NULL DEFAULT CURRENT_DATE,
  against text CHECK (against IS NULL OR char_length(against) <= 120),
  result text CHECK (result IS NULL OR char_length(result) <= 20),
  formation text CHECK (formation IS NULL OR char_length(formation) <= 20),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 8000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scout_opponent_observations_idx ON public.scout_opponent_observations (opponent_id, observed_on DESC);

-- ── who works on an opponent's sheet ──
CREATE OR REPLACE FUNCTION public.can_use_opponent_archive(_user uuid, _owner uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND coalesce(
    _owner = _user
    OR (_club IS NOT NULL AND (
          public.is_club_admin(_user, _club)
          OR public.is_club_coach(_user, _club)
          OR public.is_club_staff_member(_club, _user)))
    OR (_club IS NULL AND public.shares_team_staff(_user, _owner)), false)
$$;
REVOKE ALL ON FUNCTION public.can_use_opponent_archive(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_opponent_archive(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_use_opponent(_user uuid, _opponent uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT public.can_use_opponent_archive(_user, o.owner_id, o.club_id)
                     FROM public.scout_opponents o WHERE o.id = _opponent), false)
$$;
REVOKE ALL ON FUNCTION public.can_use_opponent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_opponent(uuid, uuid) TO authenticated;

ALTER TABLE public.scout_opponents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_opponent_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_opponent_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_opponent_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scout_opponents_read" ON public.scout_opponents;
CREATE POLICY "scout_opponents_read" ON public.scout_opponents FOR SELECT TO authenticated
  USING (public.can_use_opponent_archive(auth.uid(), owner_id, club_id));

-- a new sheet is the creator's; in a club it goes to a club he really belongs to
DROP POLICY IF EXISTS "scout_opponents_insert" ON public.scout_opponents;
CREATE POLICY "scout_opponents_insert" ON public.scout_opponents FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.can_use_opponent_archive(auth.uid(), owner_id, club_id)
              AND (club_id IS NULL OR public.is_club_admin(auth.uid(), club_id) OR public.is_club_coach(auth.uid(), club_id) OR public.is_club_staff_member(club_id, auth.uid())));

DROP POLICY IF EXISTS "scout_opponents_update" ON public.scout_opponents;
CREATE POLICY "scout_opponents_update" ON public.scout_opponents FOR UPDATE TO authenticated
  USING (public.can_use_opponent_archive(auth.uid(), owner_id, club_id))
  WITH CHECK (public.can_use_opponent_archive(auth.uid(), owner_id, club_id));

-- only who created it (or the club's administrator) throws a whole sheet away
DROP POLICY IF EXISTS "scout_opponents_delete" ON public.scout_opponents;
CREATE POLICY "scout_opponents_delete" ON public.scout_opponents FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id)));

-- a sheet does not change hands or clubs behind the creator's back
CREATE OR REPLACE FUNCTION public.scout_opponents_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.club_id IS DISTINCT FROM OLD.club_id) THEN
    RAISE EXCEPTION 'the owner and the club of an opponent sheet cannot be changed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS scout_opponents_guard ON public.scout_opponents;
CREATE TRIGGER scout_opponents_guard BEFORE UPDATE ON public.scout_opponents
  FOR EACH ROW EXECUTE FUNCTION public.scout_opponents_guard();

CREATE OR REPLACE FUNCTION public.scout_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scout_opponent_players', 'scout_opponent_schemes', 'scout_opponent_observations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_use_opponent(auth.uid(), opponent_id)) WITH CHECK (public.can_use_opponent(auth.uid(), opponent_id))', t || '_all', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.scout_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_opponents, public.scout_opponent_players, public.scout_opponent_schemes, public.scout_opponent_observations TO authenticated;
REVOKE ALL ON public.scout_opponents, public.scout_opponent_players, public.scout_opponent_schemes, public.scout_opponent_observations FROM anon;
