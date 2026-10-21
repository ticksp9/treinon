import { tx } from '@/lib/i18n/ui';
export const BODY_AREAS = [
  { value: 'head', get label() { return tx('Cabeça'); } },
  { value: 'neck', get label() { return tx('Pescoço'); } },
  { value: 'shoulder_left', get label() { return tx('Ombro Esquerdo'); } },
  { value: 'shoulder_right', get label() { return tx('Ombro Direito'); } },
  { value: 'arm_left', get label() { return tx('Braço Esquerdo'); } },
  { value: 'arm_right', get label() { return tx('Braço Direito'); } },
  { value: 'elbow_left', get label() { return tx('Cotovelo Esquerdo'); } },
  { value: 'elbow_right', get label() { return tx('Cotovelo Direito'); } },
  { value: 'wrist_left', get label() { return tx('Pulso Esquerdo'); } },
  { value: 'wrist_right', get label() { return tx('Pulso Direito'); } },
  { value: 'hand_left', get label() { return tx('Mão Esquerda'); } },
  { value: 'hand_right', get label() { return tx('Mão Direita'); } },
  { value: 'chest', get label() { return tx('Peito'); } },
  { value: 'back_upper', get label() { return tx('Costas (Superior)'); } },
  { value: 'back_lower', get label() { return tx('Costas (Lombar)'); } },
  { value: 'abdomen', get label() { return tx('Abdómen'); } },
  { value: 'hip_left', get label() { return tx('Anca Esquerda'); } },
  { value: 'hip_right', get label() { return tx('Anca Direita'); } },
  { value: 'groin', get label() { return tx('Virilha'); } },
  { value: 'thigh_left', get label() { return tx('Coxa Esquerda'); } },
  { value: 'thigh_right', get label() { return tx('Coxa Direita'); } },
  { value: 'knee_left', get label() { return tx('Joelho Esquerdo'); } },
  { value: 'knee_right', get label() { return tx('Joelho Direito'); } },
  { value: 'calf_left', get label() { return tx('Gémeo Esquerdo'); } },
  { value: 'calf_right', get label() { return tx('Gémeo Direito'); } },
  { value: 'ankle_left', get label() { return tx('Tornozelo Esquerdo'); } },
  { value: 'ankle_right', get label() { return tx('Tornozelo Direito'); } },
  { value: 'foot_left', get label() { return tx('Pé Esquerdo'); } },
  { value: 'foot_right', get label() { return tx('Pé Direito'); } },
];

export const INJURY_TYPES = [
  { value: 'muscle_strain', get label() { return tx('Distensão Muscular'); } },
  { value: 'muscle_tear', get label() { return tx('Rotura Muscular'); } },
  { value: 'ligament_sprain', get label() { return tx('Entorse Ligamentar'); } },
  { value: 'ligament_tear', get label() { return tx('Rotura Ligamentar'); } },
  { value: 'tendinitis', get label() { return tx('Tendinite'); } },
  { value: 'tendon_tear', get label() { return tx('Rotura de Tendão'); } },
  { value: 'fracture', get label() { return tx('Fratura'); } },
  { value: 'stress_fracture', get label() { return tx('Fratura de Stress'); } },
  { value: 'dislocation', get label() { return tx('Luxação'); } },
  { value: 'contusion', get label() { return tx('Contusão'); } },
  { value: 'concussion', get label() { return tx('Concussão'); } },
  { value: 'meniscus', get label() { return tx('Lesão Menisco'); } },
  { value: 'cartilage', get label() { return tx('Lesão Cartilagem'); } },
  { value: 'overuse', get label() { return tx('Sobrecarga'); } },
  { value: 'inflammation', get label() { return tx('Inflamação'); } },
  { value: 'other', get label() { return tx('Outra'); } },
];

export const INJURY_SEVERITIES = [
  { value: 'mild', get label() { return tx('Leve'); }, color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'moderate', get label() { return tx('Moderada'); }, color: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
  { value: 'severe', get label() { return tx('Grave'); }, color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'critical', get label() { return tx('Crítica'); }, color: 'bg-red-700/20 text-red-900 border-red-700/30' },
];

export const INJURY_STATUSES = [
  { value: 'active', get label() { return tx('Ativa'); }, color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'recovering', get label() { return tx('Em Recuperação'); }, color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'cleared', get label() { return tx('Recuperado'); }, color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'chronic', get label() { return tx('Crónica'); }, color: 'bg-purple-500/20 text-purple-700 border-purple-500/30' },
];

export const REHAB_PHASES = [
  { value: 'initial', get label() { return tx('Inicial'); } },
  { value: 'intermediate', get label() { return tx('Intermédia'); } },
  { value: 'advanced', get label() { return tx('Avançada'); } },
  { value: 'return_to_play', get label() { return tx('Retorno ao Jogo'); } },
];

export const REHAB_STATUSES = [
  { value: 'draft', get label() { return tx('Rascunho'); }, color: 'bg-gray-500/20 text-gray-700 border-gray-500/30' },
  { value: 'active', get label() { return tx('Ativo'); }, color: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
  { value: 'paused', get label() { return tx('Pausado'); }, color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'completed', get label() { return tx('Concluído'); }, color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'cancelled', get label() { return tx('Cancelado'); }, color: 'bg-red-500/20 text-red-700 border-red-500/30' },
];

export const EXERCISE_LOCATIONS = [
  { value: 'home', get label() { return tx('Casa'); } },
  { value: 'training', get label() { return tx('Treino'); } },
  { value: 'both', get label() { return tx('Ambos'); } },
];
