-- Public club page (/c/<slug>): club identity, teams, upcoming matches and results.
-- Off by default; the club admin turns it on. Never exposes players (minors),
-- staff contacts, finances or anything personal.
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS public_page_enabled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_public_slug_key ON public.clubs (lower(public_slug)) WHERE public_slug IS NOT NULL;
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_public_slug_format;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_public_slug_format
  CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');

CREATE OR REPLACE FUNCTION public.get_public_club(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT * FROM public.clubs
    WHERE public_page_enabled AND lower(public_slug) = lower(_slug)
    LIMIT 1
  ),
  t AS (
    SELECT tm.id, tm.name, tm.category, tm.sport_type
    FROM public.teams tm JOIN c ON tm.club_id = c.id
  ),
  m AS (
    SELECT mt.match_date, mt.opponent_name, mt.is_home, mt.location, mt.competition, mt.status,
           mt.goals_for, mt.goals_against, t.name AS team_name
    FROM public.matches mt JOIN t ON t.id = mt.team_id
    WHERE NOT coalesce(mt.is_deleted, false) AND NOT coalesce(mt.is_test, false)
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM c) THEN NULL ELSE jsonb_build_object(
    'name', c.name, 'logo_url', c.logo_url, 'founded_year', c.founded_year,
    'primary_color', c.primary_color, 'secondary_color', c.secondary_color,
    'history', c.history, 'address', c.address, 'website_url', c.website_url,
    'facebook_url', c.facebook_url, 'instagram_url', c.instagram_url, 'twitter_url', c.twitter_url,
    'modalities', c.modalities,
    'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'category', category, 'sport_type', sport_type) ORDER BY name) FROM t), '[]'::jsonb),
    'upcoming', coalesce((SELECT jsonb_agg(x ORDER BY x->>'match_date') FROM (
        SELECT to_jsonb(m) - 'goals_for' - 'goals_against' - 'status' AS x FROM m
        WHERE m.match_date >= now() - interval '3 hours' AND m.status NOT IN ('completed', 'finished')
        ORDER BY m.match_date LIMIT 12) u), '[]'::jsonb),
    'results', coalesce((SELECT jsonb_agg(x ORDER BY x->>'match_date' DESC) FROM (
        SELECT to_jsonb(m) - 'status' AS x FROM m
        WHERE m.status IN ('completed', 'finished') AND m.goals_for IS NOT NULL
        ORDER BY m.match_date DESC LIMIT 12) r), '[]'::jsonb)
  ) END
  FROM (SELECT 1) one LEFT JOIN c ON true
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_club(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_club(text) TO anon, authenticated;
