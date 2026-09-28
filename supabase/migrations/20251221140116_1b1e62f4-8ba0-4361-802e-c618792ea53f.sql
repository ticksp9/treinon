
-- Create coach_details table for extended coach information
CREATE TABLE public.coach_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  birth_date DATE,
  nationality TEXT,
  photo_url TEXT,
  bio TEXT,
  coaching_philosophy TEXT,
  preferred_formations TEXT[],
  specializations TEXT[],
  years_experience INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_details
CREATE POLICY "Users can view own coach details" ON public.coach_details FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coach details" ON public.coach_details FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own coach details" ON public.coach_details FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own coach details" ON public.coach_details FOR DELETE USING (auth.uid() = user_id);

-- Create coach_diplomas table for certifications
CREATE TABLE public.coach_diplomas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  issuing_organization TEXT,
  issue_date DATE,
  expiry_date DATE,
  document_url TEXT,
  diploma_level TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_diplomas ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_diplomas
CREATE POLICY "Users can view own diplomas" ON public.coach_diplomas FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own diplomas" ON public.coach_diplomas FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own diplomas" ON public.coach_diplomas FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own diplomas" ON public.coach_diplomas FOR DELETE USING (auth.uid() = owner_id);

-- Create coach_history table for coaching experience
CREATE TABLE public.coach_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  club_name TEXT NOT NULL,
  role TEXT,
  start_date DATE,
  end_date DATE,
  age_groups TEXT[],
  achievements TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_history
CREATE POLICY "Users can view own history" ON public.coach_history FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own history" ON public.coach_history FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own history" ON public.coach_history FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own history" ON public.coach_history FOR DELETE USING (auth.uid() = owner_id);

-- Create training_templates table for pre-made training models
CREATE TABLE public.training_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  age_group TEXT,
  focus_area TEXT,
  duration_minutes INTEGER DEFAULT 90,
  exercises JSONB DEFAULT '[]'::jsonb,
  diagram_url TEXT,
  is_system_template BOOLEAN DEFAULT false,
  sport_type TEXT DEFAULT 'football_11',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_templates
CREATE POLICY "Anyone can view system templates" ON public.training_templates FOR SELECT USING (is_system_template = true);
CREATE POLICY "Users can view own templates" ON public.training_templates FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own templates" ON public.training_templates FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own templates" ON public.training_templates FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own templates" ON public.training_templates FOR DELETE USING (auth.uid() = owner_id);

-- Create coach_trainings table for custom training plans
CREATE TABLE public.coach_trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  team_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  age_group TEXT,
  objectives TEXT,
  exercises JSONB DEFAULT '[]'::jsonb,
  tactical_notes TEXT,
  diagram_url TEXT,
  duration_minutes INTEGER DEFAULT 90,
  training_date DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_trainings ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_trainings
CREATE POLICY "Users can view own trainings" ON public.coach_trainings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own trainings" ON public.coach_trainings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own trainings" ON public.coach_trainings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own trainings" ON public.coach_trainings FOR DELETE USING (auth.uid() = owner_id);

-- Create storage bucket for coach documents
INSERT INTO storage.buckets (id, name, public) VALUES ('coach-documents', 'coach-documents', false);

-- Storage policies for coach-documents bucket
CREATE POLICY "Users can upload coach documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'coach-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own coach documents" ON storage.objects FOR SELECT USING (bucket_id = 'coach-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own coach documents" ON storage.objects FOR UPDATE USING (bucket_id = 'coach-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own coach documents" ON storage.objects FOR DELETE USING (bucket_id = 'coach-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create triggers for updated_at
CREATE TRIGGER update_coach_details_updated_at BEFORE UPDATE ON public.coach_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_templates_updated_at BEFORE UPDATE ON public.training_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coach_trainings_updated_at BEFORE UPDATE ON public.coach_trainings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some system training templates
INSERT INTO public.training_templates (name, description, age_group, focus_area, duration_minutes, exercises, is_system_template, sport_type) VALUES
('Treino Técnico Sub-10', 'Treino focado em fundamentos técnicos para crianças', 'sub-10', 'technical', 60, '[{"name": "Aquecimento com bola", "duration": 10, "description": "Condução livre pelo campo"}, {"name": "Passe e receção", "duration": 15, "description": "Exercício em pares"}, {"name": "Condução em slalom", "duration": 15, "description": "Condução entre cones"}, {"name": "Mini-jogo", "duration": 20, "description": "Jogo reduzido 4x4"}]', true, 'football_11'),
('Treino Tático Sub-15', 'Treino com foco em posicionamento e transições', 'sub-15', 'tactical', 90, '[{"name": "Aquecimento", "duration": 15, "description": "Rondo 5x2"}, {"name": "Posicionamento defensivo", "duration": 20, "description": "Linhas de 4"}, {"name": "Transição ofensiva", "duration": 25, "description": "Saída em apoio"}, {"name": "Jogo condicionado", "duration": 30, "description": "11x11 com objetivos táticos"}]', true, 'football_11'),
('Treino Físico Seniores', 'Preparação física para equipas seniores', 'senior', 'physical', 90, '[{"name": "Aquecimento dinâmico", "duration": 15, "description": "Mobilidade articular"}, {"name": "Velocidade e agilidade", "duration": 20, "description": "Sprints e mudanças de direção"}, {"name": "Força funcional", "duration": 25, "description": "Circuito com peso corporal"}, {"name": "Resistência", "duration": 20, "description": "Corrida intervalada"}, {"name": "Alongamentos", "duration": 10, "description": "Recuperação"}]', true, 'football_11'),
('Treino Guarda-Redes', 'Treino específico para guarda-redes', 'all', 'technical', 75, '[{"name": "Aquecimento específico", "duration": 10, "description": "Flexibilidade e reflexos"}, {"name": "Quedas e saídas", "duration": 20, "description": "Técnica de queda"}, {"name": "Posicionamento", "duration": 20, "description": "Ângulos e colocação"}, {"name": "Jogo de pés", "duration": 15, "description": "Passe e receção"}, {"name": "Situações de jogo", "duration": 10, "description": "1x1 com avançado"}]', true, 'football_11');
