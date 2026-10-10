/**
 * Catálogo de formações táticas por modalidade.
 *
 * Coordenadas normalizadas [0,1] com origem (0,0) no canto inferior-esquerdo
 * do meio-campo defensivo da equipa. y=0 = linha de fundo defensiva,
 * y=1 = linha de fundo ofensiva. x=0 = lateral esquerda.
 */

export type SportType =
  | 'football_5'
  | 'football_7'
  | 'football_9'
  | 'football_11'
  | 'futsal';

export type SlotRole =
  | 'goalkeeper'
  | 'defender_center' | 'defender_center_left' | 'defender_center_right'
  | 'defender_left' | 'defender_right'
  | 'sweeper'
  | 'midfielder_defensive' | 'midfielder_center'
  | 'midfielder_center_left' | 'midfielder_center_right'
  | 'midfielder_left' | 'midfielder_right'
  | 'midfielder_attacking'
  | 'winger_left' | 'winger_right'
  | 'forward_left' | 'forward_right' | 'forward_center'
  | 'striker'
  | 'pivot' | 'ala_left' | 'ala_right' | 'fixo';

export interface FormationSlot {
  slot_id: string;
  role: SlotRole;
  label: string;
  x: number;
  y: number;
}

export interface Formation {
  code: string;
  name: string;
  sport_type: SportType;
  slots: FormationSlot[];
}

/** Helper de construção. */
const s = (slot_id: string, role: SlotRole, label: string, x: number, y: number): FormationSlot =>
  ({ slot_id, role, label, x, y });

// ─── Futebol 11 ────────────────────────────────────────────────────────────
const F11: Formation[] = [
  {
    code: '4-3-3', name: '4-3-3', sport_type: 'football_11',
    slots: [
      s('GK',  'goalkeeper',          'GR',  0.50, 0.05),
      s('LB',  'defender_left',       'LD',  0.15, 0.25),
      s('LCB', 'defender_center_left','DCE', 0.37, 0.20),
      s('RCB', 'defender_center_right','DCD',0.63, 0.20),
      s('RB',  'defender_right',      'LE',  0.85, 0.25),
      s('LCM', 'midfielder_center_left',  'MCE', 0.30, 0.50),
      s('CM',  'midfielder_center',   'MC',  0.50, 0.45),
      s('RCM', 'midfielder_center_right', 'MCD', 0.70, 0.50),
      s('LW',  'winger_left',         'EE',  0.15, 0.80),
      s('ST',  'striker',             'PL',  0.50, 0.85),
      s('RW',  'winger_right',        'ED',  0.85, 0.80),
    ],
  },
  {
    code: '4-4-2', name: '4-4-2', sport_type: 'football_11',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.15,0.25),
      s('LCB','defender_center_left','DCE',0.37,0.20),
      s('RCB','defender_center_right','DCD',0.63,0.20),
      s('RB','defender_right','LE',0.85,0.25),
      s('LM','midfielder_left','ME',0.15,0.55),
      s('LCM','midfielder_center_left','MCE',0.37,0.50),
      s('RCM','midfielder_center_right','MCD',0.63,0.50),
      s('RM','midfielder_right','MD',0.85,0.55),
      s('LST','forward_left','PLE',0.40,0.85),
      s('RST','forward_right','PLD',0.60,0.85),
    ],
  },
  {
    code: '3-5-2', name: '3-5-2', sport_type: 'football_11',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LCB','defender_center_left','DCE',0.30,0.20),
      s('CB','defender_center','DC',0.50,0.18),
      s('RCB','defender_center_right','DCD',0.70,0.20),
      s('LWB','midfielder_left','ALE',0.10,0.50),
      s('LCM','midfielder_center_left','MCE',0.35,0.50),
      s('CM','midfielder_center','MC',0.50,0.45),
      s('RCM','midfielder_center_right','MCD',0.65,0.50),
      s('RWB','midfielder_right','ALD',0.90,0.50),
      s('LST','forward_left','PLE',0.40,0.85),
      s('RST','forward_right','PLD',0.60,0.85),
    ],
  },
  {
    code: '3-4-3', name: '3-4-3', sport_type: 'football_11',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LCB','defender_center_left','DCE',0.30,0.20),
      s('CB','defender_center','DC',0.50,0.18),
      s('RCB','defender_center_right','DCD',0.70,0.20),
      s('LM','midfielder_left','ME',0.15,0.50),
      s('LCM','midfielder_center_left','MCE',0.37,0.50),
      s('RCM','midfielder_center_right','MCD',0.63,0.50),
      s('RM','midfielder_right','MD',0.85,0.50),
      s('LW','winger_left','EE',0.20,0.85),
      s('ST','striker','PL',0.50,0.88),
      s('RW','winger_right','ED',0.80,0.85),
    ],
  },
  {
    code: '4-2-3-1', name: '4-2-3-1', sport_type: 'football_11',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.15,0.25),
      s('LCB','defender_center_left','DCE',0.37,0.20),
      s('RCB','defender_center_right','DCD',0.63,0.20),
      s('RB','defender_right','LE',0.85,0.25),
      s('LDM','midfielder_defensive','MDE',0.37,0.40),
      s('RDM','midfielder_defensive','MDD',0.63,0.40),
      s('LAM','midfielder_attacking','MOE',0.20,0.65),
      s('CAM','midfielder_attacking','MOC',0.50,0.65),
      s('RAM','midfielder_attacking','MOD',0.80,0.65),
      s('ST','striker','PL',0.50,0.88),
    ],
  },
  {
    code: '5-3-2', name: '5-3-2', sport_type: 'football_11',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LWB','defender_left','LD',0.10,0.30),
      s('LCB','defender_center_left','DCE',0.30,0.20),
      s('CB','defender_center','DC',0.50,0.18),
      s('RCB','defender_center_right','DCD',0.70,0.20),
      s('RWB','defender_right','LE',0.90,0.30),
      s('LCM','midfielder_center_left','MCE',0.30,0.55),
      s('CM','midfielder_center','MC',0.50,0.50),
      s('RCM','midfielder_center_right','MCD',0.70,0.55),
      s('LST','forward_left','PLE',0.40,0.85),
      s('RST','forward_right','PLD',0.60,0.85),
    ],
  },
];

// ─── Futebol 9 ─────────────────────────────────────────────────────────────
const F9: Formation[] = [
  {
    code: '3-3-2', name: '3-3-2', sport_type: 'football_9',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.20,0.22),
      s('CB','defender_center','DC',0.50,0.18),
      s('RB','defender_right','LE',0.80,0.22),
      s('LM','midfielder_center_left','MCE',0.25,0.55),
      s('CM','midfielder_center','MC',0.50,0.50),
      s('RM','midfielder_center_right','MCD',0.75,0.55),
      s('LST','forward_left','PLE',0.35,0.85),
      s('RST','forward_right','PLD',0.65,0.85),
    ],
  },
  {
    code: '3-2-3', name: '3-2-3', sport_type: 'football_9',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.20,0.22),
      s('CB','defender_center','DC',0.50,0.18),
      s('RB','defender_right','LE',0.80,0.22),
      s('LDM','midfielder_defensive','MDE',0.35,0.45),
      s('RDM','midfielder_defensive','MDD',0.65,0.45),
      s('LW','winger_left','EE',0.20,0.80),
      s('ST','striker','PL',0.50,0.85),
      s('RW','winger_right','ED',0.80,0.80),
    ],
  },
  {
    code: '3-4-1', name: '3-4-1', sport_type: 'football_9',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.20,0.22),
      s('CB','defender_center','DC',0.50,0.18),
      s('RB','defender_right','LE',0.80,0.22),
      s('LM','midfielder_left','ME',0.15,0.55),
      s('LCM','midfielder_center_left','MCE',0.38,0.50),
      s('RCM','midfielder_center_right','MCD',0.62,0.50),
      s('RM','midfielder_right','MD',0.85,0.55),
      s('ST','striker','PL',0.50,0.85),
    ],
  },
];

// ─── Futebol 7 ─────────────────────────────────────────────────────────────
const F7: Formation[] = [
  {
    code: '2-3-1', name: '2-3-1', sport_type: 'football_7',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_center_left','DE',0.30,0.22),
      s('RB','defender_center_right','DD',0.70,0.22),
      s('LM','midfielder_left','ME',0.20,0.55),
      s('CM','midfielder_center','MC',0.50,0.50),
      s('RM','midfielder_right','MD',0.80,0.55),
      s('ST','striker','PL',0.50,0.85),
    ],
  },
  {
    code: '3-2-1', name: '3-2-1', sport_type: 'football_7',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.22,0.22),
      s('CB','defender_center','DC',0.50,0.20),
      s('RB','defender_right','LE',0.78,0.22),
      s('LM','midfielder_center_left','MCE',0.35,0.55),
      s('RM','midfielder_center_right','MCD',0.65,0.55),
      s('ST','striker','PL',0.50,0.85),
    ],
  },
  {
    code: '2-2-2', name: '2-2-2', sport_type: 'football_7',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_center_left','DE',0.30,0.22),
      s('RB','defender_center_right','DD',0.70,0.22),
      s('LM','midfielder_center_left','MCE',0.35,0.50),
      s('RM','midfielder_center_right','MCD',0.65,0.50),
      s('LST','forward_left','PLE',0.35,0.85),
      s('RST','forward_right','PLD',0.65,0.85),
    ],
  },
  {
    code: '3-1-2', name: '3-1-2', sport_type: 'football_7',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_left','LD',0.22,0.22),
      s('CB','defender_center','DC',0.50,0.20),
      s('RB','defender_right','LE',0.78,0.22),
      s('CM','midfielder_center','MC',0.50,0.50),
      s('LST','forward_left','PLE',0.35,0.85),
      s('RST','forward_right','PLD',0.65,0.85),
    ],
  },
];

// ─── Futebol 5 ─────────────────────────────────────────────────────────────
const F5: Formation[] = [
  {
    code: '1-2-1', name: '1-2-1', sport_type: 'football_5',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('CB','defender_center','DC',0.50,0.22),
      s('LM','midfielder_center_left','MCE',0.30,0.55),
      s('RM','midfielder_center_right','MCD',0.70,0.55),
      s('ST','striker','PL',0.50,0.85),
    ],
  },
  {
    code: '2-1-1', name: '2-1-1', sport_type: 'football_5',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('LB','defender_center_left','DE',0.30,0.22),
      s('RB','defender_center_right','DD',0.70,0.22),
      s('CM','midfielder_center','MC',0.50,0.55),
      s('ST','striker','PL',0.50,0.85),
    ],
  },
  {
    code: '1-1-2', name: '1-1-2', sport_type: 'football_5',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('CB','defender_center','DC',0.50,0.22),
      s('CM','midfielder_center','MC',0.50,0.55),
      s('LST','forward_left','PLE',0.35,0.85),
      s('RST','forward_right','PLD',0.65,0.85),
    ],
  },
];

// ─── Futsal ────────────────────────────────────────────────────────────────
const FUTSAL: Formation[] = [
  {
    code: '1-2-1', name: '1-2-1 (Quadrado)', sport_type: 'futsal',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('FIXO','fixo','Fixo',0.50,0.25),
      s('ALE','ala_left','Ala E',0.20,0.55),
      s('ALD','ala_right','Ala D',0.80,0.55),
      s('PIV','pivot','Pivô',0.50,0.85),
    ],
  },
  {
    code: '2-2', name: '2-2', sport_type: 'futsal',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('FIXE','defender_center_left','Fixo E',0.35,0.30),
      s('FIXD','defender_center_right','Fixo D',0.65,0.30),
      s('ALE','ala_left','Ala E',0.30,0.80),
      s('ALD','ala_right','Ala D',0.70,0.80),
    ],
  },
  {
    code: '3-1', name: '3-1', sport_type: 'futsal',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('FIXO','fixo','Fixo',0.50,0.25),
      s('ALE','ala_left','Ala E',0.25,0.50),
      s('ALD','ala_right','Ala D',0.75,0.50),
      s('PIV','pivot','Pivô',0.50,0.85),
    ],
  },
  {
    code: '1-3', name: '1-3', sport_type: 'futsal',
    slots: [
      s('GK','goalkeeper','GR',0.50,0.05),
      s('FIXO','fixo','Fixo',0.50,0.25),
      s('ALE','ala_left','Ala E',0.25,0.75),
      s('PIV','pivot','Pivô',0.50,0.80),
      s('ALD','ala_right','Ala D',0.75,0.75),
    ],
  },
];

const ALL_FORMATIONS: Record<SportType, Formation[]> = {
  football_5: F5,
  football_7: F7,
  football_9: F9,
  football_11: F11,
  futsal: FUTSAL,
};

// ─── Formações do treinador ────────────────────────────────────────────────
// A coach plays in shapes the catalogue does not have (e.g. 4-1-2-1 in football 9).
// Any "a-b-c" whose numbers add up to the outfield players is a valid formation:
// the lines are laid out from defence to attack, evenly spread.

/** "4-1-2-1", "4 1 2 1", "4.1.2.1" → [4,1,2,1]; null when it is not a list of lines. */
export function parseFormationCode(input: string): number[] | null {
  const parts = (input ?? '').trim().split(/[^0-9]+/).filter(Boolean).map(Number);
  if (parts.length < 2 || parts.length > 5 || parts.some((n) => n < 1 || n > 6)) return null;
  return parts;
}
export const normalizeFormationCode = (lines: number[]) => lines.join('-');

/** Why a typed formation cannot be used for this sport (null = it is fine). */
export function formationCodeProblem(sportType: SportType | string, input: string): string | null {
  const lines = parseFormationCode(input);
  if (!lines) return 'Escreva as linhas da defesa para o ataque, separadas por hífen (ex.: 4-1-2-1).';
  const outfield = expectedPlayersForSport(sportType) - 1;
  const sum = lines.reduce((a, b) => a + b, 0);
  if (sum !== outfield) return `As linhas têm de somar ${outfield} jogadores de campo (o guarda-redes não conta); ${normalizeFormationCode(lines)} soma ${sum}.`;
  return null;
}

/** Builds the formation for a valid code; undefined when the code does not fit the sport. */
export function buildFormationFromCode(sportType: SportType | string, input: string): Formation | undefined {
  if (formationCodeProblem(sportType, input)) return undefined;
  const lines = parseFormationCode(input)!;
  const L = lines.length;
  const slots: FormationSlot[] = [s('GK', 'goalkeeper', 'GR', 0.5, 0.05)];
  lines.forEach((n, li) => {
    const y = L === 1 ? 0.5 : 0.2 + (li * 0.65) / (L - 1);
    const spread = n === 1 ? 0 : Math.min(0.7 / (n - 1), 0.3);
    const kind: 'D' | 'M' | 'A' = li === 0 ? 'D' : li === L - 1 ? 'A' : 'M';
    for (let j = 0; j < n; j++) {
      const x = 0.5 + (j - (n - 1) / 2) * spread;
      const side = x < 0.42 ? 'L' : x > 0.58 ? 'R' : 'C';
      let role: SlotRole, label: string;
      if (kind === 'D') {
        const wide = n >= 3 && (j === 0 || j === n - 1);
        role = wide ? (side === 'L' ? 'defender_left' : 'defender_right') : side === 'L' ? 'defender_center_left' : side === 'R' ? 'defender_center_right' : 'defender_center';
        label = wide ? (side === 'L' ? 'DE' : 'DD') : 'DC';
      } else if (kind === 'A') {
        role = n === 1 ? 'striker' : side === 'L' ? 'forward_left' : side === 'R' ? 'forward_right' : 'forward_center';
        label = n === 1 || side === 'C' ? 'PL' : side === 'L' ? 'EE' : 'ED';
      } else if (n === 1) {
        // a lone midfielder: holding when he is the first line after the defence, playmaker otherwise
        role = li === 1 && L > 3 ? 'midfielder_defensive' : li === L - 2 && L > 3 ? 'midfielder_attacking' : 'midfielder_center';
        label = role === 'midfielder_defensive' ? 'MDC' : role === 'midfielder_attacking' ? 'MOC' : 'MC';
      } else {
        const wide = n >= 3 && (j === 0 || j === n - 1);
        role = wide ? (side === 'L' ? 'midfielder_left' : 'midfielder_right') : side === 'L' ? 'midfielder_center_left' : side === 'R' ? 'midfielder_center_right' : 'midfielder_center';
        label = side === 'L' ? 'ME' : side === 'R' ? 'MD' : 'MC';
      }
      slots.push(s(`L${li + 1}P${j + 1}`, role, label, Math.round(x * 100) / 100, Math.round(y * 100) / 100));
    }
  });
  const code = normalizeFormationCode(lines);
  return { code, name: code, sport_type: sportType as SportType, slots };
}

/** the coach's own formations, per sport (filled by lib/custom-formations) */
let CUSTOM: Partial<Record<string, Formation[]>> = {};
export function setCustomFormations(codesBySport: Record<string, string[]>): void {
  const next: Partial<Record<string, Formation[]>> = {};
  for (const [sport, codes] of Object.entries(codesBySport)) {
    const builtIn = new Set((ALL_FORMATIONS[sport as SportType] ?? []).map((f) => f.code));
    const list = [...new Set(codes)].filter((c) => !builtIn.has(c)).map((c) => buildFormationFromCode(sport, c)).filter((f): f is Formation => !!f);
    if (list.length) next[sport] = list;
  }
  CUSTOM = next;
}
export const isBuiltInFormation = (sportType: SportType | string, code: string) =>
  (ALL_FORMATIONS[sportType as SportType] ?? []).some((f) => f.code === code);

export function listAvailableFormations(sportType: SportType | string | null | undefined): Formation[] {
  if (!sportType) return [];
  return [...(ALL_FORMATIONS[sportType as SportType] ?? []), ...(CUSTOM[sportType] ?? [])];
}

export function getFormation(sportType: SportType | string, code: string): Formation | undefined {
  // a formation created on another device (or by a colleague) still draws: any valid code can be built
  return listAvailableFormations(sportType).find(f => f.code === code) ?? buildFormationFromCode(sportType, code);
}

export function expectedPlayersForSport(sportType: SportType | string): number {
  switch (sportType) {
    case 'football_11': return 11;
    case 'football_9': return 9;
    case 'football_7': return 7;
    case 'football_5': return 5;
    case 'futsal': return 5;
    default: return 11;
  }
}

export interface FormationValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateFormation(
  slots: FormationSlot[],
  playersOnField: number,
): FormationValidationResult {
  const issues: string[] = [];
  if (!Array.isArray(slots) || slots.length === 0) {
    issues.push('A formação não tem slots definidos.');
  }
  if (slots.length !== playersOnField) {
    issues.push(`A formação tem ${slots.length} slots mas a equipa joga com ${playersOnField}.`);
  }
  const ids = new Set<string>();
  for (const s of slots) {
    if (ids.has(s.slot_id)) issues.push(`slot_id duplicado: ${s.slot_id}`);
    ids.add(s.slot_id);
    if (s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1) {
      issues.push(`slot ${s.slot_id} tem coordenadas fora de [0,1]`);
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Tradução PT do role para UI. */
export const ROLE_LABELS_PT: Record<string, string> = {
  goalkeeper: 'Guarda-Redes',
  defender_center: 'Defesa Central',
  defender_center_left: 'Defesa Central Esq.',
  defender_center_right: 'Defesa Central Dir.',
  defender_left: 'Lateral Esquerdo',
  defender_right: 'Lateral Direito',
  sweeper: 'Líbero',
  midfielder_defensive: 'Médio Defensivo',
  midfielder_center: 'Médio Centro',
  midfielder_center_left: 'Médio C. Esq.',
  midfielder_center_right: 'Médio C. Dir.',
  midfielder_left: 'Médio Esquerdo',
  midfielder_right: 'Médio Direito',
  midfielder_attacking: 'Médio Ofensivo',
  winger_left: 'Extremo Esquerdo',
  winger_right: 'Extremo Direito',
  forward_left: 'Avançado Esquerdo',
  forward_right: 'Avançado Direito',
  forward_center: 'Avançado Centro',
  striker: 'Ponta de Lança',
  pivot: 'Pivô',
  ala_left: 'Ala Esquerda',
  ala_right: 'Ala Direita',
  fixo: 'Fixo',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS_PT[role] ?? role;
}
