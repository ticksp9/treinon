-- Create table for championships/competitions
CREATE TABLE public.championships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2024/2025',
  series TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for championship teams (opponents in the series)
CREATE TABLE public.championship_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  is_own_team BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for championship results
CREATE TABLE public.championship_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  home_team_id UUID NOT NULL REFERENCES public.championship_teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES public.championship_teams(id) ON DELETE CASCADE,
  home_goals INTEGER,
  away_goals INTEGER,
  match_date DATE,
  matchday INTEGER,
  is_played BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for championships
CREATE POLICY "Users can view own championships" ON public.championships FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert championships" ON public.championships FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own championships" ON public.championships FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own championships" ON public.championships FOR DELETE USING (auth.uid() = owner_id);

-- RLS policies for championship_teams
CREATE POLICY "Users can view own championship teams" ON public.championship_teams FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert championship teams" ON public.championship_teams FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own championship teams" ON public.championship_teams FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own championship teams" ON public.championship_teams FOR DELETE USING (auth.uid() = owner_id);

-- RLS policies for championship_results
CREATE POLICY "Users can view own championship results" ON public.championship_results FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert championship results" ON public.championship_results FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own championship results" ON public.championship_results FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own championship results" ON public.championship_results FOR DELETE USING (auth.uid() = owner_id);

-- Triggers for updated_at
CREATE TRIGGER update_championships_updated_at BEFORE UPDATE ON public.championships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_championship_results_updated_at BEFORE UPDATE ON public.championship_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();