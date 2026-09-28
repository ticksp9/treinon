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

export function listAvailableFormations(sportType: SportType | string | null | undefined): Formation[] {
  if (!sportType) return [];
  return ALL_FORMATIONS[sportType as SportType] ?? [];
}

export function getFormation(sportType: SportType | string, code: string): Formation | undefined {
  return listAvailableFormations(sportType).find(f => f.code === code);
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
