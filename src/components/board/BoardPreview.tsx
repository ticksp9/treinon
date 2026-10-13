/**
 * A tactical board as a still picture (first step): for lists and reports.
 * Draws the same things as the board itself, with nothing to touch.
 */
import { useId } from 'react';
import { BH, BW, positionsAt, type BoardState } from '@/lib/tactic-board';
import { PitchLines } from '@/components/board/TacticBoard';
import { cn } from '@/lib/utils';

const HOME = '#2563eb', AWAY = '#dc2626';

export function BoardPreview({ state, className, step = 0 }: { state: BoardState; className?: string; step?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const pos = positionsAt(state, Math.min(step, state.steps.length));
  const viewBox = state.half ? `${BW / 2 - 3} -3 ${BW / 2 + 6} ${BH + 6}` : `-3 -3 ${BW + 6} ${BH + 6}`;
  const colors = Array.from(new Set(state.drawings.map((d) => d.color)));
  const arrow = (c: string) => `url(#bp-${uid}-${colors.indexOf(c)})`;
  return (
    <svg viewBox={viewBox} className={cn('block w-full rounded-md', className)} style={{ background: '#1f5c37' }} role="img" aria-label="Esquema tático">
      <defs>
        {colors.map((c, i) => (
          <marker key={c} id={`bp-${uid}-${i}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * (BW / 10)} y={0} width={BW / 10} height={BH} fill={i % 2 ? '#256b40' : '#2a7747'} />)}
      <PitchLines sport={state.sport} />
      {state.drawings.filter((d) => d.step === step).map((d) => {
        if (d.t === 'text') return <text key={d.id} x={d.pts[0][0]} y={d.pts[0][1] + 1} textAnchor="middle" fontSize={3} fontWeight={700} fill={d.color} stroke={d.color === '#111827' ? 'white' : '#0b2a17'} strokeWidth={0.6} paintOrder="stroke">{d.text}</text>;
        if (d.t === 'circle' && d.pts.length >= 2) {
          const [a, b] = d.pts;
          return <ellipse key={d.id} cx={(a[0] + b[0]) / 2} cy={(a[1] + b[1]) / 2} rx={Math.abs(a[0] - b[0]) / 2} ry={Math.abs(a[1] - b[1]) / 2} fill={d.color} fillOpacity={0.22} stroke={d.color} strokeWidth={0.4} strokeDasharray="1.5 1" />;
        }
        if (d.t === 'zone' && d.pts.length >= 2) {
          const [a, b] = d.pts;
          return <rect key={d.id} x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])} fill={d.color} fillOpacity={0.22} stroke={d.color} strokeWidth={0.4} strokeDasharray="1.5 1" />;
        }
        if (d.t === 'curve' && d.pts.length === 3) {
          const [a, c, b] = d.pts;
          return <path key={d.id} d={`M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`} fill="none" stroke={d.color} strokeWidth={0.75} strokeLinecap="round" markerEnd={arrow(d.color)} />;
        }
        if (d.t === 'free' || d.pts.length !== 2) return <polyline key={d.id} points={d.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={d.color} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />;
        const [a, b] = d.pts;
        return <line key={d.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={d.color} strokeWidth={0.75} strokeLinecap="round" strokeDasharray={d.t === 'run' ? '2.2 1.6' : undefined} markerEnd={arrow(d.color)} />;
      })}
      {state.tokens.map((t) => {
        const p = pos[t.id];
        if (!p) return null;
        if (t.kind === 'ball') return <circle key={t.id} cx={p[0]} cy={p[1]} r={1.3} fill="white" stroke="#111" strokeWidth={0.35} />;
        if (t.kind === 'cone') return <path key={t.id} d={`M${p[0]},${p[1] - 1.6} L${p[0] + 1.4},${p[1] + 1.1} L${p[0] - 1.4},${p[1] + 1.1} Z`} fill="#fb923c" stroke="white" strokeWidth={0.25} />;
        return (
          <g key={t.id}>
            <circle cx={p[0]} cy={p[1]} r={2.7} fill={t.kind === 'home' ? HOME : AWAY} stroke="white" strokeWidth={0.45} />
            <text x={p[0]} y={p[1] + 1} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="white">{t.n}</text>
          </g>
        );
      })}
    </svg>
  );
}
