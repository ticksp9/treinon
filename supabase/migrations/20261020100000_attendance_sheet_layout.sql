-- The page geometry each attendance sheet was printed with ({"version": 2, "nameW": 34.5}),
-- so the photo of a signed sheet is read with the same boxes. Older sheets have none (version 1).
ALTER TABLE public.attendance_sheets ADD COLUMN IF NOT EXISTS layout jsonb
  CHECK (layout IS NULL OR jsonb_typeof(layout) = 'object');
