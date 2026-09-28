export const BODY_AREAS = [
  { value: 'head', label: 'Cabeça' },
  { value: 'neck', label: 'Pescoço' },
  { value: 'shoulder_left', label: 'Ombro Esquerdo' },
  { value: 'shoulder_right', label: 'Ombro Direito' },
  { value: 'arm_left', label: 'Braço Esquerdo' },
  { value: 'arm_right', label: 'Braço Direito' },
  { value: 'elbow_left', label: 'Cotovelo Esquerdo' },
  { value: 'elbow_right', label: 'Cotovelo Direito' },
  { value: 'wrist_left', label: 'Pulso Esquerdo' },
  { value: 'wrist_right', label: 'Pulso Direito' },
  { value: 'hand_left', label: 'Mão Esquerda' },
  { value: 'hand_right', label: 'Mão Direita' },
  { value: 'chest', label: 'Peito' },
  { value: 'back_upper', label: 'Costas (Superior)' },
  { value: 'back_lower', label: 'Costas (Lombar)' },
  { value: 'abdomen', label: 'Abdómen' },
  { value: 'hip_left', label: 'Anca Esquerda' },
  { value: 'hip_right', label: 'Anca Direita' },
  { value: 'groin', label: 'Virilha' },
  { value: 'thigh_left', label: 'Coxa Esquerda' },
  { value: 'thigh_right', label: 'Coxa Direita' },
  { value: 'knee_left', label: 'Joelho Esquerdo' },
  { value: 'knee_right', label: 'Joelho Direito' },
  { value: 'calf_left', label: 'Gémeo Esquerdo' },
  { value: 'calf_right', label: 'Gémeo Direito' },
  { value: 'ankle_left', label: 'Tornozelo Esquerdo' },
  { value: 'ankle_right', label: 'Tornozelo Direito' },
  { value: 'foot_left', label: 'Pé Esquerdo' },
  { value: 'foot_right', label: 'Pé Direito' },
];

export const INJURY_TYPES = [
  { value: 'muscle_strain', label: 'Distensão Muscular' },
  { value: 'muscle_tear', label: 'Rotura Muscular' },
  { value: 'ligament_sprain', label: 'Entorse Ligamentar' },
  { value: 'ligament_tear', label: 'Rotura Ligamentar' },
  { value: 'tendinitis', label: 'Tendinite' },
  { value: 'tendon_tear', label: 'Rotura de Tendão' },
  { value: 'fracture', label: 'Fratura' },
  { value: 'stress_fracture', label: 'Fratura de Stress' },
  { value: 'dislocation', label: 'Luxação' },
  { value: 'contusion', label: 'Contusão' },
  { value: 'concussion', label: 'Concussão' },
  { value: 'meniscus', label: 'Lesão Menisco' },
  { value: 'cartilage', label: 'Lesão Cartilagem' },
  { value: 'overuse', label: 'Sobrecarga' },
  { value: 'inflammation', label: 'Inflamação' },
  { value: 'other', label: 'Outra' },
];

export const INJURY_SEVERITIES = [
  { value: 'mild', label: 'Leve', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'moderate', label: 'Moderada', color: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
  { value: 'severe', label: 'Grave', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'critical', label: 'Crítica', color: 'bg-red-700/20 text-red-900 border-red-700/30' },
];

export const INJURY_STATUSES = [
  { value: 'active', label: 'Ativa', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { value: 'recovering', label: 'Em Recuperação', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'cleared', label: 'Recuperado', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'chronic', label: 'Crónica', color: 'bg-purple-500/20 text-purple-700 border-purple-500/30' },
];

export const REHAB_PHASES = [
  { value: 'initial', label: 'Inicial' },
  { value: 'intermediate', label: 'Intermédia' },
  { value: 'advanced', label: 'Avançada' },
  { value: 'return_to_play', label: 'Retorno ao Jogo' },
];

export const REHAB_STATUSES = [
  { value: 'draft', label: 'Rascunho', color: 'bg-gray-500/20 text-gray-700 border-gray-500/30' },
  { value: 'active', label: 'Ativo', color: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
  { value: 'paused', label: 'Pausado', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' },
  { value: 'completed', label: 'Concluído', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
];

export const EXERCISE_LOCATIONS = [
  { value: 'home', label: 'Casa' },
  { value: 'training', label: 'Treino' },
  { value: 'both', label: 'Ambos' },
];
