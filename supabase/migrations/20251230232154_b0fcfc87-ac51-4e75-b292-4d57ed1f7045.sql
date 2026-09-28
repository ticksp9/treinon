-- Criar enum para status do jogador na transição
CREATE TYPE public.season_player_status AS ENUM ('promotes', 'stays', 'leaves');

-- Tabela de épocas
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Ex: '2024/2025', '2025/2026'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_planning BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL,
  UNIQUE(club_id, name)
);

-- Índices para seasons
CREATE INDEX idx_seasons_club_id ON public.seasons(club_id);
CREATE INDEX idx_seasons_is_active ON public.seasons(is_active);

-- Enable RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- RLS policies para seasons
CREATE POLICY "Club admins can manage seasons"
ON public.seasons FOR ALL
USING (is_club_staff_admin(club_id, auth.uid()) OR auth.uid() = owner_id);

CREATE POLICY "Club staff can view seasons"
ON public.seasons FOR SELECT
USING (is_club_staff_member(club_id, auth.uid()));

-- Tabela de planeamento de jogadores para a próxima época
CREATE TABLE public.season_player_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  current_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  target_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  current_category TEXT,
  target_category TEXT,
  status public.season_player_status NOT NULL DEFAULT 'stays',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(season_id, player_id)
);

-- Índices
CREATE INDEX idx_season_player_plans_season ON public.season_player_plans(season_id);
CREATE INDEX idx_season_player_plans_player ON public.season_player_plans(player_id);
CREATE INDEX idx_season_player_plans_club ON public.season_player_plans(club_id);

-- Enable RLS
ALTER TABLE public.season_player_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Club admins can manage player plans"
ON public.season_player_plans FOR ALL
USING (is_club_staff_admin(club_id, auth.uid()));

CREATE POLICY "Club staff can view player plans"
ON public.season_player_plans FOR SELECT
USING (is_club_staff_member(club_id, auth.uid()));

-- Tabela de equipas planeadas para a próxima época
CREATE TABLE public.season_team_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name TEXT NOT NULL,
  category TEXT,
  gender TEXT NOT NULL DEFAULT 'male',
  sport_type TEXT NOT NULL DEFAULT 'football_11',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Índices
CREATE INDEX idx_season_team_plans_season ON public.season_team_plans(season_id);
CREATE INDEX idx_season_team_plans_club ON public.season_team_plans(club_id);

-- Enable RLS
ALTER TABLE public.season_team_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Club admins can manage team plans"
ON public.season_team_plans FOR ALL
USING (is_club_staff_admin(club_id, auth.uid()));

CREATE POLICY "Club staff can view team plans"
ON public.season_team_plans FOR SELECT
USING (is_club_staff_member(club_id, auth.uid()));

-- Tabela de atribuição de treinadores para a próxima época
CREATE TABLE public.season_coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  team_plan_id UUID REFERENCES public.season_team_plans(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'head_coach', -- head_coach, assistant, goalkeeper_coach, etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(season_id, coach_id, team_plan_id)
);

-- Índices
CREATE INDEX idx_season_coach_assignments_season ON public.season_coach_assignments(season_id);
CREATE INDEX idx_season_coach_assignments_coach ON public.season_coach_assignments(coach_id);
CREATE INDEX idx_season_coach_assignments_club ON public.season_coach_assignments(club_id);

-- Enable RLS
ALTER TABLE public.season_coach_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Club admins can manage coach assignments"
ON public.season_coach_assignments FOR ALL
USING (is_club_staff_admin(club_id, auth.uid()));

CREATE POLICY "Club staff can view coach assignments"
ON public.season_coach_assignments FOR SELECT
USING (is_club_staff_member(club_id, auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_seasons_updated_at
BEFORE UPDATE ON public.seasons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_season_player_plans_updated_at
BEFORE UPDATE ON public.season_player_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_season_team_plans_updated_at
BEFORE UPDATE ON public.season_team_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_season_coach_assignments_updated_at
BEFORE UPDATE ON public.season_coach_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();