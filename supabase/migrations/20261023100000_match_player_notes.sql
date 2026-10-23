-- The coach's notes about each of our players in a match (written in the match report).
-- Kept apart from match_lineups on purpose: parents and players can read their own lineup rows,
-- but these notes are for the coaching staff only.
CREATE TABLE IF NOT EXISTS public.match_player_notes (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS match_player_notes_player_idx ON public.match_player_notes (player_id);

CREATE OR REPLACE FUNCTION public.match_player_notes_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- only a change of the text is a new edit (deleting an account just clears updated_by)
  IF NEW.note IS DISTINCT FROM OLD.note THEN
    NEW.updated_at := now();
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS match_player_notes_touch ON public.match_player_notes;
CREATE TRIGGER match_player_notes_touch BEFORE UPDATE ON public.match_player_notes
  FOR EACH ROW EXECUTE FUNCTION public.match_player_notes_touch();

ALTER TABLE public.match_player_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Match staff only" ON public.match_player_notes;
CREATE POLICY "Match staff only" ON public.match_player_notes FOR ALL TO authenticated
  USING (public.can_coach_match(auth.uid(), match_id))
  WITH CHECK (public.can_coach_match(auth.uid(), match_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_player_notes TO authenticated;
REVOKE ALL ON public.match_player_notes FROM anon;
