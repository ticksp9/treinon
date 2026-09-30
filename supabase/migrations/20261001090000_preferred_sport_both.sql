-- Football and futsal are separate: a coach works with football, futsal, or both.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_sport_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_sport_check CHECK (preferred_sport IN ('football', 'futsal', 'both'));

-- Club owners: follow the club's modalities
UPDATE public.profiles p
SET preferred_sport = CASE
    WHEN c.modalities @> ARRAY['football','futsal']::text[] THEN 'both'
    WHEN c.modalities @> ARRAY['futsal']::text[] THEN 'futsal'
    ELSE p.preferred_sport END
FROM public.clubs c
WHERE c.owner_id = p.id AND c.modalities IS NOT NULL;
