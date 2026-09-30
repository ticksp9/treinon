/**
 * SVG pitch canvas. Renders lines, areas and center circle.
 * Children are positioned absolutely on top using normalized [0,1] coords.
 * y=0 = own goal (bottom), y=1 = opponent goal (top).
 */
import { ReactNode, useMemo } from 'react';
import type { SportType } from '@/lib/tactical-formations';

interface Props {
  sportType: SportType | string;
  children?: ReactNode;
  className?: string;
}

export function PitchCanvas({ sportType, children, className }: Props) {
  const ratio = useMemo(() => {
    // height / width
    if (sportType === 'futsal' || sportType === 'football_5') return 1.4;
    if (sportType === 'football_7') return 1.5;
    if (sportType === 'football_9') return 1.55;
    return 1.55; // football_11
  }, [sportType]);

  return (
    <div
      className={`relative w-full rounded-md overflow-hidden border border-black/20 ${className ?? ''}`}
      style={{
        paddingTop: `${ratio * 100}%`,
        // mown-grass stripes in the pitch colours of the theme
        backgroundImage:
          'repeating-linear-gradient(0deg, hsl(var(--field)) 0 8%, hsl(var(--field-dark)) 8% 16%)',
      }}
      aria-label="Campo tático"
    >
      <svg
        viewBox="0 0 100 155"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {/* outer line */}
        <rect x="2" y="2" width="96" height="151" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4" />
        {/* midline */}
        <line x1="2" y1="77.5" x2="98" y2="77.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
        {/* center circle */}
        <circle cx="50" cy="77.5" r="10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
        <circle cx="50" cy="77.5" r="0.6" fill="rgba(255,255,255,0.6)" />
        {/* bottom box (own) */}
        <rect x="25" y="2" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
        <rect x="38" y="2" width="24" height="5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
        {/* top box (opp) */}
        <rect x="25" y="139" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
        <rect x="38" y="148" width="24" height="5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.3" />
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
