import { useId } from 'react';
import type { DiagramEl, Pt } from '@/lib/drill-library/types';

const W = 100;
const H = 64;

function Arrow({ from, to, kind, markerId }: { from: Pt; to: Pt; kind: 'pass' | 'run' | 'drive' | 'shot'; markerId: string }) {
  const dash = kind === 'run' ? '2.2 1.6' : kind === 'drive' ? '0.6 1.2' : undefined;
  const width = kind === 'shot' ? 0.9 : 0.55;
  // shorten the end so the arrow head doesn't cover the target
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const end: Pt = [to[0] - (dx / len) * 1.8, to[1] - (dy / len) * 1.8];
  return (
    <line
      x1={from[0]} y1={from[1]} x2={end[0]} y2={end[1]}
      stroke={kind === 'shot' ? 'hsl(var(--accent))' : 'white'}
      strokeWidth={width}
      strokeDasharray={dash}
      strokeLinecap="round"
      markerEnd={`url(#${markerId}-${kind === 'shot' ? 'shot' : 'arrow'})`}
    />
  );
}

function Goal({ at, side, small }: { at: Pt; side: 'left' | 'right' | 'top' | 'bottom'; small?: boolean }) {
  const len = small ? 6 : 12;
  const depth = small ? 1.6 : 2.4;
  const vertical = side === 'left' || side === 'right';
  const w = vertical ? depth : len;
  const h = vertical ? len : depth;
  const x = side === 'left' ? at[0] - depth : side === 'right' ? at[0] : at[0] - len / 2;
  const y = side === 'top' ? at[1] - depth : side === 'bottom' ? at[1] : at[1] - len / 2;
  return <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity={0.25} stroke="white" strokeWidth={0.5} />;
}

function Player({ at, n, fill, stroke }: { at: Pt; n?: string; fill: string; stroke?: string }) {
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={2.3} fill={fill} stroke={stroke ?? 'white'} strokeWidth={0.45} />
      {n && (
        <text x={at[0]} y={at[1] + 0.9} textAnchor="middle" fontSize={2.4} fontWeight={700} fill="white">
          {n}
        </text>
      )}
    </g>
  );
}

/** Small pitch diagram for a drill. Colours: team A blue, team B orange, joker yellow. */
export function DrillDiagram({ elements, className, title }: { elements: DiagramEl[]; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox={`-2 -2 ${W + 4} ${H + 4}`}
      className={className}
      role="img"
      aria-label={title ? `Esquema: ${title}` : 'Esquema do exercício'}
    >
      <defs>
        <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="white" />
        </marker>
        <marker id={`${id}-shot`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--accent))" />
        </marker>
        <pattern id={`${id}-grass`} width="12.5" height={H} patternUnits="userSpaceOnUse">
          <rect width="12.5" height={H} fill="hsl(var(--field))" />
          <rect x="6.25" width="6.25" height={H} fill="hsl(var(--field-dark))" opacity={0.55} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} rx={1.5} fill={`url(#${id}-grass)`} stroke="white" strokeOpacity={0.9} strokeWidth={0.5} />
      {elements.map((el, i) => {
        switch (el.t) {
          case 'zone':
            return (
              <g key={i}>
                <rect x={el.at[0]} y={el.at[1]} width={el.w} height={el.h} fill="white" fillOpacity={0.12} stroke="white" strokeOpacity={0.6} strokeWidth={0.35} strokeDasharray="1.5 1" />
                {el.label && <text x={el.at[0] + el.w / 2} y={el.at[1] + 3} textAnchor="middle" fontSize={2.3} fill="white" opacity={0.9}>{el.label}</text>}
              </g>
            );
          case 'line':
            return <line key={i} x1={el.from[0]} y1={el.from[1]} x2={el.to[0]} y2={el.to[1]} stroke="white" strokeOpacity={0.7} strokeWidth={0.4} />;
          case 'goal':
            return <Goal key={i} at={el.at} side={el.side} small={el.small} />;
          case 'cone':
            return <path key={i} d={`M${el.at[0]},${el.at[1] - 1.4} L${el.at[0] + 1.2},${el.at[1] + 1} L${el.at[0] - 1.2},${el.at[1] + 1} Z`} fill="hsl(28 95% 55%)" stroke="white" strokeWidth={0.2} />;
          case 'ball':
            return <circle key={i} cx={el.at[0]} cy={el.at[1]} r={1} fill="white" stroke="#111" strokeWidth={0.25} />;
          case 'a':
            return <Player key={i} at={el.at} n={el.n} fill="hsl(217 85% 50%)" />;
          case 'd':
            return <Player key={i} at={el.at} n={el.n} fill="hsl(14 90% 52%)" />;
          case 'n':
            return <Player key={i} at={el.at} n={el.n ?? 'J'} fill="hsl(45 95% 48%)" />;
          case 'gk':
            return <Player key={i} at={el.at} n="GR" fill="hsl(280 60% 45%)" />;
          case 'pass':
          case 'run':
          case 'drive':
          case 'shot':
            return <Arrow key={i} from={el.from} to={el.to} kind={el.t} markerId={id} />;
          case 'text':
            return <text key={i} x={el.at[0]} y={el.at[1]} textAnchor="middle" fontSize={2.6} fontWeight={600} fill="white">{el.text}</text>;
          default:
            return null;
        }
      })}
    </svg>
  );
}

export function DiagramLegend() {
  const item = (color: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {item('hsl(217 85% 50%)', 'Equipa A')}
      {item('hsl(14 90% 52%)', 'Equipa B')}
      {item('hsl(45 95% 48%)', 'Joker')}
      <span>— passe</span>
      <span>- - - movimento</span>
      <span>··· condução</span>
    </div>
  );
}
