/**
 * Import players from the club's spreadsheet (xlsx/csv) — pure helpers.
 * Finds the header row on its own (club sheets usually start with a title),
 * guesses which column is which, cleans the values, spots players that already
 * exist, and distributes players by birth year into teams (e.g. 2013+2014 → Sub-13).
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Rows = Cell[][];

export const IMPORT_FIELDS = [
  { key: 'name', label: 'Nome' },
  { key: 'last_name', label: 'Apelido' },
  { key: 'birth_date', label: 'Data de nascimento' },
  { key: 'birth_year', label: 'Ano de nascimento' },
  { key: 'number', label: 'Número' },
  { key: 'position', label: 'Posição' },
  { key: 'foot', label: 'Pé' },
  { key: 'gender', label: 'Sexo' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'parent_name', label: 'Encarregado de educação' },
  { key: 'parent_phone', label: 'Telefone do EE' },
  { key: 'parent_email', label: 'Email do EE' },
  { key: 'federation_id', label: 'Nº de federado / licença' },
  { key: 'nationality', label: 'Nacionalidade' },
] as const;
export type FieldKey = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<FieldKey, number>>;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// header words → field (checked in this order: more specific first)
const HEADER_HINTS: [FieldKey, RegExp][] = [
  ['parent_phone', /^(telefone|telemovel|contacto|tlm|tel)\s*(do\s*)?(ee|enc|encarregado|pai|mae)|^(ee|enc|encarregado)\s*(telefone|telemovel|contacto|tlm|tel)/],
  ['parent_email', /^(e ?mail)\s*(do\s*)?(ee|enc|encarregado|pai|mae)|^(ee|encarregado)\s*e ?mail/],
  ['parent_name', /^(encarregado|enc educacao|ee|nome (do )?ee|pai|mae|nome (do )?encarregado)/],
  ['birth_year', /^(ano( de)? nascimento|ano nasc|ano)$/],
  ['birth_date', /^(data( de)? nascimento|data nasc|dt nasc|d n|dn|nascimento|nascido|birth|data de nasc)/],
  ['last_name', /^(apelido|apelidos|sobrenome|ultimo nome)$/],
  ['name', /^(nome( completo)?( do)?( jogador| atleta)?|primeiro nome|jogador|atleta|name|nome proprio)$/],
  ['number', /^(n|no|n o|num|numero|camisola|n camisola)$/],
  ['position', /^(posicao|posicoes|pos|posicao principal)$/],
  ['foot', /^(pe|pe preferido|pe dominante|lateralidade)$/],
  ['gender', /^(sexo|genero|g)$/],
  ['email', /^(e ?mail|correio eletronico)$/],
  ['phone', /^(telefone|telemovel|contacto|tlm|tel)$/],
  ['federation_id', /^(licenca|n licenca|n federado|federado|fpf|n fpf|cartao|n jogador)/],
  ['nationality', /^(nacionalidade|pais)$/],
];

export function guessField(header: Cell): FieldKey | null {
  if (header == null || header instanceof Date || typeof header !== 'string') return null;
  const h = fold(header);
  if (!h) return null;
  for (const [field, re] of HEADER_HINTS) if (re.test(h)) return field;
  return null;
}

/** Header row = the row (among the first 20) that names the most known fields, and must include a name. */
export function detectHeader(rows: Rows): { headerIndex: number; mapping: Mapping } {
  let best = { headerIndex: -1, mapping: {} as Mapping, score: 0 };
  rows.slice(0, 20).forEach((row, i) => {
    const mapping: Mapping = {};
    row.forEach((cell, col) => {
      const f = guessField(cell);
      if (f && mapping[f] === undefined) mapping[f] = col;
    });
    const score = Object.keys(mapping).length;
    if (mapping.name !== undefined && score > best.score) best = { headerIndex: i, mapping, score };
  });
  if (best.headerIndex >= 0) return { headerIndex: best.headerIndex, mapping: best.mapping };
  // no header: a plain list of names in the first text column
  const firstText = rows.find((r) => r.some((c) => typeof c === 'string' && c.trim()))?.findIndex((c) => typeof c === 'string' && c.trim()) ?? 0;
  return { headerIndex: -1, mapping: { name: Math.max(0, firstText) } };
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validYear = (y: number) => y >= 1940 && y <= new Date().getFullYear();

/** Birth date from a cell: Date, Excel serial number, dd/mm/yyyy, yyyy-mm-dd, or just a year. */
export function parseBirth(dateCell: Cell, yearCell?: Cell): { date: string | null; year: number | null; yearOnly: boolean } {
  const c = dateCell ?? yearCell;
  if (c instanceof Date && !isNaN(c.getTime())) {
    // spreadsheet dates are calendar dates: read them in UTC so the day never shifts
    const y = c.getUTCFullYear();
    return validYear(y) ? { date: iso(y, c.getUTCMonth() + 1, c.getUTCDate()), year: y, yearOnly: false } : { date: null, year: null, yearOnly: false };
  }
  if (typeof c === 'number') {
    if (Number.isInteger(c) && validYear(c)) return { date: iso(c, 1, 1), year: c, yearOnly: true };
    if (c > 10000 && c < 60000) { // Excel serial date
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000);
      return parseBirth(d);
    }
    return { date: null, year: null, yearOnly: false };
  }
  if (typeof c === 'string') {
    const s = c.trim();
    let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
      const mo = Number(m[2]), d = Number(m[1]);
      if (validYear(y) && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { date: iso(y, mo, d), year: y, yearOnly: false };
    }
    m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
    if (m && validYear(Number(m[1]))) return { date: iso(Number(m[1]), Number(m[2]), Number(m[3])), year: Number(m[1]), yearOnly: false };
    m = s.match(/^(\d{4})$/);
    if (m && validYear(Number(m[1]))) return { date: iso(Number(m[1]), 1, 1), year: Number(m[1]), yearOnly: true };
  }
  return { date: null, year: null, yearOnly: false };
}

const POSITION_WORDS: [RegExp, string][] = [
  [/^(gr|guarda redes|guarda-redes|goleiro|gk)$/, 'GK'],
  [/^(dc|defesa central|central|zagueiro|cb)$/, 'CB'],
  [/^(de|lateral esquerdo|defesa esquerdo|le|lb)$/, 'LB'],
  [/^(dd|lateral direito|defesa direito|ld|rb)$/, 'RB'],
  [/^(mdc|trinco|medio defensivo|pivot defensivo|cdm)$/, 'CDM'],
  [/^(mc|medio|medio centro|centrocampista|cm)$/, 'CM'],
  [/^(mo|medio ofensivo|cam|10)$/, 'CAM'],
  [/^(me|medio esquerdo|lm)$/, 'LM'],
  [/^(md|medio direito|rm)$/, 'RM'],
  [/^(ee|extremo esquerdo|ala esquerda|lw)$/, 'LW'],
  [/^(ed|extremo direito|ala direita|rw)$/, 'RW'],
  [/^(pl|ponta de lanca|avancado|avancado centro|ac|st|cf|9)$/, 'ST'],
  [/^(fixo|fix)$/, 'FIX'],
  [/^(ala)$/, 'ALA'],
  [/^(pivo|piv)$/, 'PIV'],
  [/^(universal|uni)$/, 'UNI'],
  [/^(defesa|defensor)$/, 'CB'],
];
export function parsePosition(c: Cell): string | null {
  if (typeof c !== 'string' || !c.trim()) return null;
  const f = fold(c);
  for (const [re, code] of POSITION_WORDS) if (re.test(f)) return code;
  return null;
}
export function parseFoot(c: Cell): string | null {
  if (typeof c !== 'string') return null;
  const f = fold(c);
  if (/^(d|dir|direito|destro|right|r)$/.test(f)) return 'right';
  if (/^(e|esq|esquerdo|canhoto|left|l)$/.test(f)) return 'left';
  if (/^(a|ambos|ambidestro|both)$/.test(f)) return 'both';
  return null;
}
export function parseGender(c: Cell): 'male' | 'female' | null {
  if (typeof c !== 'string') return null;
  const f = fold(c);
  if (/^(m|masc|masculino|rapaz|male)$/.test(f)) return 'male';
  if (/^(f|fem|feminino|rapariga|female)$/.test(f)) return 'female';
  return null;
}

const text = (c: Cell) => (c == null ? '' : c instanceof Date ? '' : String(c).replace(/\s+/g, ' ').trim());
const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();
const looksLikeHeaderOrTotal = (s: string) => /^(nome|jogador|atleta|total|totais|subtotal)$/i.test(fold(s));

export interface ImportRow {
  line: number;
  name: string;
  birth_date: string | null;
  birth_year: number | null;
  birth_year_only: boolean;
  number: number | null;
  position: string | null;
  foot: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  federation_id: string | null;
  nationality: string | null;
}

export function extractPlayers(rows: Rows, headerIndex: number, mapping: Mapping): ImportRow[] {
  const get = (r: Cell[], f: FieldKey) => (mapping[f] === undefined ? undefined : r[mapping[f]!]);
  const out: ImportRow[] = [];
  rows.forEach((r, i) => {
    if (i <= headerIndex) return;
    const first = text(get(r, 'name'));
    const last = text(get(r, 'last_name'));
    const name = cleanName([first, last].filter(Boolean).join(' '));
    if (!name || looksLikeHeaderOrTotal(name) || /^\d+$/.test(name)) return;
    const b = parseBirth(get(r, 'birth_date'), get(r, 'birth_year'));
    const num = Number(text(get(r, 'number')));
    const email = text(get(r, 'email'));
    const pemail = text(get(r, 'parent_email'));
    out.push({
      line: i + 1,
      name,
      birth_date: b.date,
      birth_year: b.year,
      birth_year_only: b.yearOnly,
      number: Number.isInteger(num) && num > 0 && num < 1000 ? num : null,
      position: parsePosition(get(r, 'position')),
      foot: parseFoot(get(r, 'foot')),
      gender: parseGender(get(r, 'gender')),
      phone: text(get(r, 'phone')) || null,
      email: /@/.test(email) ? email : null,
      parent_name: text(get(r, 'parent_name')) || null,
      parent_phone: text(get(r, 'parent_phone')) || null,
      parent_email: /@/.test(pemail) ? pemail : null,
      federation_id: text(get(r, 'federation_id')) || null,
      nationality: text(get(r, 'nationality')) || null,
    });
  });
  return out;
}

/** Same player = same name (accents/case ignored) and, when both are known, same birth year. */
export const playerKey = (name: string) => fold(name);
export function isDuplicate(row: ImportRow, existing: { name: string; birth_date: string | null }[]): boolean {
  const k = playerKey(row.name);
  return existing.some((e) => playerKey(e.name) === k
    && (!row.birth_year || !e.birth_date || Number(e.birth_date.slice(0, 4)) === row.birth_year));
}

/** Simple CSV (comma or semicolon, quotes) → rows. */
export function parseCsv(textIn: string): Rows {
  const t = textIn.replace(/^﻿/, '');
  const firstLine = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: Rows = [];
  let row: Cell[] = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c ?? '').trim()));
}

// ─── Teams by birth year ────────────────────────────────────────────────────
export interface YearTeam { id: string; name: string; category: string | null; birth_years: number[] | null }

/** Suggested birth years for "Sub-N": sporting age N-1 and N-2 in the season (the club adjusts). */
export function suggestBirthYears(category: string | null, seasonStartYear: number): number[] {
  const m = (category ?? '').match(/sub\s*-?\s*(\d{1,2})/i);
  if (!m) return [];
  const n = Number(m[1]);
  return [seasonStartYear - (n - 1), seasonStartYear - (n - 2)].sort((a, b) => a - b);
}

/** Teams a player goes to by birth year (can be more than one: e.g. trains with two age groups). */
export function teamsForYear(year: number | null, teams: YearTeam[]): string[] {
  if (!year) return [];
  return teams.filter((t) => (t.birth_years ?? []).includes(year)).map((t) => t.id);
}
