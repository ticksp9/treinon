-- Enum para roles no clube (já existe app_role, mas vamos criar um mais específico para staff)
CREATE TYPE public.club_staff_role AS ENUM ('admin', 'staff', 'coach');

-- Tabela para gerir membros do staff do clube com roles específicos
CREATE TABLE public.club_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role club_staff_role NOT NULL DEFAULT 'staff',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(club_id, user_id)
);

-- Tabela para definir permissões específicas de cada staff member
CREATE TABLE public.staff_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.club_staff(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_id, permission_key)
);

-- Tabela para atribuir treinadores a escalões específicos (coach <-> team relationship)
-- Já existe team_coaches, mas vamos adicionar mais detalhes
ALTER TABLE public.team_coaches 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'head_coach',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Tabela para limites de administradores e staff por clube
CREATE TABLE public.club_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE UNIQUE,
  max_admins INTEGER DEFAULT 3,
  max_staff INTEGER DEFAULT 10,
  max_coaches INTEGER DEFAULT 20,
  allow_coach_multi_team BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.club_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar se é admin do clube
CREATE OR REPLACE FUNCTION public.is_club_staff_admin(_club_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id
      AND user_id = _user_id
      AND role = 'admin'
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- Função helper para verificar se é membro do staff
CREATE OR REPLACE FUNCTION public.is_club_staff_member(_club_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id
      AND user_id = _user_id
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- RLS policies for club_staff
CREATE POLICY "Club admins and owners can view staff"
  ON public.club_staff FOR SELECT
  USING (public.is_club_staff_admin(club_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Club admins and owners can manage staff"
  ON public.club_staff FOR ALL
  USING (public.is_club_staff_admin(club_id, auth.uid()));

-- RLS policies for staff_permissions
CREATE POLICY "Club admins can view permissions"
  ON public.staff_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_staff cs
      WHERE cs.id = staff_id
        AND public.is_club_staff_admin(cs.club_id, auth.uid())
    )
  );

CREATE POLICY "Club admins can manage permissions"
  ON public.staff_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.club_staff cs
      WHERE cs.id = staff_id
        AND public.is_club_staff_admin(cs.club_id, auth.uid())
    )
  );

-- RLS policies for club_settings
CREATE POLICY "Club admins can view settings"
  ON public.club_settings FOR SELECT
  USING (public.is_club_staff_admin(club_id, auth.uid()));

CREATE POLICY "Club owners can manage settings"
  ON public.club_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_id AND owner_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_club_staff_updated_at
  BEFORE UPDATE ON public.club_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_settings_updated_at
  BEFORE UPDATE ON public.club_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();