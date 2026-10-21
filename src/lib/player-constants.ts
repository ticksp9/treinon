import { tx } from '@/lib/i18n/ui';

// labels are getters: they come out in the chosen language whenever they are read
export const POSITIONS = {
  football: [
    { value: 'GK', get label() { return tx('Guarda-Redes'); } },
    { value: 'CB', get label() { return tx('Defesa Central'); } },
    { value: 'LB', get label() { return tx('Lateral Esquerdo'); } },
    { value: 'RB', get label() { return tx('Lateral Direito'); } },
    { value: 'CDM', get label() { return tx('Médio Defensivo'); } },
    { value: 'CM', get label() { return tx('Médio Centro'); } },
    { value: 'CAM', get label() { return tx('Médio Ofensivo'); } },
    { value: 'LM', get label() { return tx('Médio Esquerdo'); } },
    { value: 'RM', get label() { return tx('Médio Direito'); } },
    { value: 'LW', get label() { return tx('Extremo Esquerdo'); } },
    { value: 'RW', get label() { return tx('Extremo Direito'); } },
    { value: 'CF', get label() { return tx('Avançado Centro'); } },
    { value: 'ST', get label() { return tx('Ponta de Lança'); } },
  ],
  futsal: [
    { value: 'GK', get label() { return tx('Guarda-Redes'); } },
    { value: 'FIX', get label() { return tx('Fixo'); } },
    { value: 'ALA', get label() { return tx('Ala'); } },
    { value: 'PIV', get label() { return tx('Pivot'); } },
    { value: 'UNI', get label() { return tx('Universal'); } },
  ],
};

export const INJURY_TYPES = [
  { value: 'muscle', get label() { return tx('Muscular'); } },
  { value: 'ligament', get label() { return tx('Ligamentar'); } },
  { value: 'bone', get label() { return tx('Óssea'); } },
  { value: 'tendon', get label() { return tx('Tendinosa'); } },
  { value: 'contusion', get label() { return tx('Contusão'); } },
  { value: 'sprain', get label() { return tx('Entorse'); } },
  { value: 'other', get label() { return tx('Outra'); } },
];

export const BODY_PARTS = [
  { value: 'head', get label() { return tx('Cabeça'); } },
  { value: 'shoulder', get label() { return tx('Ombro'); } },
  { value: 'arm', get label() { return tx('Braço'); } },
  { value: 'hand', get label() { return tx('Mão'); } },
  { value: 'back', get label() { return tx('Costas'); } },
  { value: 'hip', get label() { return tx('Anca'); } },
  { value: 'thigh', get label() { return tx('Coxa'); } },
  { value: 'knee', get label() { return tx('Joelho'); } },
  { value: 'calf', get label() { return tx('Gémeo'); } },
  { value: 'ankle', get label() { return tx('Tornozelo'); } },
  { value: 'foot', get label() { return tx('Pé'); } },
];

export const SEVERITY_LEVELS = [
  { value: 'minor', get label() { return tx('Ligeira'); }, color: 'bg-yellow-500' },
  { value: 'moderate', get label() { return tx('Moderada'); }, color: 'bg-orange-500' },
  { value: 'severe', get label() { return tx('Grave'); }, color: 'bg-red-500' },
];

export const FOOT_OPTIONS = [
  { value: 'right', get label() { return tx('Direito'); } },
  { value: 'left', get label() { return tx('Esquerdo'); } },
  { value: 'both', get label() { return tx('Ambos'); } },
];

// ID Document types - flexible for international use
export const ID_DOCUMENT_TYPES = [
  { value: 'national_id', get label() { return tx('Cartão de Cidadão / BI'); } },
  { value: 'passport', get label() { return tx('Passaporte'); } },
  { value: 'residence_permit', get label() { return tx('Título de Residência'); } },
  { value: 'birth_certificate', get label() { return tx('Certidão de Nascimento'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];
