-- Tabela para mensalidades dos jogadores
CREATE TABLE public.player_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL,
  UNIQUE (player_id, month, year)
);

-- Enable RLS
ALTER TABLE public.player_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own player fees" ON public.player_fees FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert player fees" ON public.player_fees FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own player fees" ON public.player_fees FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own player fees" ON public.player_fees FOR DELETE USING (auth.uid() = owner_id);

-- Tabela para sócios do clube
CREATE TABLE public.club_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  membership_number TEXT,
  fee_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own club members" ON public.club_members FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert club members" ON public.club_members FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own club members" ON public.club_members FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own club members" ON public.club_members FOR DELETE USING (auth.uid() = owner_id);

-- Tabela para pagamentos de sócios
CREATE TABLE public.member_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL,
  UNIQUE (member_id, month, year)
);

ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own member payments" ON public.member_payments FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert member payments" ON public.member_payments FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own member payments" ON public.member_payments FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own member payments" ON public.member_payments FOR DELETE USING (auth.uid() = owner_id);

-- Tabela para patrocinadores
CREATE TABLE public.sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  contract_value NUMERIC DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sponsors" ON public.sponsors FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert sponsors" ON public.sponsors FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own sponsors" ON public.sponsors FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own sponsors" ON public.sponsors FOR DELETE USING (auth.uid() = owner_id);

-- Tabela para bilheteira
CREATE TABLE public.ticket_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  tickets_sold INTEGER NOT NULL DEFAULT 0,
  ticket_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL
);

ALTER TABLE public.ticket_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ticket sales" ON public.ticket_sales FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert ticket sales" ON public.ticket_sales FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own ticket sales" ON public.ticket_sales FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own ticket sales" ON public.ticket_sales FOR DELETE USING (auth.uid() = owner_id);

-- Adicionar campos ao clube: história e objetivos
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS history TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS objectives TEXT;

-- Trigger para updated_at
CREATE TRIGGER update_player_fees_updated_at BEFORE UPDATE ON public.player_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_club_members_updated_at BEFORE UPDATE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON public.sponsors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();