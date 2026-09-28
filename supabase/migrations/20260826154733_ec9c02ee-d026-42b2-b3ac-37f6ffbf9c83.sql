-- 1. Deduplicate existing seasons per (owner_id, club_id, name)
DO $$
DECLARE r RECORD;
  dep integer;
BEGIN
  FOR r IN
    SELECT s.id, s.name
    FROM (
      SELECT id, name,
             row_number() OVER (
               PARTITION BY owner_id, coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid), name
               ORDER BY created_at
             ) AS rn
      FROM public.seasons
    ) s
    WHERE s.rn > 1
  LOOP
    SELECT
      (SELECT count(*) FROM public.matches m WHERE m.season_id = r.id)
      + (SELECT count(*) FROM public.coach_trainings t WHERE t.season_id = r.id)
      + (SELECT count(*) FROM public.season_player_enrollments e WHERE e.season_id = r.id)
      + (SELECT count(*) FROM public.season_transitions x WHERE x.from_season_id = r.id OR x.to_season_id = r.id)
    INTO dep;

    IF dep = 0 THEN
      DELETE FROM public.seasons WHERE id = r.id;
    ELSE
      UPDATE public.seasons
        SET name = r.name || ' (duplicada)',
            status = 'archived',
            is_active = false,
            is_planning = false,
            archived_at = coalesce(archived_at, now())
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 2. Uniqueness per context
CREATE UNIQUE INDEX IF NOT EXISTS seasons_unique_per_owner_name
  ON public.seasons (owner_id, coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- 3. Server-side delete protection
CREATE OR REPLACE FUNCTION public.prevent_season_delete_with_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE dep integer;
BEGIN
  IF OLD.status IN ('active', 'archived') THEN
    RAISE EXCEPTION 'Só é possível eliminar épocas em planeamento ou fechadas sem dados.';
  END IF;

  SELECT
    (SELECT count(*) FROM public.matches m WHERE m.season_id = OLD.id)
    + (SELECT count(*) FROM public.coach_trainings t WHERE t.season_id = OLD.id)
    + (SELECT count(*) FROM public.season_player_enrollments e WHERE e.season_id = OLD.id)
    + (SELECT count(*) FROM public.season_transitions x WHERE x.from_season_id = OLD.id OR x.to_season_id = OLD.id)
  INTO dep;

  IF dep > 0 THEN
    RAISE EXCEPTION 'Esta época tem dados associados e não pode ser eliminada. Arquive-a em alternativa.';
  END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_season_delete_with_data ON public.seasons;
CREATE TRIGGER trg_prevent_season_delete_with_data
  BEFORE DELETE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.prevent_season_delete_with_data();