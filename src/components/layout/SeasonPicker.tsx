import { useNavigate } from 'react-router-dom';
import { CalendarRange, Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import { dedupeSeasons, SEASON_STATUS_LABEL, type SeasonStatus } from '@/lib/season-service';

function statusVariant(status: SeasonStatus) {
  if (status === 'active') return 'default' as const;
  if (status === 'planning') return 'outline' as const;
  return 'secondary' as const;
}

/** ERP-style global season selector, always visible in the app header. */
export function SeasonPicker() {
  const nav = useNavigate();
  const { seasons, selectedSeason, setSelectedSeason } = useSeasonContext();
  const uniqueSeasons = dedupeSeasons(seasons).map((g) => g.season);

  if (seasons.length === 0) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => nav('/seasons')}>
        <CalendarRange className="w-4 h-4" />
        <span className="hidden sm:inline">Definir época</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground hidden sm:inline">Época</span>
          <span className="font-medium">{selectedSeason?.name ?? '—'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Épocas desportivas</DropdownMenuLabel>
        {uniqueSeasons.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => setSelectedSeason(s.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className={s.id === selectedSeason?.id ? 'font-semibold' : ''}>{s.name}</span>
            <Badge variant={statusVariant(s.status)} className="text-[10px]">
              {SEASON_STATUS_LABEL[s.status]}
            </Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => nav('/seasons')} className="gap-2">
          <Settings2 className="w-4 h-4" /> Gerir épocas...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Discrete read-only notice shown when browsing a closed/archived season. */
export function SeasonReadOnlyBanner() {
  const { selectedSeason, isViewingArchivedOrClosed, activeSeason, setSelectedSeason } = useSeasonContext();
  if (!isViewingArchivedOrClosed || !selectedSeason) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-b border-amber-500/20">
      <span>
        A visualizar a época <strong>{selectedSeason.name}</strong> (
        {SEASON_STATUS_LABEL[selectedSeason.status].toLowerCase()}). Os dados não podem ser alterados.
      </span>
      {activeSeason && (
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setSelectedSeason(activeSeason.id)}>
          Voltar à época ativa ({activeSeason.name})
        </Button>
      )}
    </div>
  );
}
