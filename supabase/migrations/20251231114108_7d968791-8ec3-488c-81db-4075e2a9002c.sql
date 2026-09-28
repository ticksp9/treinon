-- Create table for coordination change history
CREATE TABLE public.coordination_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'team', 'player_assignment', 'coach_assignment', 'age_group'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'player_added', 'player_removed', 'coach_added', 'coach_removed'
  changes JSONB, -- Details of what changed
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.coordination_change_history ENABLE ROW LEVEL SECURITY;

-- Coordinators and admins can view history
CREATE POLICY "Coordinators can view change history"
ON public.coordination_change_history
FOR SELECT
USING (is_youth_coordinator(club_id, auth.uid()));

-- Coordinators and admins can insert history
CREATE POLICY "Coordinators can insert change history"
ON public.coordination_change_history
FOR INSERT
WITH CHECK (is_youth_coordinator(club_id, auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_coordination_change_history_club ON public.coordination_change_history(club_id);
CREATE INDEX idx_coordination_change_history_entity ON public.coordination_change_history(entity_type, entity_id);
CREATE INDEX idx_coordination_change_history_date ON public.coordination_change_history(performed_at DESC);