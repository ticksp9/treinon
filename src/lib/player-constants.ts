export const POSITIONS = {
  football: [
    { value: 'GK', label: 'Guarda-Redes' },
    { value: 'CB', label: 'Defesa Central' },
    { value: 'LB', label: 'Lateral Esquerdo' },
    { value: 'RB', label: 'Lateral Direito' },
    { value: 'CDM', label: 'Médio Defensivo' },
    { value: 'CM', label: 'Médio Centro' },
    { value: 'CAM', label: 'Médio Ofensivo' },
    { value: 'LM', label: 'Médio Esquerdo' },
    { value: 'RM', label: 'Médio Direito' },
    { value: 'LW', label: 'Extremo Esquerdo' },
    { value: 'RW', label: 'Extremo Direito' },
    { value: 'CF', label: 'Avançado Centro' },
    { value: 'ST', label: 'Ponta de Lança' },
  ],
  futsal: [
    { value: 'GK', label: 'Guarda-Redes' },
    { value: 'FIX', label: 'Fixo' },
    { value: 'ALA', label: 'Ala' },
    { value: 'PIV', label: 'Pivot' },
    { value: 'UNI', label: 'Universal' },
  ],
};

export const INJURY_TYPES = [
  { value: 'muscle', label: 'Muscular' },
  { value: 'ligament', label: 'Ligamentar' },
  { value: 'bone', label: 'Óssea' },
  { value: 'tendon', label: 'Tendinosa' },
  { value: 'contusion', label: 'Contusão' },
  { value: 'sprain', label: 'Entorse' },
  { value: 'other', label: 'Outra' },
];

export const BODY_PARTS = [
  { value: 'head', label: 'Cabeça' },
  { value: 'shoulder', label: 'Ombro' },
  { value: 'arm', label: 'Braço' },
  { value: 'hand', label: 'Mão' },
  { value: 'back', label: 'Costas' },
  { value: 'hip', label: 'Anca' },
  { value: 'thigh', label: 'Coxa' },
  { value: 'knee', label: 'Joelho' },
  { value: 'calf', label: 'Gémeo' },
  { value: 'ankle', label: 'Tornozelo' },
  { value: 'foot', label: 'Pé' },
];

export const SEVERITY_LEVELS = [
  { value: 'minor', label: 'Ligeira', color: 'bg-yellow-500' },
  { value: 'moderate', label: 'Moderada', color: 'bg-orange-500' },
  { value: 'severe', label: 'Grave', color: 'bg-red-500' },
];

export const FOOT_OPTIONS = [
  { value: 'right', label: 'Direito' },
  { value: 'left', label: 'Esquerdo' },
  { value: 'both', label: 'Ambos' },
];

// ID Document types - flexible for international use
export const ID_DOCUMENT_TYPES = [
  { value: 'national_id', label: 'Cartão de Cidadão / BI' },
  { value: 'passport', label: 'Passaporte' },
  { value: 'residence_permit', label: 'Título de Residência' },
  { value: 'birth_certificate', label: 'Certidão de Nascimento' },
  { value: 'other', label: 'Outro' },
];
