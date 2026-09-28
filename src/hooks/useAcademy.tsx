import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

// ── Types ──
export interface AcademyPlayerProfile {
  id: string;
  player_id: string;
  pathway_status: string;
  age_group_id: string | null;
  season: string | null;
  primary_position: string | null;
  entry_date: string | null;
  origin: string | null;
}

export interface AssessmentScore {
  dimension_id: string;
  score: number | null;
  max_score: number | null;
  weight?: number;
}

export interface DimensionWeight {
  id: string;
  name: string;
  code: string;
  category: string;
  weight: number;
}

export interface GoalSummary {
  total: number;
  open: number;
  in_progress: number;
  achieved: number;
  deferred: number;
  cancelled: number;
  avgProgress: number;
}

// ── Pure business-logic functions ──

export function computeWeightedScore(scores: AssessmentScore[], dimensions: DimensionWeight[]): number {
  const dimMap = new Map(dimensions.map(d => [d.id, d.weight]));
  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of scores) {
    if (s.score == null || s.max_score == null || s.max_score === 0) continue;
    const w = dimMap.get(s.dimension_id) ?? 1;
    weightedSum += (s.score / s.max_score) * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
}

export function computePathwayDistribution(profiles: Array<{ pathway_status: string }>) {
  const dist: Record<string, number> = {};
  for (const p of profiles) {
    dist[p.pathway_status] = (dist[p.pathway_status] || 0) + 1;
  }
  return dist;
}

export function computeGoalSummary(goals: Array<{ status: string; progress_pct: number | null }>): GoalSummary {
  const summary: GoalSummary = { total: goals.length, open: 0, in_progress: 0, achieved: 0, deferred: 0, cancelled: 0, avgProgress: 0 };
  let progressSum = 0;
  for (const g of goals) {
    switch (g.status) {
      case 'open': summary.open++; break;
      case 'in_progress': summary.in_progress++; break;
      case 'achieved': case 'partially_achieved': summary.achieved++; break;
      case 'deferred': summary.deferred++; break;
      case 'cancelled': summary.cancelled++; break;
    }
    progressSum += g.progress_pct ?? 0;
  }
  summary.avgProgress = summary.total > 0 ? progressSum / summary.total : 0;
  return summary;
}

export function computeRetentionRate(profiles: Array<{ pathway_status: string }>): number {
  if (profiles.length === 0) return 0;
  const active = profiles.filter(p => !['released', 'archived'].includes(p.pathway_status)).length;
  return (active / profiles.length) * 100;
}

export function computePromotionRate(profiles: Array<{ pathway_status: string }>): number {
  if (profiles.length === 0) return 0;
  const promoted = profiles.filter(p => p.pathway_status === 'promoted').length;
  return (promoted / profiles.length) * 100;
}

export function computeComplianceScore(items: Array<{ status: string }>): number {
  if (items.length === 0) return 100;
  const compliant = items.filter(i => i.status === 'compliant').length;
  return (compliant / items.length) * 100;
}

export function computeAssessmentCompletion(
  assessments: Array<{ status: string }>,
): { total: number; submitted: number; rate: number } {
  const total = assessments.length;
  const submitted = assessments.filter(a => a.status !== 'draft').length;
  return { total, submitted, rate: total > 0 ? (submitted / total) * 100 : 0 };
}

// ── Hook ──

export function useAcademy() {
  const { clubId } = useUserRole();

  const programs = useQuery({
    queryKey: ['academy-programs', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_programs')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const ageGroups = useQuery({
    queryKey: ['academy-age-groups', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_age_groups')
        .select('*')
        .eq('club_id', clubId)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const playerProfiles = useQuery({
    queryKey: ['academy-player-profiles', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_player_profiles')
        .select('*')
        .eq('club_id', clubId)
        .is('deleted_at', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const assessmentCycles = useQuery({
    queryKey: ['academy-assessment-cycles', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_assessment_cycles')
        .select('*')
        .eq('club_id', clubId)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const assessments = useQuery({
    queryKey: ['academy-assessments', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_assessments')
        .select('*')
        .eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const dimensions = useQuery({
    queryKey: ['academy-dimensions', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_development_dimensions')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const developmentPlans = useQuery({
    queryKey: ['academy-dev-plans', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_development_plans')
        .select('*')
        .eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const promotionReviews = useQuery({
    queryKey: ['academy-promotions', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_promotion_reviews')
        .select('*')
        .eq('club_id', clubId)
        .order('review_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const complianceItems = useQuery({
    queryKey: ['academy-compliance', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_compliance_items')
        .select('*')
        .eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const staffAssignments = useQuery({
    queryKey: ['academy-staff', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_staff_assignments')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const observations = useQuery({
    queryKey: ['academy-observations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('academy_observations')
        .select('*')
        .eq('club_id', clubId)
        .order('observation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  return {
    programs,
    ageGroups,
    playerProfiles,
    assessmentCycles,
    assessments,
    dimensions,
    developmentPlans,
    promotionReviews,
    complianceItems,
    staffAssignments,
    observations,
    clubId,
  };
}
