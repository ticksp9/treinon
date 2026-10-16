import { describe, it, expect } from 'vitest';
import { crestColors, hexToHsl, resolveBranding, textOn, themeCss, usableShade } from '@/lib/team-branding';

const row = (patch: Partial<Parameters<typeof resolveBranding>[0] & object> = {}) => ({
  team_id: 't', crest_url: null, theme: null, club_logo_url: null, club_primary: null, club_secondary: null, ...patch,
});

describe('team branding', () => {
  it('uses the team look first, then the club, then nothing', () => {
    expect(resolveBranding(row({ crest_url: 'a.png', theme: { primary: '#c8102e', accent: '#1a7f37' }, club_logo_url: 'c.png', club_primary: '#000080' })))
      .toMatchObject({ crestUrl: 'a.png', primary: '#c8102e', accent: '#1a7f37', fromClub: { crest: false, colors: false } });
    expect(resolveBranding(row({ club_logo_url: 'c.png', club_primary: '#000080', club_secondary: '#ffd700' })))
      .toMatchObject({ crestUrl: 'c.png', primary: '#000080', accent: '#ffd700', fromClub: { crest: true, colors: true } });
    // a team with its own main colour does not borrow the club's highlight
    expect(resolveBranding(row({ theme: { primary: '#c8102e' }, club_secondary: '#ffd700' })).accent).toBeNull();
    expect(resolveBranding(row({ theme: { primary: 'red' } })).primary).toBeNull();
    expect(resolveBranding(null).crestUrl).toBeNull();
  });

  it('keeps text readable on any colour', () => {
    expect(textOn(...hexToHsl('#c8102e'))).toBe('light');
    expect(textOn(...hexToHsl('#ffd700'))).toBe('dark');
    expect(textOn(...hexToHsl('#0b3d91'))).toBe('light');
  });

  it('darkens pale colours in light mode and lightens dark ones in dark mode', () => {
    expect(usableShade('#ffd700', 'light')[2]).toBeLessThanOrEqual(42);
    expect(usableShade('#0b1d3a', 'dark')[2]).toBeGreaterThanOrEqual(56);
    expect(usableShade('#c8102e', 'light')[2]).toBeCloseTo(hexToHsl('#c8102e')[2], 0);
  });

  it('writes CSS for both modes, and nothing without colours', () => {
    const css = themeCss('#c8102e', '#1a7f37');
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(css).toMatch(/--primary: 35\d 85% 4\d%/);
    expect(css).toContain('--accent:');
    expect(themeCss(null, null)).toBe('');
    expect(themeCss('#c8102e', null)).not.toContain('--accent:');
  });

  it('finds the two colours of a crest, leaving out white, black and transparency', () => {
    const px: number[] = [];
    const put = (n: number, rgba: [number, number, number, number]) => { for (let i = 0; i < n; i++) px.push(...rgba); };
    put(500, [255, 255, 255, 255]); // white background
    put(300, [0, 0, 0, 0]);         // transparent
    put(60, [20, 20, 20, 255]);     // black outline
    put(200, [200, 16, 46, 255]);   // red
    put(40, [210, 20, 50, 255]);    // another red, same colour
    put(150, [26, 127, 55, 255]);   // green
    put(30, [230, 170, 30, 255]);   // gold, less of it
    const c = crestColors(px);
    expect(c).toHaveLength(2);
    expect(hexToHsl(c[0])[0]).toBeGreaterThan(340); // red first
    expect(hexToHsl(c[1])[0]).toBeGreaterThan(100); // then green
    expect(hexToHsl(c[1])[0]).toBeLessThan(160);
  });
});
