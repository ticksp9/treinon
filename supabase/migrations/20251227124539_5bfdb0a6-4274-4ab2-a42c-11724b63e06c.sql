-- Create physio_injuries table (new table for physio-managed injuries)
CREATE TABLE public.physio_injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  body_area TEXT NOT NULL,
  injury_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovering', 'cleared', 'chronic')),
  notes TEXT,
  restrictions TEXT,
  is_fit BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create physio_assessments table
CREATE TABLE public.physio_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  injury_id UUID REFERENCES public.physio_injuries(id) ON DELETE SET NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  findings TEXT,
  recommendation TEXT,
  next_review_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rehab_plans table
CREATE TABLE public.rehab_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  injury_id UUID REFERENCES public.physio_injuries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  phase TEXT DEFAULT 'initial' CHECK (phase IN ('initial', 'intermediate', 'advanced', 'return_to_play')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rehab_plan_exercises table
CREATE TABLE public.rehab_plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  rehab_plan_id UUID NOT NULL REFERENCES public.rehab_plans(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  description TEXT,
  sets INTEGER,
  reps INTEGER,
  duration_seconds INTEGER,
  frequency TEXT,
  location TEXT DEFAULT 'training' CHECK (location IN ('home', 'training', 'both')),
  video_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create physio_daily_logs table
CREATE TABLE public.physio_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  fatigue_level INTEGER CHECK (fatigue_level >= 0 AND fatigue_level <= 10),
  sleep_quality INTEGER CHECK (sleep_quality >= 0 AND sleep_quality <= 10),
  adherence BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create physio_medical_documents table
CREATE TABLE public.physio_medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  related_type TEXT CHECK (related_type IN ('injury', 'assessment', 'rehab_plan', 'general')),
  related_id UUID,
  file_url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.physio_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physio_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physio_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physio_medical_documents ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is physio in club
CREATE OR REPLACE FUNCTION public.is_club_physio(_club_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id
      AND user_id = _user_id
      AND role = 'physio'
      AND is_active = true
  )
$$;

-- Create helper function to check if user has physio access (admin, staff, or physio)
CREATE OR REPLACE FUNCTION public.has_physio_access(_club_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id
      AND user_id = _user_id
      AND role IN ('admin', 'physio')
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- RLS Policies for physio_injuries
CREATE POLICY "Physio and admin can manage injuries"
ON public.physio_injuries FOR ALL
USING (has_physio_access(club_id, auth.uid()));

CREATE POLICY "Coaches can view injury summary for their teams"
ON public.physio_injuries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.team_coaches tc ON tc.team_id = p.team_id
    WHERE p.id = physio_injuries.player_id
      AND tc.coach_id = auth.uid()
  )
);

-- RLS Policies for physio_assessments
CREATE POLICY "Physio and admin can manage assessments"
ON public.physio_assessments FOR ALL
USING (has_physio_access(club_id, auth.uid()));

-- RLS Policies for rehab_plans
CREATE POLICY "Physio and admin can manage rehab plans"
ON public.rehab_plans FOR ALL
USING (has_physio_access(club_id, auth.uid()));

CREATE POLICY "Coaches can view rehab plans for their teams"
ON public.rehab_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.team_coaches tc ON tc.team_id = p.team_id
    WHERE p.id = rehab_plans.player_id
      AND tc.coach_id = auth.uid()
  )
);

-- RLS Policies for rehab_plan_exercises
CREATE POLICY "Physio and admin can manage exercises"
ON public.rehab_plan_exercises FOR ALL
USING (has_physio_access(club_id, auth.uid()));

CREATE POLICY "Coaches can view exercises for their team plans"
ON public.rehab_plan_exercises FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rehab_plans rp
    JOIN public.players p ON p.id = rp.player_id
    JOIN public.team_coaches tc ON tc.team_id = p.team_id
    WHERE rp.id = rehab_plan_exercises.rehab_plan_id
      AND tc.coach_id = auth.uid()
  )
);

-- RLS Policies for physio_daily_logs
CREATE POLICY "Physio and admin can manage daily logs"
ON public.physio_daily_logs FOR ALL
USING (has_physio_access(club_id, auth.uid()));

-- RLS Policies for physio_medical_documents
CREATE POLICY "Physio and admin can manage medical documents"
ON public.physio_medical_documents FOR ALL
USING (has_physio_access(club_id, auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_physio_injuries_updated_at
BEFORE UPDATE ON public.physio_injuries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_physio_assessments_updated_at
BEFORE UPDATE ON public.physio_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rehab_plans_updated_at
BEFORE UPDATE ON public.rehab_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_physio_medical_documents_updated_at
BEFORE UPDATE ON public.physio_medical_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_physio_injuries_club_id ON public.physio_injuries(club_id);
CREATE INDEX idx_physio_injuries_player_id ON public.physio_injuries(player_id);
CREATE INDEX idx_physio_injuries_status ON public.physio_injuries(status);
CREATE INDEX idx_physio_assessments_club_id ON public.physio_assessments(club_id);
CREATE INDEX idx_physio_assessments_player_id ON public.physio_assessments(player_id);
CREATE INDEX idx_rehab_plans_club_id ON public.rehab_plans(club_id);
CREATE INDEX idx_rehab_plans_player_id ON public.rehab_plans(player_id);
CREATE INDEX idx_rehab_plan_exercises_rehab_plan_id ON public.rehab_plan_exercises(rehab_plan_id);
CREATE INDEX idx_physio_daily_logs_club_id ON public.physio_daily_logs(club_id);
CREATE INDEX idx_physio_daily_logs_player_id ON public.physio_daily_logs(player_id);