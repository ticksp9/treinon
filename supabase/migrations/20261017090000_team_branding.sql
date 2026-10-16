-- The team's own look: its crest and its colours.
--   teams.crest_url : the crest (an image in the public "crests" bucket)
--   teams.theme     : { "primary": "#c8102e", "accent": "#1a7f37" } — the colours of the app
--                     while working with that team
-- Without them the team uses its club's logo and colours, and then TreinON's own.
-- Crests are public pictures (they go on PDFs and on the club's public page): the bucket is
-- readable by anyone, but only the team's managers (or the club's administrator) write in it.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS crest_url text CHECK (crest_url IS NULL OR char_length(crest_url) <= 500);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS theme jsonb CHECK (theme IS NULL OR jsonb_typeof(theme) = 'object');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('crests', 'crests', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 1048576, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- teams/<team id>/… and clubs/<club id>/…
CREATE OR REPLACE FUNCTION public.can_write_crest(_user uuid, _path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parts text[] := string_to_array(_path, '/');
  target uuid;
BEGIN
  IF _user IS NULL OR array_length(parts, 1) < 3 THEN RETURN false; END IF;
  BEGIN target := parts[2]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  IF parts[1] = 'teams' THEN
    RETURN public.can_manage_team(_user, target)
        OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = target AND t.club_id IS NOT NULL AND public.is_club_admin(_user, t.club_id));
  ELSIF parts[1] = 'clubs' THEN
    RETURN public.is_club_admin(_user, target);
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.can_write_crest(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_crest(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "crests_read" ON storage.objects;
CREATE POLICY "crests_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'crests');
DROP POLICY IF EXISTS "crests_insert" ON storage.objects;
CREATE POLICY "crests_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crests' AND public.can_write_crest(auth.uid(), name));
DROP POLICY IF EXISTS "crests_update" ON storage.objects;
CREATE POLICY "crests_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crests' AND public.can_write_crest(auth.uid(), name))
  WITH CHECK (bucket_id = 'crests' AND public.can_write_crest(auth.uid(), name));
DROP POLICY IF EXISTS "crests_delete" ON storage.objects;
CREATE POLICY "crests_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crests' AND public.can_write_crest(auth.uid(), name));

-- the look of the teams I work with (team first, then its club)
CREATE OR REPLACE FUNCTION public.my_team_branding()
RETURNS TABLE (team_id uuid, crest_url text, theme jsonb, club_logo_url text, club_primary text, club_secondary text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.crest_url, t.theme, c.logo_url, c.primary_color, c.secondary_color
    FROM public.teams t LEFT JOIN public.clubs c ON c.id = t.club_id
   WHERE public.can_coach_team(auth.uid(), t.id)
      OR (t.club_id IS NOT NULL AND (public.is_club_staff_member(t.club_id, auth.uid()) OR public.is_club_coach(auth.uid(), t.club_id)))
      OR t.id IN (SELECT public.family_team_ids(auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.my_team_branding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_branding() TO authenticated;
