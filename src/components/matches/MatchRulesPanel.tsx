/**
 * Reusable panel showing active match rules for a given modality + age group.
 * Used in convocatória, live match, and post-game editor.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, RotateCcw, Clock, AlertTriangle, Info } from 'lucide-react';
import type { MatchRuleSnapshot } from '@/lib/match-rules-service';
import { tx } from '@/lib/i18n/ui';

interface MatchRulesPanelProps {
  snapshot: MatchRuleSnapshot | null;
  sportType?: string | null;
  category?: string | null;
  compact?: boolean;
  /** Show warning if rules were manually overridden */
  isOverridden?: boolean;
}

const MODALITY_LABELS: Record<string, string> = {
  football_11: 'Futebol 11',
  football_9: 'Futebol 9',
  football_7: 'Futebol 7',
  football_5: 'Futebol 5',
  futsal: 'Futsal',
};

export function MatchRulesPanel({ snapshot, sportType, category, compact, isOverridden }: MatchRulesPanelProps) {
  if (!snapshot && !sportType) return null;

  const modalityLabel = MODALITY_LABELS[snapshot?.modality_code || sportType || ''] || sportType || 'Desconhecida';
  const maxOnField = snapshot?.max_players_on_field || 11;
  const reentryAllowed = snapshot?.reentry_allowed ?? false;
  const rollingSubstitutions = snapshot?.rolling_substitutions ?? false;
  const periodCount = snapshot?.period_count || 2;
  const p1 = snapshot?.period_1_minutes || 45;
  const p2 = snapshot?.period_2_minutes || p1;
  const totalMinutes = p1 + p2 + (snapshot?.period_3_minutes || 0) + (snapshot?.period_4_minutes || 0);
  // parts can have different lengths (e.g. 15 + 15 + 30)
  const partsList = [p1, p2, snapshot?.period_3_minutes || p1, snapshot?.period_4_minutes || p1].slice(0, Math.max(1, Math.min(4, periodCount)));
  const partsLabel = partsList.every((m) => m === partsList[0]) ? `${periodCount}x${p1}'` : partsList.map((m) => `${m}'`).join('+');

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Badge variant="outline" className="gap-1">
          <Users className="w-3 h-3" />
          {maxOnField} {tx('em campo')}
        </Badge>
        <Badge variant={reentryAllowed ? 'secondary' : 'destructive'} className="gap-1">
          <RotateCcw className="w-3 h-3" />
          {reentryAllowed ? tx('Reentrada sim') : tx('Sem reentrada')}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" />
          {partsLabel}
        </Badge>
        {isOverridden && (
          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            {tx('Alterado')}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {tx('Regras Aplicadas')}
          {isOverridden && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {tx('Diferente do formato da equipa')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{tx('Modalidade')}</span>
            <div className="font-medium text-sm">{modalityLabel}</div>
          </div>
          {category && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{tx('Escalão')}</span>
              <div className="font-medium text-sm capitalize">{snapshot?.age_group_code || category}</div>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{tx('Máx. em campo')}</span>
            <div className="font-medium text-sm flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {tx('{{n}} jogadores', { n: maxOnField })}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{tx('Reentrada')}</span>
            <Badge variant={reentryAllowed ? 'secondary' : 'destructive'} className="text-xs">
              {reentryAllowed ? tx('Permitida') : tx('Não permitida')}
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{tx('Substituição rotativa')}</span>
            <Badge variant={rollingSubstitutions ? 'secondary' : 'outline'} className="text-xs">
              {rollingSubstitutions ? tx('Sim') : tx('Não')}
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{tx('Tempo de jogo')}</span>
            <div className="font-medium text-sm flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {partsLabel} ({totalMinutes}{tx('\' total)')}
            </div>
          </div>
        </div>
        
        {snapshot?.rule_profile_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t">
            <Info className="w-3 h-3" />
            {tx('Perfil:')}{' '}{snapshot.rule_profile_name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
