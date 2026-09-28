export const SPORT_TYPES = {
  football_5: {
    label: 'Futebol 5',
    players: 5,
    formations: ['2-1-1', '1-2-1', '2-2', '1-1-2'],
  },
  football_7: {
    label: 'Futebol 7',
    players: 7,
    formations: ['3-2-1', '2-3-1', '3-1-2', '2-2-2'],
  },
  football_9: {
    label: 'Futebol 9',
    players: 9,
    formations: ['3-3-2', '3-2-3', '4-2-2', '4-3-1'],
  },
  football_11: {
    label: 'Futebol 11',
    players: 11,
    formations: ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '3-4-3', '5-3-2', '4-1-4-1'],
  },
  futsal: {
    label: 'Futsal',
    players: 5,
    formations: ['2-2', '1-2-1', '3-1', '1-1-2', '4-0'],
  },
} as const;

export type SportType = keyof typeof SPORT_TYPES;

export const POSITIONS = {
  GK: 'Guarda-Redes',
  DEF: 'Defesa',
  MID: 'Médio',
  FWD: 'Avançado',
  PIV: 'Pivot',
  ALA: 'Ala',
  FIX: 'Fixo',
} as const;

// Escalões com idades máximas (ano de nascimento baseado na época)
// halfDurationMinutes = duração de cada parte em minutos
export const AGE_CATEGORIES = [
  { value: 'Sub-7', label: 'Sub-7 (Petizes)', maxAge: 6, minAge: 4, halfDurationMinutes: 15 },
  { value: 'Sub-8', label: 'Sub-8 (Traquinas B)', maxAge: 7, minAge: 5, halfDurationMinutes: 20 },
  { value: 'Sub-9', label: 'Sub-9 (Traquinas A)', maxAge: 8, minAge: 6, halfDurationMinutes: 20 },
  { value: 'Sub-10', label: 'Sub-10 (Benjamins B)', maxAge: 9, minAge: 7, halfDurationMinutes: 25 },
  { value: 'Sub-11', label: 'Sub-11 (Benjamins A)', maxAge: 10, minAge: 8, halfDurationMinutes: 25 },
  { value: 'Sub-12', label: 'Sub-12 (Infantis B)', maxAge: 11, minAge: 9, halfDurationMinutes: 30 },
  { value: 'Sub-13', label: 'Sub-13 (Infantis A)', maxAge: 12, minAge: 10, halfDurationMinutes: 30 },
  { value: 'Sub-14', label: 'Sub-14 (Iniciados B)', maxAge: 13, minAge: 11, halfDurationMinutes: 35 },
  { value: 'Sub-15', label: 'Sub-15 (Iniciados A)', maxAge: 14, minAge: 12, halfDurationMinutes: 35 },
  { value: 'Sub-16', label: 'Sub-16 (Juvenis B)', maxAge: 15, minAge: 13, halfDurationMinutes: 40 },
  { value: 'Sub-17', label: 'Sub-17 (Juvenis A)', maxAge: 16, minAge: 14, halfDurationMinutes: 40 },
  { value: 'Sub-18', label: 'Sub-18 (Juniores C)', maxAge: 17, minAge: 15, halfDurationMinutes: 45 },
  { value: 'Sub-19', label: 'Sub-19 (Juniores B)', maxAge: 18, minAge: 16, halfDurationMinutes: 45 },
  { value: 'Sub-21', label: 'Sub-21 (Juniores A)', maxAge: 20, minAge: 18, halfDurationMinutes: 45 },
  { value: 'Sub-23', label: 'Sub-23', maxAge: 22, minAge: 19, halfDurationMinutes: 45 },
  { value: 'Seniores', label: 'Seniores', maxAge: 99, minAge: 17, halfDurationMinutes: 45 },
  { value: 'Veteranos', label: 'Veteranos (+35)', maxAge: 99, minAge: 35, halfDurationMinutes: 45 },
] as const;

/**
 * Obtém a duração de cada parte em minutos para um escalão
 */
export function getHalfDurationForCategory(category: string | null | undefined): number {
  if (!category) return 45; // Default para 45 minutos
  const ageCategory = AGE_CATEGORIES.find(c => c.value === category);
  return ageCategory?.halfDurationMinutes || 45;
}

export const CATEGORIES = AGE_CATEGORIES.map(c => c.value);

export const GENDERS = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
] as const;

export type Gender = 'male' | 'female';

export const CURRENT_SEASONS = [
  '2024/2025',
  '2025/2026',
  '2023/2024',
] as const;

/**
 * Calcula a idade de um jogador numa determinada data (ex: início da época)
 */
export function calculateAge(birthDate: string, referenceDate?: Date): number {
  const birth = new Date(birthDate);
  const ref = referenceDate || new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Verifica se um jogador pode jogar num determinado escalão
 * Regras:
 * - Jogador deve ter idade <= maxAge do escalão
 * - Jogadores mais novos podem jogar em escalões superiores
 * - No futebol masculino, jogadoras femininas podem jogar até 2 anos acima
 * - No futebol feminino, esta exceção não se aplica
 */
export function canPlayerPlayInCategory(
  playerBirthDate: string,
  category: string,
  teamGender: Gender,
  playerIsFemale: boolean = false,
  seasonStartDate?: Date
): { eligible: boolean; reason?: string } {
  const ageCategory = AGE_CATEGORIES.find(c => c.value === category);
  if (!ageCategory) {
    return { eligible: false, reason: 'Escalão não encontrado' };
  }

  // Calcular idade no início da época (1 de Janeiro)
  const seasonStart = seasonStartDate || new Date(new Date().getFullYear(), 0, 1);
  const playerAge = calculateAge(playerBirthDate, seasonStart);

  // Jogadores mais novos podem sempre jogar em escalões superiores
  if (playerAge < ageCategory.minAge) {
    return { eligible: true, reason: 'Jogador mais novo que o escalão' };
  }

  // Verificar idade máxima
  let maxAgeAllowed = ageCategory.maxAge;

  // Exceção: jogadoras femininas em equipas masculinas podem jogar 2 anos acima
  if (teamGender === 'male' && playerIsFemale) {
    maxAgeAllowed += 2;
  }

  if (playerAge > maxAgeAllowed) {
    const reason = teamGender === 'male' && playerIsFemale
      ? `Idade ${playerAge} anos excede o limite de ${maxAgeAllowed} anos (${ageCategory.maxAge} + 2 para feminino)`
      : `Idade ${playerAge} anos excede o limite de ${maxAgeAllowed} anos`;
    return { eligible: false, reason };
  }

  return { eligible: true };
}

/**
 * Obtém os escalões elegíveis para um jogador
 */
export function getEligibleCategories(
  playerBirthDate: string,
  teamGender: Gender,
  playerIsFemale: boolean = false,
  seasonStartDate?: Date
): typeof AGE_CATEGORIES[number][] {
  return AGE_CATEGORIES.filter(category => 
    canPlayerPlayInCategory(playerBirthDate, category.value, teamGender, playerIsFemale, seasonStartDate).eligible
  );
}
