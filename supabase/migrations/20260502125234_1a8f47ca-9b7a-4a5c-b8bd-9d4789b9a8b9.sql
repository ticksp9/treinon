-- Player profile extras
DO $$ BEGIN
  CREATE TYPE public.player_status AS ENUM ('active','injured','suspended','loan','inactive','away');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS secondary_positions text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS status public.player_status NOT NULL DEFAULT 'active';

-- Evaluation extensions (catalog kept in code, ratings stored as JSONB)
ALTER TABLE public.player_evaluations
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context text,
  ADD COLUMN IF NOT EXISTS period_label text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Validate context values via trigger (avoid CHECK on existing rows being NULL is fine, but enforce when set)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.validate_player_evaluation_context()
  RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN
    IF NEW.context IS NOT NULL AND NEW.context NOT IN ('training','match','period','assessment','other') THEN
      RAISE EXCEPTION 'invalid context: %', NEW.context;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END $f$;
EXCEPTION WHEN others THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_validate_player_evaluation ON public.player_evaluations;
CREATE TRIGGER trg_validate_player_evaluation
  BEFORE INSERT OR UPDATE ON public.player_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.validate_player_evaluation_context();

CREATE INDEX IF NOT EXISTS idx_player_evaluations_player_date
  ON public.player_evaluations (player_id, evaluation_date DESC);
