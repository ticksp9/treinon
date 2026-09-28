-- =============================================
-- 1. EXPANDIR ROLES
-- =============================================

-- Alterar enum para incluir novas roles
ALTER TYPE public.club_staff_role ADD VALUE IF NOT EXISTS 'tesouraria';
ALTER TYPE public.club_staff_role ADD VALUE IF NOT EXISTS 'secretaria';

-- Função para verificar se user tem role específica no clube
CREATE OR REPLACE FUNCTION public.has_club_role(_club_id uuid, _user_id uuid, _roles club_staff_role[])
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
      AND role = ANY(_roles)
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- =============================================
-- 2. EXPANDIR TABELA CLUBS
-- =============================================

-- Adicionar campos ao clubs
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS nif text,
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS website_url text;

-- Tabela de documentos do clube
CREATE TABLE IF NOT EXISTS public.club_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  document_type text NOT NULL, -- estatutos, regulamento, licenca, alvara, etc
  description text,
  file_url text,
  expiry_date date,
  alert_days integer DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can manage documents" ON public.club_documents
FOR ALL USING (
  is_club_staff_admin(club_id, auth.uid()) OR auth.uid() = owner_id
);

CREATE POLICY "Club staff can view documents" ON public.club_documents
FOR SELECT USING (
  is_club_staff_member(club_id, auth.uid())
);

-- =============================================
-- 3. CONTABILIDADE
-- =============================================

-- Contas bancárias/caixa
CREATE TABLE IF NOT EXISTS public.club_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL, -- Caixa, Banco Principal, MBWay
  account_type text NOT NULL DEFAULT 'bank', -- cash, bank, digital
  balance numeric NOT NULL DEFAULT 0,
  iban text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can manage accounts" ON public.club_accounts
FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Staff can view accounts" ON public.club_accounts
FOR SELECT USING (is_club_staff_member(club_id, auth.uid()));

-- Categorias de transações
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  type transaction_type NOT NULL, -- income, expense
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories" ON public.transaction_categories
FOR ALL USING (auth.uid() = owner_id);

-- Expandir transactions existente
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.club_accounts(id),
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.transaction_categories(id),
ADD COLUMN IF NOT EXISTS reference_type text, -- athlete_fee, member_due, sponsor, ticket, sale
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash'; -- cash, transfer, mbway, card

-- =============================================
-- 4. ATLETAS - KITS
-- =============================================

-- Kits/Equipamentos
CREATE TABLE IF NOT EXISTS public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL, -- Kit Principal, Kit Treino
  season text NOT NULL DEFAULT '2024/2025',
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own kits" ON public.kits
FOR ALL USING (auth.uid() = owner_id);

-- Itens de kit atribuídos a jogadores
CREATE TABLE IF NOT EXISTS public.kit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  size text,
  status text NOT NULL DEFAULT 'pending', -- pending, paid, delivered
  amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kit_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own kit assignments" ON public.kit_assignments
FOR ALL USING (auth.uid() = owner_id);

-- =============================================
-- 5. SÓCIOS - EXPANDIR
-- =============================================

-- Planos de quotas
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL, -- Sócio Comum, Sócio Honorário
  annual_fee numeric NOT NULL DEFAULT 0,
  monthly_fee numeric NOT NULL DEFAULT 0,
  benefits text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plans" ON public.membership_plans
FOR ALL USING (auth.uid() = owner_id);

-- Adicionar plan_id aos membros
ALTER TABLE public.club_members
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.membership_plans(id),
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS nif text;

-- =============================================
-- 6. PATROCÍNIOS - EXPANDIR
-- =============================================

-- Contratos de patrocínio
CREATE TABLE IF NOT EXISTS public.sponsorship_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  total_value numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  payment_frequency text DEFAULT 'annual', -- monthly, quarterly, annual, single
  status text NOT NULL DEFAULT 'active', -- active, pending, completed, cancelled
  contract_file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsorship_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contracts" ON public.sponsorship_contracts
FOR ALL USING (auth.uid() = owner_id);

-- Prestações de patrocínio
CREATE TABLE IF NOT EXISTS public.sponsorship_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.sponsorship_contracts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsorship_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own installments" ON public.sponsorship_installments
FOR ALL USING (auth.uid() = owner_id);

-- =============================================
-- 7. BILHETEIRA - EXPANDIR
-- =============================================

-- Eventos
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  location text,
  match_id uuid REFERENCES public.matches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own events" ON public.events
FOR ALL USING (auth.uid() = owner_id);

-- Tipos de bilhete
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL, -- Geral, VIP, Criança, Sócio
  price numeric NOT NULL DEFAULT 0,
  quantity_available integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ticket types" ON public.ticket_types
FOR ALL USING (auth.uid() = owner_id);

-- Expandir ticket_sales
ALTER TABLE public.ticket_sales
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id),
ADD COLUMN IF NOT EXISTS ticket_type_id uuid REFERENCES public.ticket_types(id),
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;

-- =============================================
-- 8. LOJA
-- =============================================

-- Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text, -- equipamento, acessorio, merchandising
  base_price numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own products" ON public.products
FOR ALL USING (auth.uid() = owner_id);

-- Variantes de produto (tamanho/cor)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  size text,
  color text,
  sku text,
  stock integer NOT NULL DEFAULT 0,
  price_adjustment numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own variants" ON public.product_variants
FOR ALL USING (auth.uid() = owner_id);

-- Movimentos de stock
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  quantity integer NOT NULL,
  movement_type text NOT NULL, -- in, out, adjustment
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own movements" ON public.inventory_movements
FOR ALL USING (auth.uid() = owner_id);

-- Vendas
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed', -- pending, completed, cancelled
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sales" ON public.sales
FOR ALL USING (auth.uid() = owner_id);

-- Itens de venda
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id),
  owner_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sale items" ON public.sale_items
FOR ALL USING (auth.uid() = owner_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Atualizar updated_at
CREATE TRIGGER update_club_documents_updated_at
BEFORE UPDATE ON public.club_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_accounts_updated_at
BEFORE UPDATE ON public.club_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kits_updated_at
BEFORE UPDATE ON public.kits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kit_assignments_updated_at
BEFORE UPDATE ON public.kit_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sponsorship_contracts_updated_at
BEFORE UPDATE ON public.sponsorship_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();