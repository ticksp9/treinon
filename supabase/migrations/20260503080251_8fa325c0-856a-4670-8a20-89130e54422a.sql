
ALTER TABLE public.player_injuries
  ADD COLUMN IF NOT EXISTS body_side text,
  ADD COLUMN IF NOT EXISTS context text,
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS responsible_professional text,
  ADD COLUMN IF NOT EXISTS treatment_plan text,
  ADD COLUMN IF NOT EXISTS clinical_notes text,
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS clinical_status text NOT NULL DEFAULT 'inapto',
  ADD COLUMN IF NOT EXISTS can_play boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrictions text,
  ADD COLUMN IF NOT EXISTS is_recurrence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trainings_missed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matches_missed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_injuries_clinical_status_check') THEN
    ALTER TABLE public.player_injuries
      ADD CONSTRAINT player_injuries_clinical_status_check
      CHECK (clinical_status IN ('apto','inapto','condicionado','em_recuperacao','retorno_progressivo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_injuries_body_side_check') THEN
    ALTER TABLE public.player_injuries
      ADD CONSTRAINT player_injuries_body_side_check
      CHECK (body_side IS NULL OR body_side IN ('left','right','both','n_a'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_injuries_context_check') THEN
    ALTER TABLE public.player_injuries
      ADD CONSTRAINT player_injuries_context_check
      CHECK (context IS NULL OR context IN ('training','match','extra','other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_player_injuries_player_status
  ON public.player_injuries (player_id, clinical_status);

CREATE OR REPLACE FUNCTION public.touch_player_injuries_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_player_injuries_updated_at ON public.player_injuries;
CREATE TRIGGER trg_player_injuries_updated_at
BEFORE UPDATE ON public.player_injuries
FOR EACH ROW EXECUTE FUNCTION public.touch_player_injuries_updated_at();
