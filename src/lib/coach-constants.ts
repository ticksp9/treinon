import { tx } from '@/lib/i18n/ui';
export const DIPLOMA_LEVELS = [
  { value: 'level_1', get label() { return tx('Nível I - Treinador de Grau I'); } },
  { value: 'level_2', get label() { return tx('Nível II - Treinador de Grau II'); } },
  { value: 'level_3', get label() { return tx('Nível III - Treinador de Grau III'); } },
  { value: 'level_4', get label() { return tx('Nível IV - Treinador de Grau IV'); } },
  { value: 'uefa_c', get label() { return tx('UEFA C'); } },
  { value: 'uefa_b', get label() { return tx('UEFA B'); } },
  { value: 'uefa_a', get label() { return tx('UEFA A'); } },
  { value: 'uefa_pro', get label() { return tx('UEFA Pro'); } },
  { value: 'goalkeeper', get label() { return tx('Treinador de Guarda-Redes'); } },
  { value: 'fitness', get label() { return tx('Preparador Físico'); } },
  { value: 'youth', get label() { return tx('Formação de Jovens'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

export const COACHING_ROLES = [
  { value: 'head_coach', get label() { return tx('Treinador Principal'); } },
  { value: 'assistant', get label() { return tx('Treinador Adjunto'); } },
  { value: 'goalkeeper_coach', get label() { return tx('Treinador de Guarda-Redes'); } },
  { value: 'fitness_coach', get label() { return tx('Preparador Físico'); } },
  { value: 'youth_coach', get label() { return tx('Treinador de Formação'); } },
  { value: 'scout', get label() { return tx('Observador'); } },
  { value: 'analyst', get label() { return tx('Analista'); } },
  { value: 'coordinator', get label() { return tx('Coordenador Técnico'); } },
];

export const AGE_GROUPS = [
  { value: 'sub-7', get label() { return tx('Sub-7 (Petizes)'); } },
  { value: 'sub-9', get label() { return tx('Sub-9 (Traquinas)'); } },
  { value: 'sub-10', get label() { return tx('Sub-10 (Benjamins B)'); } },
  { value: 'sub-11', get label() { return tx('Sub-11 (Benjamins)'); } },
  { value: 'sub-13', get label() { return tx('Sub-13 (Infantis)'); } },
  { value: 'sub-15', get label() { return tx('Sub-15 (Iniciados)'); } },
  { value: 'sub-17', get label() { return tx('Sub-17 (Juvenis)'); } },
  { value: 'sub-19', get label() { return tx('Sub-19 (Juniores)'); } },
  { value: 'sub-23', get label() { return tx('Sub-23'); } },
  { value: 'senior', get label() { return tx('Seniores'); } },
  { value: 'veteran', get label() { return tx('Veteranos'); } },
];

export const FOCUS_AREAS = [
  { value: 'offensive', get label() { return tx('Ofensivo'); } },
  { value: 'defensive', get label() { return tx('Defensivo'); } },
  { value: 'possession', get label() { return tx('Posse de Bola'); } },
  { value: 'transitions', get label() { return tx('Transições'); } },
  { value: 'physical', get label() { return tx('Físico'); } },
  { value: 'technical', get label() { return tx('Técnico'); } },
  { value: 'tactical', get label() { return tx('Tático'); } },
  { value: 'goalkeeper', get label() { return tx('Guarda-Redes'); } },
  { value: 'set_pieces', get label() { return tx('Bolas Paradas'); } },
  { value: 'finishing', get label() { return tx('Finalização'); } },
  { value: 'passing', get label() { return tx('Passe e Receção'); } },
  { value: 'pressing', get label() { return tx('Pressing'); } },
  { value: 'recovery', get label() { return tx('Recuperação'); } },
];

export const SPECIALIZATIONS = [
  { value: 'attack', get label() { return tx('Ataque'); } },
  { value: 'defense', get label() { return tx('Defesa'); } },
  { value: 'midfield', get label() { return tx('Meio-Campo'); } },
  { value: 'set_pieces', get label() { return tx('Bolas Paradas'); } },
  { value: 'youth_development', get label() { return tx('Desenvolvimento Juvenil'); } },
  { value: 'physical_conditioning', get label() { return tx('Condição Física'); } },
  { value: 'match_analysis', get label() { return tx('Análise de Jogo'); } },
  { value: 'goalkeeper_training', get label() { return tx('Treino de GR'); } },
];

export const FORMATIONS = [
  { value: '4-3-3', get label() { return tx('4-3-3'); } },
  { value: '4-4-2', get label() { return tx('4-4-2'); } },
  { value: '4-2-3-1', get label() { return tx('4-2-3-1'); } },
  { value: '3-5-2', get label() { return tx('3-5-2'); } },
  { value: '3-4-3', get label() { return tx('3-4-3'); } },
  { value: '4-1-4-1', get label() { return tx('4-1-4-1'); } },
  { value: '5-3-2', get label() { return tx('5-3-2'); } },
  { value: '4-5-1', get label() { return tx('4-5-1'); } },
];
