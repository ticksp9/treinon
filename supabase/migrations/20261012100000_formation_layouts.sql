-- The coach's own drawing of a formation: where he dragged each position
-- ({ "<slot id>": [x, y] }, 0..1). NULL = the default layout. A row for a formation that
-- comes with the app (e.g. 3-3-2) holds only his drawing of it.
ALTER TABLE public.custom_formations ADD COLUMN IF NOT EXISTS layout jsonb
  CHECK (layout IS NULL OR jsonb_typeof(layout) = 'object');
