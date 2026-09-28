// Business logic for Medical / Health module

export interface ExamComplianceItem {
  person_id: string;
  exam_type_code: string;
  status: string;
  expiry_date: string | null;
}

export interface InjuryCaseSummary {
  id: string;
  person_id: string;
  severity: string;
  case_status: string;
  event_date: string;
  expected_days_out: number | null;
  actual_days_out: number | null;
  body_area: string;
}

export interface ClearanceSummary {
  person_id: string;
  clearance_type: string;
  clearance_status: string;
  valid_to: string | null;
}

// Compute squad fitness overview
export function computeSquadFitness(clearances: ClearanceSummary[]) {
  let fit = 0, fitRestricted = 0, unfit = 0, pending = 0;
  for (const c of clearances) {
    if (c.clearance_type !== 'global') continue;
    switch (c.clearance_status) {
      case 'fit': fit++; break;
      case 'fit_restricted': fitRestricted++; break;
      case 'unfit': case 'unfit_training': case 'unfit_match': unfit++; break;
      default: pending++; break;
    }
  }
  return { fit, fitRestricted, unfit, pending, total: fit + fitRestricted + unfit + pending };
}

// Compute exam compliance rate
export function computeExamCompliance(exams: ExamComplianceItem[], today: Date = new Date()) {
  const todayStr = today.toISOString().slice(0, 10);
  let valid = 0, expired = 0, expiringSoon = 0, missing = 0;
  
  for (const e of exams) {
    if (e.status === 'validated' && e.expiry_date) {
      if (e.expiry_date < todayStr) expired++;
      else {
        const expiryMs = new Date(e.expiry_date).getTime() - today.getTime();
        const daysUntilExpiry = Math.floor(expiryMs / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) expiringSoon++;
        else valid++;
      }
    } else if (e.status === 'scheduled' || e.status === 'in_progress') {
      missing++;
    } else {
      missing++;
    }
  }
  
  const total = valid + expired + expiringSoon + missing;
  const complianceRate = total > 0 ? Math.round((valid / total) * 100) : 0;
  return { valid, expired, expiringSoon, missing, total, complianceRate };
}

// Compute injury statistics
export function computeInjuryStats(cases: InjuryCaseSummary[]) {
  const active = cases.filter(c => ['open', 'in_assessment', 'in_treatment', 'in_rehab'].includes(c.case_status));
  const closed = cases.filter(c => c.case_status === 'closed');
  
  const totalDaysLost = cases.reduce((sum, c) => sum + (c.actual_days_out || c.expected_days_out || 0), 0);
  const avgRecovery = closed.length > 0
    ? Math.round(closed.reduce((sum, c) => sum + (c.actual_days_out || 0), 0) / closed.length)
    : 0;

  const bySeverity: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const c of cases) {
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    byArea[c.body_area] = (byArea[c.body_area] || 0) + 1;
  }

  const recurrences = cases.filter(c => c.case_status !== 'closed').length > 0
    ? cases.filter(c => (c as any).is_recurrence).length
    : 0;

  return {
    activeCases: active.length,
    closedCases: closed.length,
    totalCases: cases.length,
    totalDaysLost,
    avgRecovery,
    bySeverity,
    byArea,
    recurrences,
  };
}

// Compute days since event
export function computeDaysSince(dateStr: string, today: Date = new Date()): number {
  const d = new Date(dateStr);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// Return-to-play stage labels
export const RTP_STAGES = [
  { value: 'rest', label: 'Repouso' },
  { value: 'partial_training', label: 'Treino Parcial' },
  { value: 'integrated_restricted', label: 'Treino Integrado c/ Restrição' },
  { value: 'full_training', label: 'Treino Completo' },
  { value: 'match_ready', label: 'Liberado para Jogo' },
  { value: 'post_return_monitoring', label: 'Monitorização Pós-Retorno' },
];

export const CLEARANCE_STATUSES = [
  { value: 'fit', label: 'Apto', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'fit_restricted', label: 'Apto c/ Restrições', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'unfit', label: 'Inapto', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'unfit_training', label: 'Inapto p/ Treino', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'unfit_match', label: 'Inapto p/ Jogo', color: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
  { value: 'pending', label: 'Pendente', color: 'bg-gray-500/20 text-gray-700 border-gray-500/30' },
];

export const EXAM_CATEGORIES = [
  { value: 'admissional', label: 'Admissional' },
  { value: 'annual', label: 'Anual Obrigatório' },
  { value: 'return_post_injury', label: 'Retorno Pós-Lesão' },
  { value: 'cardiac', label: 'Cardiológico' },
  { value: 'orthopedic', label: 'Ortopédico' },
  { value: 'physiological', label: 'Fisiológico' },
  { value: 'imaging', label: 'Imagem' },
  { value: 'laboratory', label: 'Laboratorial' },
  { value: 'functional', label: 'Avaliação Funcional' },
  { value: 'other', label: 'Outro' },
];

export const INJURY_CASE_STATUSES = [
  { value: 'open', label: 'Aberto', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'in_assessment', label: 'Em Avaliação', color: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
  { value: 'in_treatment', label: 'Em Tratamento', color: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
  { value: 'in_rehab', label: 'Em Reabilitação', color: 'bg-purple-500/20 text-purple-700 border-purple-500/30' },
  { value: 'return_progressive', label: 'Retorno Progressivo', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'closed', label: 'Encerrado', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
];

export const INJURY_CONTEXTS = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'gym', label: 'Ginásio' },
  { value: 'travel', label: 'Deslocação' },
  { value: 'other', label: 'Outro' },
];

export const PHYSIO_MODALITIES = [
  { value: 'manual_therapy', label: 'Terapia Manual' },
  { value: 'electrotherapy', label: 'Eletroterapia' },
  { value: 'cryotherapy', label: 'Crioterapia' },
  { value: 'thermotherapy', label: 'Termoterapia' },
  { value: 'ultrasound', label: 'Ultrassom' },
  { value: 'laser', label: 'Laser' },
  { value: 'exercise_therapy', label: 'Cinesioterapia' },
  { value: 'hydrotherapy', label: 'Hidroterapia' },
  { value: 'massage', label: 'Massagem' },
  { value: 'taping', label: 'Taping/Ligaduras' },
  { value: 'stretching', label: 'Alongamento' },
  { value: 'proprioception', label: 'Proprioceção' },
  { value: 'other', label: 'Outra' },
];
