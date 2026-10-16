/**
 * A team's own look: its crest and two colours (main and highlight).
 * The colours replace TreinON's blue and orange while working with that team. Whatever the
 * coach picks, text on the coloured buttons stays readable: the shade is adjusted for light
 * and dark mode, and the text on top is white or black depending on the colour.
 */

export interface TeamTheme { primary?: string | null; accent?: string | null }
export interface BrandingRow { team_id: string; crest_url: string | null; theme: TeamTheme | null; club_logo_url: string | null; club_primary: string | null; club_secondary: string | null }
export interface Branding { crestUrl: string | null; primary: string | null; accent: string | null; fromClub: { crest: boolean; colors: boolean } }

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** The team's own crest and colours; whatever it does not have comes from its club. */
export function resolveBranding(row: BrandingRow | null | undefined): Branding {
  if (!row) return { crestUrl: null, primary: null, accent: null, fromClub: { crest: false, colors: false } };
  const own = isHex(row.theme?.primary);
  const primary = own ? row.theme!.primary! : isHex(row.club_primary) ? row.club_primary : null;
  const accent = isHex(row.theme?.accent) ? row.theme!.accent! : !own && isHex(row.club_secondary) ? row.club_secondary : null;
  return {
    crestUrl: row.crest_url || row.club_logo_url || null,
    primary, accent,
    fromClub: { crest: !row.crest_url && !!row.club_logo_url, colors: !own && !!primary },
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
export const hexToHsl = (hex: string) => rgbToHsl(...hexToRgb(hex));

/** WCAG relative luminance of an HSL colour. */
function luminanceHsl(h: number, s: number, l: number): number {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** White or near-black text, whichever reads better on the colour. */
export function textOn(h: number, s: number, l: number): 'light' | 'dark' {
  const y = luminanceHsl(h, s, l);
  return contrast(y, 1) >= contrast(y, luminanceHsl(222, 39, 8)) ? 'light' : 'dark';
}

/**
 * A shade of the colour that works as a button and as text on the page background:
 * light mode darkens it when it is too pale, dark mode lightens it when it is too dark.
 */
export function usableShade(hex: string, mode: 'light' | 'dark'): [number, number, number] {
  const [h, s, l] = hexToHsl(hex);
  return mode === 'light' ? [h, s, Math.min(l, 42)] : [h, s, Math.max(l, 56)];
}

const hsl = ([h, s, l]: [number, number, number]) => `${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%`;
const fg = (c: [number, number, number]) => (textOn(...c) === 'light' ? '0 0% 100%' : '222 39% 8%');

/** CSS that swaps TreinON's colours for the team's, in both modes. Empty when there is nothing to swap. */
export function themeCss(primary: string | null, accent: string | null): string {
  if (!isHex(primary) && !isHex(accent)) return '';
  const block = (mode: 'light' | 'dark') => {
    const out: string[] = [];
    if (isHex(primary)) {
      const p = usableShade(primary, mode);
      out.push(`--primary: ${hsl(p)};`, `--primary-foreground: ${fg(p)};`, `--ring: ${hsl(p)};`);
      const sp = usableShade(primary, 'dark');
      out.push(`--sidebar-primary: ${hsl(sp)};`, `--sidebar-primary-foreground: ${fg(sp)};`, `--sidebar-ring: ${hsl(sp)};`);
    }
    if (isHex(accent)) {
      const [h, s, l] = hexToHsl(accent);
      const a: [number, number, number] = [h, s, mode === 'light' ? Math.min(Math.max(l, 30), 50) : Math.max(l, 50)];
      out.push(`--accent: ${hsl(a)};`, `--accent-foreground: ${fg(a)};`);
    }
    return out.join(' ');
  };
  return `:root { ${block('light')} } .dark { ${block('dark')} }`;
}

/**
 * The two main colours of a crest, from its pixels (RGBA, as a canvas gives them).
 * White, black, greys and transparent bits are left out; similar shades count together.
 */
export function crestColors(rgba: ArrayLike<number>, max = 2): string[] {
  // 24 hue slices of 15°: the shades of the same colour (light red, dark red) count together
  const slices = new Map<number, { n: number; r: number; g: number; b: number; s: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 200) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 30 || l < 12 || l > 90) continue;
    const key = Math.floor(h / 15) % 24;
    const sl = slices.get(key) ?? { n: 0, r: 0, g: 0, b: 0, s: 0 };
    sl.n++; sl.r += r; sl.g += g; sl.b += b; sl.s += s;
    slices.set(key, sl);
  }
  // neighbouring slices are the same colour too: merge each slice with the next one
  const keys = [...slices.keys()].sort((x, y) => slices.get(y)!.n - slices.get(x)!.n);
  const used = new Set<number>();
  const out: string[] = [];
  for (const k of keys) {
    if (used.has(k)) continue;
    const group = [k, (k + 1) % 24, (k + 23) % 24].filter((x) => slices.has(x) && !used.has(x));
    group.forEach((x) => used.add(x));
    const t = group.reduce((acc, x) => { const sl = slices.get(x)!; return { n: acc.n + sl.n, r: acc.r + sl.r, g: acc.g + sl.g, b: acc.b + sl.b }; }, { n: 0, r: 0, g: 0, b: 0 });
    const c = rgbToHex(t.r / t.n, t.g / t.n, t.b / t.n);
    const [h] = hexToHsl(c);
    // a second colour must really be another colour, not a shade of the first
    if (out.every((o) => { const d = Math.abs(hexToHsl(o)[0] - h); return Math.min(d, 360 - d) > 35; })) out.push(c);
    if (out.length === max) break;
  }
  return out;
}

/** The crest file kept small: at most 512 px, PNG (keeps transparency). Browser only. */
export async function shrinkImage(file: File, maxSide = 512): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('imagem inválida'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

/** The colours of a crest that is already online (or a local file URL). Browser only. */
export async function colorsOfImage(src: string): Promise<string[]> {
  const img = await loadImage(src);
  const side = 96;
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, side, side);
  return crestColors(ctx.getImageData(0, 0, side, side).data);
}

/** The crest as a PNG data URL, for PDFs. Null if it cannot be read. Browser only. */
export async function imageAsDataUrl(src: string | null | undefined, maxSide = 256): Promise<{ dataUrl: string; ratio: number } | null> {
  if (!src) return null;
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height };
  } catch { return null; }
}
