-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('coach', 'club_admin');

-- Create enum for account types
CREATE TYPE public.account_type AS ENUM ('individual_coach', 'club');

-- Create enum for match event types
CREATE TYPE public.match_event_type AS ENUM ('goal', 'own_goal', 'yellow_card', 'red_card', 'substitution_in', 'substitution_out');

-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  account_type account_type NOT NULL DEFAULT 'individual_coach',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles table (for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Clubs table
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  founded_year INTEGER,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clubs" ON public.clubs
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert clubs" ON public.clubs
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own clubs" ON public.clubs
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own clubs" ON public.clubs
  FOR DELETE USING (auth.uid() = owner_id);

-- Teams table (can belong to a club or individual coach)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT, -- e.g., 'Sub-19', 'Seniores'
  season TEXT NOT NULL DEFAULT '2024/2025',
  formation TEXT DEFAULT '4-3-3',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own teams" ON public.teams
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert teams" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own teams" ON public.teams
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own teams" ON public.teams
  FOR DELETE USING (auth.uid() = owner_id);

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  position TEXT, -- GK, DF, MF, FW
  birth_date DATE,
  photo_url TEXT,
  nationality TEXT,
  height_cm INTEGER,
  weight_kg INTEGER,
  foot TEXT, -- 'left', 'right', 'both'
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own players" ON public.players
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert players" ON public.players
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own players" ON public.players
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own players" ON public.players
  FOR DELETE USING (auth.uid() = owner_id);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_name TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_home BOOLEAN NOT NULL DEFAULT true,
  competition TEXT,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, live, completed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own matches" ON public.matches
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own matches" ON public.matches
  FOR DELETE USING (auth.uid() = owner_id);

-- Match lineup (players in a match with minutes played)
CREATE TABLE public.match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  position_played TEXT,
  minutes_played INTEGER DEFAULT 0,
  rating DECIMAL(3,1),
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lineups" ON public.match_lineups
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert lineups" ON public.match_lineups
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own lineups" ON public.match_lineups
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own lineups" ON public.match_lineups
  FOR DELETE USING (auth.uid() = owner_id);

-- Match events (goals, cards, substitutions)
CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type match_event_type NOT NULL,
  minute INTEGER NOT NULL,
  second INTEGER DEFAULT 0,
  is_opponent BOOLEAN NOT NULL DEFAULT false,
  assist_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.match_events
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert events" ON public.match_events
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own events" ON public.match_events
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own events" ON public.match_events
  FOR DELETE USING (auth.uid() = owner_id);

-- Training sessions
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  location TEXT,
  objectives TEXT,
  exercises TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.training_sessions
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert sessions" ON public.training_sessions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own sessions" ON public.training_sessions
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own sessions" ON public.training_sessions
  FOR DELETE USING (auth.uid() = owner_id);

-- Training attendance
CREATE TABLE public.training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  UNIQUE(session_id, player_id)
);

ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance" ON public.training_attendance
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert attendance" ON public.training_attendance
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own attendance" ON public.training_attendance
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own attendance" ON public.training_attendance
  FOR DELETE USING (auth.uid() = owner_id);

-- Financial transactions (for clubs)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = owner_id);

-- Tactical boards saved
CREATE TABLE public.tactical_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  board_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tactical_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boards" ON public.tactical_boards
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert boards" ON public.tactical_boards
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own boards" ON public.tactical_boards
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own boards" ON public.tactical_boards
  FOR DELETE USING (auth.uid() = owner_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  
  -- Default role is coach
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'coach');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_sessions_updated_at BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tactical_boards_updated_at BEFORE UPDATE ON public.tactical_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();