import { Badge } from '@/components/ui/badge';
import { Clock, Wifi, WifiOff, CloudOff, Check } from 'lucide-react';
import { REPORT_STATUS_LABELS, ENTRY_MODE_LABELS, type ReportStatus, type ReportEntryMode } from '@/lib/match-report-service';

interface MatchContextBarProps {
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  currentPeriod?: string;
  displayMinute?: number;
  modality?: string;
  ageGroup?: string;
  entryMode?: ReportEntryMode;
  reportStatus?: ReportStatus;
  isOnline?: boolean;
  syncStatus?: 'saving' | 'saved' | 'pending' | 'error';
  compact?: boolean;
}

export function MatchContextBar({
  opponentName,
  goalsFor,
  goalsAgainst,
  currentPeriod,
  displayMinute,
  modality,
  ageGroup,
  entryMode,
  reportStatus,
  isOnline = true,
  syncStatus = 'saved',
  compact = false,
}: MatchContextBarProps) {
  const syncLabel: Record<string, string> = {
    saving: 'A guardar…',
    saved: 'Guardado',
    pending: 'Sincronização pendente',
    error: 'Erro ao guardar',
  };

  const syncIcon: Record<string, React.ReactNode> = {
    saving: <Clock className="w-3 h-3 animate-spin" />,
    saved: <Check className="w-3 h-3" />,
    pending: <CloudOff className="w-3 h-3" />,
    error: <CloudOff className="w-3 h-3" />,
  };

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-3 py-2 space-y-1">
      {/* Row 1: Score + Period + Minute */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums">{goalsFor}</span>
          <span className="text-muted-foreground text-lg">-</span>
          <span className="text-2xl font-bold tabular-nums">{goalsAgainst}</span>
          <span className="text-sm text-muted-foreground truncate max-w-[120px]">
            vs {opponentName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {displayMinute !== undefined && (
            <Badge variant="outline" className="text-base font-mono px-3 py-1">
              {displayMinute}'
            </Badge>
          )}
          {currentPeriod && (
            <Badge variant="secondary" className="text-xs">
              {currentPeriod}
            </Badge>
          )}
        </div>
      </div>

      {/* Row 2: Meta info + sync status */}
      {!compact && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            {modality && <span>{modality}</span>}
            {ageGroup && <span>• {ageGroup}</span>}
            {entryMode && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {ENTRY_MODE_LABELS[entryMode]}
              </Badge>
            )}
            {reportStatus && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {REPORT_STATUS_LABELS[reportStatus]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!isOnline && (
              <span className="flex items-center gap-1 text-destructive">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
            <span className={`flex items-center gap-1 ${syncStatus === 'error' ? 'text-destructive' : ''}`}>
              {syncIcon[syncStatus]}
              {syncLabel[syncStatus]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
