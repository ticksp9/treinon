/**
 * Visual indicator showing current players on field vs maximum allowed.
 * Changes color when approaching or at limit.
 */
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface FieldPlayerCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function FieldPlayerCounter({ current, max, className }: FieldPlayerCounterProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isAtLimit = current >= max;
  const isOverLimit = current > max;

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="flex items-center gap-1.5">
        <Users className={`w-4 h-4 ${isOverLimit ? 'text-destructive' : isAtLimit ? 'text-amber-500' : 'text-muted-foreground'}`} />
        <span className={`font-mono font-bold text-sm ${isOverLimit ? 'text-destructive' : isAtLimit ? 'text-amber-600' : ''}`}>
          {current}/{max}
        </span>
      </div>
      <Progress 
        value={Math.min(percentage, 100)} 
        className={`w-16 h-2 ${isOverLimit ? '[&>div]:bg-destructive' : isAtLimit ? '[&>div]:bg-amber-500' : ''}`} 
      />
      {isOverLimit && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
          <AlertTriangle className="w-3 h-3" />
          Excesso
        </Badge>
      )}
    </div>
  );
}
