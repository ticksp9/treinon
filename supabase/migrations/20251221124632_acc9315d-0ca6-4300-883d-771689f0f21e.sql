-- Table for player injuries history
CREATE TABLE public.player_injuries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  injury_date DATE NOT NULL,
  return_date DATE,
  injury_type TEXT NOT NULL,
  body_part TEXT,
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'severe')),
  description TEXT,
  treatment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for player career history
CREATE TABLE public.player_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  club_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  position TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for player evaluations
CREATE TABLE public.player_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  technical_rating INTEGER CHECK (technical_rating >= 1 AND technical_rating <= 10),
  tactical_rating INTEGER CHECK (tactical_rating >= 1 AND tactical_rating <= 10),
  physical_rating INTEGER CHECK (physical_rating >= 1 AND physical_rating <= 10),
  mental_rating INTEGER CHECK (mental_rating >= 1 AND mental_rating <= 10),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 10),
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS for player_injuries (owner access)
CREATE POLICY "Users can view own player injuries"
ON public.player_injuries FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert player injuries"
ON public.player_injuries FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own player injuries"
ON public.player_injuries FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own player injuries"
ON public.player_injuries FOR DELETE
USING (auth.uid() = owner_id);

-- RLS for player_history (owner access)
CREATE POLICY "Users can view own player history"
ON public.player_history FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert player history"
ON public.player_history FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own player history"
ON public.player_history FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own player history"
ON public.player_history FOR DELETE
USING (auth.uid() = owner_id);

-- RLS for player_evaluations (owner access)
CREATE POLICY "Users can view own player evaluations"
ON public.player_evaluations FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert player evaluations"
ON public.player_evaluations FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own player evaluations"
ON public.player_evaluations FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own player evaluations"
ON public.player_evaluations FOR DELETE
USING (auth.uid() = owner_id);

-- Coaches can also access injuries/evaluations for players in their teams
CREATE POLICY "Coaches can view injuries for their team players"
ON public.player_injuries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can insert injuries for their team players"
ON public.player_injuries FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can update injuries for their team players"
ON public.player_injuries FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can view history for their team players"
ON public.player_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can insert history for their team players"
ON public.player_history FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can update history for their team players"
ON public.player_history FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can view evaluations for their team players"
ON public.player_evaluations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can insert evaluations for their team players"
ON public.player_evaluations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));

CREATE POLICY "Coaches can update evaluations for their team players"
ON public.player_evaluations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id = player_id AND public.is_team_coach(auth.uid(), p.team_id)
));