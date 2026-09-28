import { useState, useMemo } from 'react';
import { format, isToday, isFuture } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play, Calendar, Trophy, FileText, Search,
  MapPin, AlertTriangle, Clock, Plus, ChevronRight, Eye
} from 'lucide-react';
import { MatchStatusBadge } from './MatchStatusBadge';
import { REPORT_STATUS_LABELS, type ReportStatus, ENTRY_MODE_LABELS, type ReportEntryMode } from '@/lib/match-report-service';
import { useIsMobile } from '@/hooks/use-mobile';

interface Match {
  id: string;
  match_date: string;
  opponent_name: string;
  is_home: boolean;
  location: string | null;
  competition: string | null;
  status: string;
  goals_for: number | null;
  goals_against: number | null;
  match_type?: string;
  is_test?: boolean;
  report_status?: string;
  report_entry_mode?: string;
}

interface MatchListMobileProps {
  matches: Match[];
  teamName?: string;
  onStartMatch: (match: Match) => void;
  onContinueMatch: (match: Match) => void;
  onViewReport: (match: Match) => void;
  onCreateNew?: () => void;
  inProgressMatchId?: string;
}

type TabFilter = 'today' | 'upcoming' | 'finished' | 'drafts';

const MODE_LABELS_SHORT: Record<string, string> = {
  live: 'Ao Vivo',
  post_game: 'Pós-Jogo',
  hybrid: 'Híbrido',
};

export function MatchListMobile({
  matches, teamName, onStartMatch, onContinueMatch, onViewReport, onCreateNew, inProgressMatchId,
}: MatchListMobileProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = matches.filter(m => !m.is_test);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.opponent_name.toLowerCase().includes(q) ||
        m.competition?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      list = list.filter(m => m.report_status === filterStatus || m.status === filterStatus);
    }

    return list;
  }, [matches, searchQuery, filterStatus]);

  const todayMatches = filtered.filter(m => isToday(new Date(m.match_date)) || m.status === 'in_progress');
  const upcomingMatches = filtered.filter(m => isFuture(new Date(m.match_date)) && m.status !== 'in_progress' && !isToday(new Date(m.match_date)));
  const finishedMatches = filtered.filter(m => m.status === 'completed');
  const draftMatches = filtered.filter(m =>
    m.report_status === 'draft' || m.report_status === 'pending_completion' || m.report_status === 'in_progress'
  );

  const tabCounts: Record<TabFilter, number> = {
    today: todayMatches.length,
    upcoming: upcomingMatches.length,
    finished: finishedMatches.length,
    drafts: draftMatches.length,
  };

  const getTabMatches = (): Match[] => {
    switch (activeTab) {
      case 'today': return todayMatches;
      case 'upcoming': return upcomingMatches;
      case 'finished': return finishedMatches;
      case 'drafts': return draftMatches;
      default: return [];
    }
  };

  const getResultBadge = (match: Match) => {
    if (match.status !== 'completed') return null;
    const gf = match.goals_for ?? 0;
    const ga = match.goals_against ?? 0;
    if (gf > ga) return <Badge className="bg-green-600 text-[10px] px-1">V</Badge>;
    if (gf < ga) return <Badge variant="destructive" className="text-[10px] px-1">D</Badge>;
    return <Badge variant="secondary" className="text-[10px] px-1">E</Badge>;
  };

  const currentMatches = getTabMatches();

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar adversário, competição..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="in_progress">Em Curso</SelectItem>
            <SelectItem value="completed">Terminado</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="finalized">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabFilter)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="today" className="text-xs">
            Hoje {tabCounts.today > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{tabCounts.today}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">
            Próximos {tabCounts.upcoming > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{tabCounts.upcoming}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="finished" className="text-xs">
            Finalizados {tabCounts.finished > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{tabCounts.finished}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts" className="text-xs">
            Rascunhos {tabCounts.drafts > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{tabCounts.drafts}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Match Cards */}
      {currentMatches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Nenhum jogo encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">Não encontramos jogos com estes filtros.</p>
            <div className="flex gap-2 justify-center">
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}>Limpar filtros</Button>
              )}
              {onCreateNew && (
                <Button size="sm" onClick={onCreateNew}><Plus className="w-4 h-4 mr-1" /> Nova convocatória</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentMatches.map(match => {
            const isInProgress = match.status === 'in_progress';
            const isCompleted = match.status === 'completed';
            const gf = match.goals_for ?? 0;
            const ga = match.goals_against ?? 0;

            return (
              <Card
                key={match.id}
                className={`transition-colors cursor-pointer active:bg-secondary/50 ${
                  isInProgress ? 'border-green-500/40 bg-green-50/30 dark:bg-green-900/10' : ''
                }`}
                onClick={() => {
                  if (isInProgress) onContinueMatch(match);
                  else if (isCompleted) onViewReport(match);
                  else onStartMatch(match);
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Date + Status row */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(match.match_date), isMobile ? 'dd MMM HH:mm' : "dd MMM yyyy, HH:mm", { locale: pt })}
                        </span>
                        <Badge variant={isInProgress ? 'default' : 'outline'} className={`text-[10px] px-1 ${isInProgress ? 'bg-green-600' : ''}`}>
                          {isInProgress ? 'Em Curso' : match.status === 'scheduled' ? 'Agendado' : match.status === 'completed' ? 'Terminado' : match.status}
                        </Badge>
                        {match.report_status && match.report_status !== 'locked' && (
                          <MatchStatusBadge status={match.report_status as ReportStatus} className="text-[10px]" />
                        )}
                      </div>

                      {/* Opponent */}
                      <div className="flex items-center gap-2">
                        <Badge variant={match.is_home ? 'default' : 'secondary'} className="text-[10px] px-1">
                          {match.is_home ? 'CASA' : 'FORA'}
                        </Badge>
                        <span className="font-medium text-sm truncate">{match.opponent_name}</span>
                        {getResultBadge(match)}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {match.competition && <span>{match.competition}</span>}
                        {match.report_entry_mode && (
                          <span>{MODE_LABELS_SHORT[match.report_entry_mode] || match.report_entry_mode}</span>
                        )}
                        {match.location && (
                          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{match.location}</span>
                        )}
                      </div>
                    </div>

                    {/* Score / Action */}
                    <div className="flex flex-col items-end gap-1">
                      {isCompleted && (
                        <div className="text-xl font-bold">{gf} - {ga}</div>
                      )}
                      {isInProgress && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <Play className="w-3 h-3 mr-1 fill-current" /> Continuar
                        </Button>
                      )}
                      {!isInProgress && !isCompleted && (
                        <Button size="sm" variant="outline" disabled={!!inProgressMatchId}>
                          <Play className="w-3 h-3 mr-1" /> Iniciar
                        </Button>
                      )}
                      {isCompleted && (
                        <Button size="sm" variant="ghost" className="text-xs">
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* FAB */}
      {onCreateNew && (
        <div className="fixed bottom-20 right-4 z-40 md:hidden">
          <Button size="lg" className="rounded-full w-14 h-14 shadow-lg" onClick={onCreateNew}>
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
