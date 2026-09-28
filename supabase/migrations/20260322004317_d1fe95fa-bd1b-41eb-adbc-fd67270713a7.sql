
-- Add status and training_plan_id to training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS training_plan_id uuid REFERENCES public.coach_trainings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intensity text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS title text;

-- Add status column to training_attendance for richer states
ALTER TABLE public.training_attendance
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'presente',
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- Create training_load table
CREATE TABLE IF NOT EXISTS public.training_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  planned_intensity text DEFAULT 'medium',
  actual_intensity text,
  rpe smallint CHECK (rpe >= 1 AND rpe <= 10),
  duration_minutes integer,
  load_score numeric(6,1),
  notes text,
  recorded_by uuid,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_id)
);

ALTER TABLE public.training_load ENABLE ROW LEVEL SECURITY;

-- RLS for training_load
CREATE POLICY "Users can manage own training load"
  ON public.training_load FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Club staff can manage training load"
  ON public.training_load FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.clubs c ON c.id = t.club_id
      WHERE t.id = training_load.team_id
        AND (c.owner_id = auth.uid() OR public.is_club_staff_member(c.id, auth.uid()))
    )
  );

CREATE POLICY "Team coaches can manage training load"
  ON public.training_load FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches tc
      WHERE tc.team_id = training_load.team_id AND tc.coach_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_training_load_updated_at
  BEFORE UPDATE ON public.training_load
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
