-- The coach's own formations (e.g. 4-1-2-1 in football 9). Only the code is kept:
-- the app builds the layout from it.
CREATE TABLE IF NOT EXISTS public.custom_formations (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_type text NOT NULL CHECK (sport_type IN ('football_5', 'football_7', 'football_9', 'football_11', 'futsal')),
  code text NOT NULL CHECK (code ~ '^[1-6](-[1-6]){1,4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, sport_type, code)
);
ALTER TABLE public.custom_formations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_formations_own" ON public.custom_formations;
CREATE POLICY "custom_formations_own" ON public.custom_formations FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_formations TO authenticated;
