CREATE OR REPLACE FUNCTION public.prevent_archived_season_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'archived' AND (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.reference_date IS DISTINCT FROM OLD.reference_date
  ) THEN
    RAISE EXCEPTION 'Época arquivada não pode ser renomeada nem ter datas alteradas.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_archived_season_identity_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_archived_season_identity_change ON public.seasons;
CREATE TRIGGER trg_prevent_archived_season_identity_change
BEFORE UPDATE ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_identity_change();