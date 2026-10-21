/** The two pictures of a watched player: the radar of the areas and the mark over time. */
import { AREAS, type AreaKey } from '@/lib/player-scouting';
import { tx } from '@/lib/i18n/ui';

const MAX = 5;

/** Marks 1–5 per area; areas nobody marked are drawn at the centre and shown as "–". */
export function ScoutRadar({ values, color = 'hsl(var(--primary))', ink = 'currentColor', className }: {
  values: Record<AreaKey, number | null>; color?: string; ink?: string; className?: string;
}) {
  const cx = 110, cy = 100, r = 70;
  const n = AREAS.length;
  const at = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * (v / MAX), cy + Math.sin(a) * r * (v / MAX)];
  };
  const ring = (v: number) => AREAS.map((_, i) => at(i, v).join(',')).join(' ');
  const shape = AREAS.map((a, i) => at(i, values[a.key] ?? 0).join(',')).join(' ');
  const any = AREAS.some((a) => values[a.key] != null);
  return (
    <svg viewBox="0 0 220 200" className={className} role="img"
      aria-label={tx('Avaliação por áreas: {{v0}}', { v0: AREAS.map((a) => `${a.label} ${values[a.key] != null ? String(values[a.key]).replace('.', ',') : 'sem nota'}`).join(', ') })}>
      {[1, 2, 3, 4, 5].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke={ink} strokeOpacity={v === 5 ? 0.35 : 0.15} strokeWidth={1} />)}
      {AREAS.map((_, i) => { const [x, y] = at(i, MAX); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={ink} strokeOpacity={0.15} strokeWidth={1} />; })}
      {any && <polygon points={shape} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} strokeLinejoin="round" />}
      {any && AREAS.map((a, i) => { const v = values[a.key]; if (v == null) return null; const [x, y] = at(i, v); return <circle key={a.key} cx={x} cy={y} r={3} fill={color} />; })}
      {AREAS.map((a, i) => {
        const [x, y] = at(i, MAX + 1.15);
        const v = values[a.key];
        return (
          <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={ink}>
            <tspan fontWeight={600}>{a.label}</tspan>
            <tspan x={x} dy={12} fontWeight={700} fontFamily="ui-monospace, monospace">{v != null ? String(v).replace('.', ',') : '–'}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

/** The mark of each observation, oldest on the left. Needs two points to say anything. */
export function ScoutEvolution({ history, color = 'hsl(var(--primary))', ink = 'currentColor', className }: {
  history: { date: string; mark: number }[]; color?: string; ink?: string; className?: string;
}) {
  if (history.length < 2) return null;
  const w = 260, h = 90, padX = 16, top = 12, bottom = 22;
  const x = (i: number) => padX + (i * (w - 2 * padX)) / (history.length - 1);
  const y = (v: number) => top + (1 - (v - 1) / (MAX - 1)) * (h - top - bottom);
  const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img"
      aria-label={tx('Evolução da nota: {{v0}}', { v0: history.map((p) => `${short(p.date)} ${String(p.mark).replace('.', ',')}`).join(', ') })}>
      {[1, 3, 5].map((v) => <line key={v} x1={padX} x2={w - padX} y1={y(v)} y2={y(v)} stroke={ink} strokeOpacity={0.12} strokeWidth={1} />)}
      <polyline points={history.map((p, i) => `${x(i)},${y(p.mark)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {history.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.mark)} r={3} fill={color} />
          <text x={x(i)} y={y(p.mark) - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={ink} fontFamily="ui-monospace, monospace">{String(p.mark).replace('.', ',')}</text>
          {(i === 0 || i === history.length - 1) && <text x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : 'end'} fontSize={9} fill={ink} fillOpacity={0.7}>{short(p.date)}</text>}
        </g>
      ))}
    </svg>
  );
}
