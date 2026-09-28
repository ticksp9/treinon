/**
 * Panel showing active conflict alerts for a match.
 * Displays warnings, errors, and blocking issues.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, ShieldAlert, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ConsistencyIssue } from '@/lib/match-playing-time';

interface ConflictAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

interface ConflictAlertsPanelProps {
  matchId: string;
  /** Local consistency issues computed from current state */
  localIssues?: ConsistencyIssue[];
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  blocking: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const, label: 'Bloqueante' },
  error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/5', badge: 'destructive' as const, label: 'Erro' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', badge: 'secondary' as const, label: 'Aviso' },
};

export function ConflictAlertsPanel({ matchId, localIssues, compact }: ConflictAlertsPanelProps) {
  const [dbAlerts, setDbAlerts] = useState<ConflictAlert[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [matchId]);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('match_conflict_alerts')
      .select('*')
      .eq('match_id', matchId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setDbAlerts((data as ConflictAlert[]) || []);
  };

  // Merge local issues with DB alerts
  const allIssues: Array<{ severity: string; message: string; source: 'local' | 'db' }> = [
    ...(localIssues || []).map(i => ({ severity: i.type === 'error' ? 'blocking' : 'warning', message: i.message, source: 'local' as const })),
    ...dbAlerts.map(a => ({ severity: a.severity, message: a.message, source: 'db' as const })),
  ];

  const blockingCount = allIssues.filter(i => i.severity === 'blocking' || i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const totalCount = allIssues.length;

  if (totalCount === 0) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        Sem conflitos
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {blockingCount > 0 && (
          <Badge variant="destructive" className="text-[10px] gap-0.5">
            <ShieldAlert className="w-3 h-3" />
            {blockingCount} bloqueante{blockingCount > 1 ? 's' : ''}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="text-[10px] gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            {warningCount} aviso{warningCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    );
  }

  const displayed = expanded ? allIssues : allIssues.slice(0, 3);

  return (
    <Card className={blockingCount > 0 ? 'border-destructive/30' : 'border-amber-300/50'}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${blockingCount > 0 ? 'text-destructive' : 'text-amber-500'}`} />
            Conflitos ({totalCount})
          </span>
          <div className="flex items-center gap-1">
            {blockingCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{blockingCount} bloqueante{blockingCount > 1 ? 's' : ''}</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{warningCount} aviso{warningCount > 1 ? 's' : ''}</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-1.5">
        {displayed.map((issue, idx) => {
          const config = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
          const Icon = config.icon;
          return (
            <div key={idx} className={`flex items-start gap-2 p-2 rounded text-xs ${config.bg}`}>
              <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
              <span>{issue.message}</span>
            </div>
          );
        })}
        {totalCount > 3 && (
          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <><ChevronUp className="w-3 h-3 mr-1" />Mostrar menos</>
            ) : (
              <><ChevronDown className="w-3 h-3 mr-1" />Ver todos ({totalCount})</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
