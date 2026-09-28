
-- =====================================================
-- Assets + Inventory + Equipment + Stocks Module
-- =====================================================

-- 1. asset_categories
CREATE TABLE public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'equipment'
    CHECK (asset_type IN ('fixed_asset','equipment','medical','tech','furniture','consumable','uniform','training_material','safety','facility','other')),
  requires_serial boolean DEFAULT false,
  requires_maintenance boolean DEFAULT false,
  requires_validity_control boolean DEFAULT false,
  requires_assignment boolean DEFAULT false,
  depreciable boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, code)
);

-- 2. inventory_locations
CREATE TABLE public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  location_code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL DEFAULT 'warehouse'
    CHECK (location_type IN ('warehouse','medical_room','office','training_ground','locker_room','team_room','vehicle','remote_storage','other')),
  parent_location_id uuid REFERENCES public.inventory_locations(id),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, location_code)
);

-- 3. asset_items
CREATE TABLE public.asset_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  category_id uuid REFERENCES public.asset_categories(id),
  name text NOT NULL,
  description text,
  brand text,
  model text,
  serial_number text,
  barcode_qr text,
  acquisition_date date,
  acquisition_cost numeric(12,2) DEFAULT 0,
  supplier_id uuid REFERENCES public.vendors(id),
  warranty_until date,
  useful_life_months integer,
  depreciation_method text DEFAULT 'straight_line',
  residual_value numeric(12,2) DEFAULT 0,
  asset_status text NOT NULL DEFAULT 'in_stock'
    CHECK (asset_status IN ('in_stock','assigned','in_use','maintenance','damaged','lost','retired','disposed','reserved')),
  ownership_type text DEFAULT 'owned'
    CHECK (ownership_type IN ('owned','leased','borrowed','donated')),
  current_location_id uuid REFERENCES public.inventory_locations(id),
  current_responsible_person_id uuid,
  linked_team_id uuid REFERENCES public.teams(id),
  cost_center_id uuid REFERENCES public.budget_cost_centers(id),
  season text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, asset_code)
);

-- 4. asset_documents
CREATE TABLE public.asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_item_id uuid NOT NULL REFERENCES public.asset_items(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text,
  valid_from date,
  valid_to date,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 5. asset_maintenance_plans
CREATE TABLE public.asset_maintenance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.asset_categories(id),
  asset_item_id uuid REFERENCES public.asset_items(id),
  maintenance_type text NOT NULL DEFAULT 'preventive',
  frequency_type text DEFAULT 'monthly',
  frequency_value integer DEFAULT 1,
  responsible_role text,
  checklist_json jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 6. asset_maintenance_logs
CREATE TABLE public.asset_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  asset_item_id uuid NOT NULL REFERENCES public.asset_items(id) ON DELETE CASCADE,
  maintenance_plan_id uuid REFERENCES public.asset_maintenance_plans(id),
  maintenance_type text NOT NULL,
  scheduled_date date,
  performed_date date,
  performed_by uuid,
  vendor_id uuid REFERENCES public.vendors(id),
  cost numeric(12,2) DEFAULT 0,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','overdue','cancelled')),
  findings text,
  next_due_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 7. stock_items
CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sku text NOT NULL,
  category_id uuid REFERENCES public.asset_categories(id),
  item_name text NOT NULL,
  item_type text NOT NULL DEFAULT 'consumable'
    CHECK (item_type IN ('consumable','distributable','resale','medical_supply','uniform','training_supply','spare_part','office_supply','hygiene','hydration','nutrition','other')),
  unit_of_measure text DEFAULT 'unit',
  track_batches boolean DEFAULT false,
  track_expiry boolean DEFAULT false,
  minimum_stock integer DEFAULT 0,
  reorder_point integer DEFAULT 0,
  reorder_quantity integer DEFAULT 0,
  default_supplier_id uuid REFERENCES public.vendors(id),
  average_unit_cost numeric(12,2) DEFAULT 0,
  current_stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(club_id, sku)
);

-- 8. stock_batches
CREATE TABLE public.stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  batch_number text,
  purchase_date date,
  expiry_date date,
  quantity_received integer DEFAULT 0,
  quantity_available integer DEFAULT 0,
  unit_cost numeric(12,2) DEFAULT 0,
  location_id uuid REFERENCES public.inventory_locations(id),
  created_at timestamptz DEFAULT now()
);

-- 9. stock_movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.stock_batches(id),
  movement_type text NOT NULL
    CHECK (movement_type IN ('inbound','outbound','transfer','adjustment','issue_to_team','return_from_team','consumption','loss','writeoff','count_correction')),
  quantity integer NOT NULL,
  unit_cost numeric(12,2) DEFAULT 0,
  total_cost numeric(12,2) DEFAULT 0,
  from_location_id uuid REFERENCES public.inventory_locations(id),
  to_location_id uuid REFERENCES public.inventory_locations(id),
  related_team_id uuid REFERENCES public.teams(id),
  related_person_id uuid,
  cost_center_id uuid REFERENCES public.budget_cost_centers(id),
  season text,
  source_entity_type text,
  source_entity_id uuid,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 10. stock_counts
CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.inventory_locations(id),
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  count_type text DEFAULT 'full' CHECK (count_type IN ('full','cycle','spot')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','approved')),
  counted_by uuid,
  approved_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 11. stock_count_lines
CREATE TABLE public.stock_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id),
  system_quantity integer DEFAULT 0,
  counted_quantity integer DEFAULT 0,
  variance_quantity integer DEFAULT 0,
  variance_reason text
);

-- 12. team_equipment_allocations
CREATE TABLE public.team_equipment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  season text,
  item_type text NOT NULL CHECK (item_type IN ('asset_item','stock_item')),
  item_id uuid NOT NULL,
  quantity integer DEFAULT 1,
  allocation_date date DEFAULT CURRENT_DATE,
  return_due_date date,
  allocation_status text DEFAULT 'allocated' CHECK (allocation_status IN ('allocated','partially_returned','returned','consumed','lost','damaged')),
  responsible_person_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 13. athlete_kit_assignments
CREATE TABLE public.athlete_kit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text,
  item_description text NOT NULL,
  size text,
  quantity integer DEFAULT 1,
  issue_date date DEFAULT CURRENT_DATE,
  return_expected date,
  return_date date,
  status text DEFAULT 'issued' CHECK (status IN ('issued','returned','lost','damaged','written_off')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 14. compliance_assets
CREATE TABLE public.compliance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  asset_item_id uuid NOT NULL REFERENCES public.asset_items(id) ON DELETE CASCADE,
  compliance_type text NOT NULL
    CHECK (compliance_type IN ('medical','safety','lighting_certificate','inspection','insurance','calibration','hygiene','other')),
  valid_from date,
  valid_to date,
  status text DEFAULT 'valid',
  file_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 15. asset_disposals
CREATE TABLE public.asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  asset_item_id uuid NOT NULL REFERENCES public.asset_items(id) ON DELETE CASCADE,
  disposal_type text NOT NULL CHECK (disposal_type IN ('sale','writeoff','donation','scrap','loss','theft')),
  disposal_date date DEFAULT CURRENT_DATE,
  proceeds_amount numeric(12,2) DEFAULT 0,
  reason text,
  approved_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 16. inventory_alerts
CREATE TABLE public.inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  alert_type text NOT NULL
    CHECK (alert_type IN ('low_stock','expiry_soon','expired','maintenance_due','maintenance_overdue','certification_expiring','lost_item','variance_detected','no_responsible_assigned')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  related_entity_type text,
  related_entity_id uuid,
  due_date date,
  message text,
  status text DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  assigned_to uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 17. inventory_audit_logs
CREATE TABLE public.inventory_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_asset_items_club ON public.asset_items(club_id);
CREATE INDEX idx_asset_items_status ON public.asset_items(asset_status);
CREATE INDEX idx_asset_items_category ON public.asset_items(category_id);
CREATE INDEX idx_stock_items_club ON public.stock_items(club_id);
CREATE INDEX idx_stock_movements_club ON public.stock_movements(club_id);
CREATE INDEX idx_stock_movements_item ON public.stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_team ON public.stock_movements(related_team_id);
CREATE INDEX idx_team_alloc_club ON public.team_equipment_allocations(club_id);
CREATE INDEX idx_team_alloc_team ON public.team_equipment_allocations(team_id);
CREATE INDEX idx_athlete_kit_club ON public.athlete_kit_assignments(club_id);
CREATE INDEX idx_athlete_kit_athlete ON public.athlete_kit_assignments(athlete_id);
CREATE INDEX idx_inventory_alerts_club ON public.inventory_alerts(club_id);
CREATE INDEX idx_inventory_audit_club ON public.inventory_audit_logs(club_id);
CREATE INDEX idx_maintenance_logs_asset ON public.asset_maintenance_logs(asset_item_id);

-- RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_equipment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_kit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for tables WITH club_id
DO $$ 
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'asset_categories','inventory_locations','asset_items',
    'asset_maintenance_plans','asset_maintenance_logs','stock_items',
    'stock_movements','stock_counts','team_equipment_allocations',
    'athlete_kit_assignments','compliance_assets','asset_disposals',
    'inventory_alerts','inventory_audit_logs'
  ] LOOP
    EXECUTE format('CREATE POLICY "Club admin select %1$s" ON public.%1$s FOR SELECT TO authenticated USING (
      public.is_club_financial_admin(auth.uid(), club_id)
    )', tbl);
    EXECUTE format('CREATE POLICY "Club admin insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (
      public.is_club_financial_admin(auth.uid(), club_id)
    )', tbl);
    EXECUTE format('CREATE POLICY "Club admin update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (
      public.is_club_financial_admin(auth.uid(), club_id)
    )', tbl);
  END LOOP;
END $$;

-- RLS for asset_documents (no club_id, derive from parent)
CREATE POLICY "Select asset_documents" ON public.asset_documents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.asset_items ai WHERE ai.id = asset_item_id AND public.is_club_financial_admin(auth.uid(), ai.club_id))
);
CREATE POLICY "Insert asset_documents" ON public.asset_documents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.asset_items ai WHERE ai.id = asset_item_id AND public.is_club_financial_admin(auth.uid(), ai.club_id))
);
CREATE POLICY "Update asset_documents" ON public.asset_documents FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.asset_items ai WHERE ai.id = asset_item_id AND public.is_club_financial_admin(auth.uid(), ai.club_id))
);

-- RLS for stock_batches (no club_id, derive from parent)
CREATE POLICY "Select stock_batches" ON public.stock_batches FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = stock_item_id AND public.is_club_financial_admin(auth.uid(), si.club_id))
);
CREATE POLICY "Insert stock_batches" ON public.stock_batches FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = stock_item_id AND public.is_club_financial_admin(auth.uid(), si.club_id))
);
CREATE POLICY "Update stock_batches" ON public.stock_batches FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = stock_item_id AND public.is_club_financial_admin(auth.uid(), si.club_id))
);

-- RLS for stock_count_lines (no club_id, derive from parent)
CREATE POLICY "Select stock_count_lines" ON public.stock_count_lines FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stock_counts sc WHERE sc.id = stock_count_id AND public.is_club_financial_admin(auth.uid(), sc.club_id))
);
CREATE POLICY "Insert stock_count_lines" ON public.stock_count_lines FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.stock_counts sc WHERE sc.id = stock_count_id AND public.is_club_financial_admin(auth.uid(), sc.club_id))
);
CREATE POLICY "Update stock_count_lines" ON public.stock_count_lines FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stock_counts sc WHERE sc.id = stock_count_id AND public.is_club_financial_admin(auth.uid(), sc.club_id))
);

-- Updated_at triggers
CREATE TRIGGER update_asset_items_updated_at BEFORE UPDATE ON public.asset_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_alloc_updated_at BEFORE UPDATE ON public.team_equipment_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_alerts_updated_at BEFORE UPDATE ON public.inventory_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_categories_updated_at BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_locations_updated_at BEFORE UPDATE ON public.inventory_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
