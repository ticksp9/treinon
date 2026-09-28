import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Clock, Lock, Pencil, RotateCcw } from 'lucide-react';
import { type ReportStatus } from '@/lib/match-report-service';

const STATUS_CONFIG: Record<ReportStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', variant: 'outline', icon: <Pencil className="w-3 h-3" /> },
  in_progress: { label: 'Em preenchimento', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending_completion: { label: 'A completar', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  pending_review: { label: 'A rever', variant: 'secondary', icon: <AlertTriangle className="w-3 h-3" /> },
  finalized: { label: 'Finalizado', variant: 'default', icon: <Check className="w-3 h-3" /> },
  reopened: { label: 'Reaberto', variant: 'destructive', icon: <RotateCcw className="w-3 h-3" /> },
  corrected: { label: 'Corrigido', variant: 'default', icon: <Check className="w-3 h-3" /> },
  locked: { label: 'Bloqueado', variant: 'outline', icon: <Lock className="w-3 h-3" /> },
};

interface MatchStatusBadgeProps {
  status: ReportStatus;
  showIcon?: boolean;
  className?: string;
}

export function MatchStatusBadge({ status, showIcon = true, className }: MatchStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  
  return (
    <Badge variant={config.variant} className={className}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

// Game status badges
export function GameStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Agendado', className: 'bg-secondary text-secondary-foreground' },
    in_progress: { label: 'Em Curso', className: 'bg-green-600 text-white' },
    completed: { label: 'Terminado', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: 'Cancelado', className: 'bg-destructive text-destructive-foreground' },
  };
  
  const c = config[status] || { label: status, className: '' };
  
  return <Badge className={c.className}>{c.label}</Badge>;
}
