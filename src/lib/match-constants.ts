// Match type configurations

export const MATCH_TYPES = {
  championship: {
    label: 'Campeonato',
    description: '2 partes, tempo definido pelo escalão',
    icon: 'Trophy',
    defaultParts: 2,
    allowCustomParts: false,
    allowCustomDuration: false,
    lockedDuringMatch: true,
  },
  friendly: {
    label: 'Amigável',
    description: 'Configurar partes e tempo livremente',
    icon: 'Users',
    defaultParts: 2,
    allowCustomParts: true,
    allowCustomDuration: true,
    lockedDuringMatch: false,
  },
  tournament: {
    label: 'Torneio',
    description: 'Tempo definido, sem alterações durante o jogo',
    icon: 'Award',
    defaultParts: 1,
    allowCustomParts: true,
    allowCustomDuration: true,
    lockedDuringMatch: true,
  },
} as const;

export type MatchType = keyof typeof MATCH_TYPES;

export const COMMON_PART_OPTIONS = [1, 2, 3, 4] as const;

export const COMMON_DURATION_OPTIONS = [
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 25, label: '25 min' },
  { value: 30, label: '30 min' },
  { value: 35, label: '35 min' },
  { value: 40, label: '40 min' },
  { value: 45, label: '45 min' },
] as const;

/**
 * Get the part label for display (e.g., "1ª Parte", "2ª Parte")
 */
export function getPartLabel(partNumber: number, totalParts: number): string {
  if (totalParts === 1) return 'Período Único';
  if (totalParts === 2) {
    return partNumber === 1 ? '1ª Parte' : '2ª Parte';
  }
  return `${partNumber}ª Parte`;
}

/**
 * Get the button label for ending a part
 */
export function getEndPartLabel(currentPart: number, totalParts: number): string {
  if (currentPart >= totalParts) {
    return 'Terminar Jogo';
  }
  if (totalParts === 2) {
    return currentPart === 1 ? 'Terminar 1ª Parte' : 'Terminar 2ª Parte';
  }
  return `Terminar ${currentPart}ª Parte`;
}

/**
 * Get the button label for starting the next part
 */
export function getStartPartLabel(nextPart: number, totalParts: number): string {
  if (totalParts === 2) {
    return `Iniciar ${nextPart === 2 ? '2ª' : '1ª'} Parte`;
  }
  return `Iniciar ${nextPart}ª Parte`;
}

/**
 * Calculate total minutes based on part number and elapsed seconds per part
 */
export function calculateTotalMinutes(
  partElapsedSeconds: number[],
  currentPartSeconds: number,
  currentPart: number
): number {
  let total = 0;
  for (let i = 0; i < currentPart - 1 && i < partElapsedSeconds.length; i++) {
    total += Math.floor(partElapsedSeconds[i] / 60);
  }
  total += Math.floor(currentPartSeconds / 60);
  return total;
}

/**
 * Get display minute for the scoreboard (accounts for previous parts)
 */
export function getDisplayMinute(
  partDurationMinutes: number,
  partElapsedSeconds: number[],
  currentPart: number,
  currentPartSeconds: number
): number {
  // For the current part, calculate base minute from previous parts
  let baseMinute = 0;
  for (let i = 0; i < currentPart - 1; i++) {
    baseMinute += partDurationMinutes;
  }
  return baseMinute + Math.floor(currentPartSeconds / 60);
}
