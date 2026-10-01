import { useState } from 'react';
import jsPDF from 'jspdf';
import type { MatchRuleSnapshot } from '@/lib/match-rules-service';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileDown, Target, AlertTriangle, Clock, 
  UserMinus, UserPlus, Trophy, Users
} from 'lucide-react';
import {
  computeMatchPlayerStatsWithHalves,
  getPartTimesFromElapsed,
  wasOriginalStarter,
  getSportFormatRules,
  type MatchEventForCalc,
  type StarterInfo,
} from '@/lib/match-playing-time';
import { applyPreciseMinutes } from '@/lib/playing-time-seconds';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface Lineup {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played: string | null;
  player: Player;
}

interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  second: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  is_opponent: boolean;
  notes: string | null;
  player?: Player;
  assist_player?: Player;
}

interface Match {
  id: string;
  opponent_name: string;
  is_home: boolean;
  status: string;
  goals_for: number | null;
  goals_against: number | null;
  match_date?: string;
  competition?: string | null;
  location?: string | null;
}

interface MatchReportProps {
  match: Match;
  lineups: Lineup[];
  events: MatchEvent[];
  teamName?: string;
  partElapsedSeconds?: number[];
  halfDuration?: number;
  partRegulationMinutes?: number[] | null;
  partStartersByIndex?: Record<string, string[]> | null;
  partsCount?: number;
  sportType?: string | null;
  ruleSnapshot?: MatchRuleSnapshot | null;
  /** Authoritative 2H starters snapshot (uuid[]). When provided, the engine
   *  treats it as the source of truth for who starts the 2nd half. */
  secondHalfStarterIds?: string[] | null;
  /** @deprecated Use partElapsedSeconds instead */
  halfTimes?: { firstHalfMinutes: number; secondHalfMinutes: number };
}

const MODALITY_LABELS: Record<string, string> = {
  football_11: 'Futebol 11',
  football_9: 'Futebol 9',
  football_7: 'Futebol 7',
  football_5: 'Futebol 5',
  futsal: 'Futsal',
};

export function MatchReport({ match, lineups, events, teamName, partElapsedSeconds, halfDuration = 45, partRegulationMinutes, partStartersByIndex, partsCount, sportType, ruleSnapshot, secondHalfStarterIds, halfTimes }: MatchReportProps) {
  const [generating, setGenerating] = useState(false);

  // Compute real part times from elapsed seconds
  const elapsed = partElapsedSeconds || [];
  const { partMinutes, totalMinutes } = elapsed.length > 0
    ? getPartTimesFromElapsed(elapsed)
    : {
        partMinutes: Array(partsCount ?? 2).fill(halfDuration),
        totalMinutes: Array(partsCount ?? 2).fill(halfDuration).reduce((s, m) => s + m, 0),
      };
  const firstPartStarters = new Set(partStartersByIndex?.['1'] ?? []);
  const regulationPartMinutes = partRegulationMinutes && partRegulationMinutes.length === partMinutes.length
    ? partRegulationMinutes
    : Array(partMinutes.length).fill(halfDuration);

  // Determine original starter status from events (since is_starter gets toggled during subs)
  const starterInfos: StarterInfo[] = lineups.map(l => ({
    player_id: l.player_id,
    is_starter: firstPartStarters.size > 0 ? firstPartStarters.has(l.player_id) : wasOriginalStarter(l.player_id, events as MatchEventForCalc[], l.is_starter),
  }));

  // Get sport format info
  const sportRules = getSportFormatRules(sportType);

  // Compute accurate playing minutes using interval-based engine (per half)
  const playerStats = applyPreciseMinutes(
    computeMatchPlayerStatsWithHalves(
      starterInfos,
      events as MatchEventForCalc[],
      totalMinutes,
      partMinutes,
      sportType,
      {
        secondHalfStarters: partStartersByIndex?.['2'] ?? secondHalfStarterIds ?? null,
        partStarters: partStartersByIndex ?? null,
        regulationPartMinutes,
        numberOfParts: partMinutes.length,
      },
    ),
    {
      // real seconds of each part: same calculation as the live screen
      partSeconds: elapsed,
      manualMinutes: (match as unknown as { manual_minutes?: Record<string, number[]> | null }).manual_minutes ?? null,
      partStarters: { ...(partStartersByIndex ?? {}), ...(!partStartersByIndex?.['2'] && secondHalfStarterIds?.length ? { '2': secondHalfStarterIds } : {}) },
      firstPartStarters: starterInfos.filter(s => s.is_starter).map(s => s.player_id),
      events: events as MatchEventForCalc[],
    },
  );
  const playerStatsMap = new Map(playerStats.map(s => [s.playerId, s]));

  // Build enriched player data for display
  const enrichedPlayers = lineups.map(lineup => {
    const stats = playerStatsMap.get(lineup.player_id);
    const goals = events.filter(e => e.event_type === 'goal' && !e.is_opponent && e.player_id === lineup.player_id).length;
    const assists = events.filter(e => e.event_type === 'goal' && !e.is_opponent && e.assist_player_id === lineup.player_id).length;
    const yellowCards = events.filter(e => e.event_type === 'yellow_card' && !e.is_opponent && e.player_id === lineup.player_id).length;
    const redCards = events.filter(e => e.event_type === 'red_card' && !e.is_opponent && e.player_id === lineup.player_id).length;

    return {
      player: lineup.player,
      minutesPlayed: stats?.totalMinutes || 0,
      firstHalfMinutes: stats?.firstHalfMinutes || 0,
      secondHalfMinutes: stats?.secondHalfMinutes || 0,
      partMinutes: partMinutes.map((_, idx) => (stats as any)?.realMinutesByPart?.[String(idx + 1)] ?? (idx === 0 ? stats?.firstHalfMinutes : idx === 1 ? stats?.secondHalfMinutes : 0) ?? 0),
      regulationMinutes: stats?.totalRegulationMinutes || 0,
      intervals: stats?.intervals || [],
      annotations: stats?.annotations || [],
      isStarter: stats?.isStarter || false,
      goals,
      assists,
      yellowCards,
      redCards,
    };
  }).sort((a, b) => b.minutesPlayed - a.minutesPlayed);

  // Get events grouped by type
  const goals = events.filter(e => e.event_type === 'goal' || e.event_type === 'own_goal');
  const cards = events.filter(e => e.event_type === 'yellow_card' || e.event_type === 'red_card');
  const substitutions = events.filter(e => e.event_type === 'substitution_in');

  const goalsFor = match.goals_for || 0;
  const goalsAgainst = match.goals_against || 0;
  const result = goalsFor > goalsAgainst ? 'Vitória' : goalsFor < goalsAgainst ? 'Derrota' : 'Empate';

  // Helper to determine part from absolute minute
  const getPartLabel = (minute: number) => {
    if (partMinutes.length <= 1) return '1ª';
    let cumulative = 0;
    for (let i = 0; i < partMinutes.length; i++) {
      cumulative += partMinutes[i];
      if (minute <= cumulative) return `${i + 1}ª`;
    }
    return `${partMinutes.length}ª`;
  };

  // Format part times for display
  const partTimesDisplay = partMinutes.map((m, i) => `${i + 1}ª Parte: ${m}'`).join(' | ');

  // Build substitution pairs from events (chronologically ordered)
  const buildSubstitutionPairs = () => {
    const subsOut = events
      .filter(e => e.event_type === 'substitution_out' && !e.is_opponent)
      .sort((a, b) => a.minute - b.minute);
    const subsIn = events
      .filter(e => e.event_type === 'substitution_in' && !e.is_opponent)
      .sort((a, b) => a.minute - b.minute);

    const pairs: { minute: number; part: string; outName: string; inName: string }[] = [];
    const usedIn = new Set<string>();

    for (const out of subsOut) {
      // Find matching in at same minute
      const matchingIn = subsIn.find(
        si => si.minute === out.minute && !usedIn.has(si.id)
      );
      if (matchingIn) {
        usedIn.add(matchingIn.id);
        pairs.push({
          minute: out.minute,
          part: getPartLabel(out.minute),
          outName: out.player?.name || '?',
          inName: matchingIn.player?.name || '?',
        });
      } else {
        pairs.push({
          minute: out.minute,
          part: getPartLabel(out.minute),
          outName: out.player?.name || '?',
          inName: '?',
        });
      }
    }

    // Any unmatched ins
    for (const si of subsIn) {
      if (!usedIn.has(si.id)) {
        pairs.push({
          minute: si.minute,
          part: getPartLabel(si.minute),
          outName: '?',
          inName: si.player?.name || '?',
        });
      }
    }

    return pairs.sort((a, b) => a.minute - b.minute);
  };

  const generatePdf = () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      };

      const addSection = (title: string) => {
        ensureSpace(25);
        y += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 204);
        doc.text(title, 14, y);
        y += 2;
        doc.setDrawColor(0, 102, 204);
        doc.line(14, y, pageWidth - 14, y);
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      };

      // ── Title ──
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATORIO DE JOGO', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // ── Match info ──
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const matchTitle = match.is_home 
        ? `${teamName || 'Equipa'} ${goalsFor} - ${goalsAgainst} ${match.opponent_name}`
        : `${match.opponent_name} ${goalsAgainst} - ${goalsFor} ${teamName || 'Equipa'}`;
      doc.text(matchTitle, pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      
      const matchInfo = [];
      if (match.match_date) {
        matchInfo.push(format(new Date(match.match_date), "dd/MM/yyyy HH:mm", { locale: pt }));
      }
      if (match.competition) matchInfo.push(match.competition);
      if (match.location) matchInfo.push(match.location);
      matchInfo.push(result);
      
      doc.text(matchInfo.join(' | '), pageWidth / 2, y, { align: 'center' });
      y += 6;

      // ── Modality ──
      if (sportType || ruleSnapshot) {
        const modalityLabel = ruleSnapshot
          ? (MODALITY_LABELS[ruleSnapshot.modality_code] || ruleSnapshot.modality_code)
          : (sportType ? (MODALITY_LABELS[sportType] || sportType) : '');
        const ageLabel = ruleSnapshot?.age_group_code ? ` | ${ruleSnapshot.age_group_code}` : '';
        const reentryLabel = ruleSnapshot
          ? (ruleSnapshot.reentry_allowed ? ' | Reentrada permitida' : ' | Sem reentrada')
          : '';
        doc.text(`${modalityLabel}${ageLabel}${reentryLabel}`, pageWidth / 2, y, { align: 'center' });
        y += 6;
      }

      // ── Part times ──
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const regulamentarTotal = partMinutes.length * halfDuration;
      const partTimesLines = partMinutes.map((m, i) => `${i + 1}a Parte: ${m}' (reg: ${halfDuration}')`).join(' | ');
      doc.text(partTimesLines, pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text(`Total real: ${totalMinutes}' | Regulamentar: ${regulamentarTotal}'`, pageWidth / 2, y, { align: 'center' });
      y += 5;

      // ── Titulares por Parte ──
      addSection('TITULARES POR PARTE');
      doc.setFontSize(10);
      const part1End = partMinutes[0] || halfDuration;

      const part1Starters = enrichedPlayers.filter(p => p.isStarter);
      doc.setFont('helvetica', 'bold');
      doc.text(`1a Parte (${part1Starters.length}):`, 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const p1Names = part1Starters.map(p => `${p.player.number || '-'} ${p.player.name}`).join(', ');
      const p1Lines = doc.splitTextToSize(p1Names || '-', pageWidth - 28);
      doc.text(p1Lines, 14, y);
      y += p1Lines.length * 4 + 3;

      if (partMinutes.length > 1) {
        const part2Starters = enrichedPlayers.filter(p =>
          p.intervals.some(iv => iv.start <= part1End && iv.end > part1End)
        );
        ensureSpace(15);
        doc.setFont('helvetica', 'bold');
        doc.text(`2a Parte (${part2Starters.length}):`, 14, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const p2Names = part2Starters.map(p => `${p.player.number || '-'} ${p.player.name}`).join(', ');
        const p2Lines = doc.splitTextToSize(p2Names || '-', pageWidth - 28);
        doc.text(p2Lines, 14, y);
        y += p2Lines.length * 4 + 3;
      }

      // ── Goals ──
      if (goals.length > 0) {
        addSection('GOLOS');
        doc.setFontSize(10);
        goals.forEach(goal => {
          ensureSpace(8);
          const half = getPartLabel(goal.minute);
          if (goal.event_type === 'own_goal') {
            doc.text(`${goal.minute}' (${half}) - Auto-golo${goal.player ? ` (${goal.player.name})` : ''}`, 14, y);
          } else if (goal.is_opponent) {
            doc.text(`${goal.minute}' (${half}) - ${match.opponent_name}`, 14, y);
          } else {
            const assistText = goal.assist_player ? ` (Assist: ${goal.assist_player.name})` : '';
            doc.text(`${goal.minute}' (${half}) - ${goal.player?.name || 'Desconhecido'}${assistText}`, 14, y);
          }
          y += 5;
        });
      }

      // ── Cards ──
      if (cards.length > 0) {
        addSection('CARTOES');
        doc.setFontSize(10);
        cards.forEach(card => {
          ensureSpace(8);
          const half = getPartLabel(card.minute);
          const cardType = card.event_type === 'yellow_card' ? 'Amarelo' : 'Vermelho';
          const playerName = card.is_opponent ? match.opponent_name : (card.player?.name || 'Desconhecido');
          doc.text(`${card.minute}' (${half}) - ${cardType} - ${playerName}`, 14, y);
          y += 5;
        });
      }

      // ── Substitutions ──
      const subPairs = buildSubstitutionPairs();
      if (subPairs.length > 0) {
        addSection('SUBSTITUICOES');
        doc.setFontSize(10);
        subPairs.forEach(pair => {
          ensureSpace(8);
          doc.text(`${pair.minute}' (${pair.part}) - Saiu: ${pair.outName} --> Entrou: ${pair.inName}`, 14, y);
          y += 5;
        });
      }

      // ── Player Statistics Table ──
      addSection('ESTATISTICAS DOS JOGADORES');
      doc.setFontSize(9);

      // Column positions
      const colPlayer = 14;
      const colMin = 78;
      const colG = 96;
      const colA = 108;
      const colCA = 120;
      const colCV = 132;
      const colObs = 144;

      doc.setFont('helvetica', 'bold');
      doc.text('Jogador', colPlayer, y);
      doc.text('Min', colMin, y);
      doc.text('G', colG, y);
      doc.text('A', colA, y);
      doc.text('CA', colCA, y);
      doc.text('CV', colCV, y);
      doc.text('Obs', colObs, y);
      y += 2;
      doc.line(14, y, pageWidth - 14, y);
      y += 5;

      doc.setFont('helvetica', 'normal');

      // Sort: starters first by number, then subs by number, then unused
      const sortedForPdf = [...enrichedPlayers].sort((a, b) => {
        // Starters first, then players with minutes, then unused
        if (a.isStarter && !b.isStarter) return -1;
        if (!a.isStarter && b.isStarter) return 1;
        if (a.minutesPlayed > 0 && b.minutesPlayed === 0) return -1;
        if (a.minutesPlayed === 0 && b.minutesPlayed > 0) return 1;
        return (a.player.number || 99) - (b.player.number || 99);
      });

      sortedForPdf.forEach(stat => {
        ensureSpace(8);

        const isUnused = stat.minutesPlayed === 0 && !stat.isStarter;

        // Grey text for unused players
        if (isUnused) {
          doc.setTextColor(160, 160, 160);
        } else {
          doc.setTextColor(0, 0, 0);
        }

        const playerLabel = `${stat.player.number || '-'} ${stat.player.name}`;
        doc.text(playerLabel.substring(0, 30), colPlayer, y);
        doc.text(stat.minutesPlayed.toString(), colMin, y);
        doc.text(stat.goals > 0 ? stat.goals.toString() : '-', colG, y);
        doc.text(stat.assists > 0 ? stat.assists.toString() : '-', colA, y);
        doc.text(stat.yellowCards > 0 ? stat.yellowCards.toString() : '-', colCA, y);
        doc.text(stat.redCards > 0 ? stat.redCards.toString() : '-', colCV, y);

        // Obs: truncate to fit
        const obsText = stat.annotations.join(', ');
        const maxObsWidth = pageWidth - 14 - colObs;
        const truncatedObs = doc.splitTextToSize(obsText, maxObsWidth)[0] || '-';
        doc.text(truncatedObs, colObs, y);
        y += 5;
      });

      // Reset text color
      doc.setTextColor(0, 0, 0);

      // ── Legend ──
      y += 5;
      ensureSpace(10);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Legenda: G=Golos, A=Assistencias, CA=Cartoes Amarelos, CV=Cartoes Vermelhos, TIT=Titular, E=Entrou, S=Saiu', 14, y);
      y += 4;
      doc.text('Jogadores a cinzento = nao utilizados (0 minutos)', 14, y);

      // ── Footer ──
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Pagina ${i} de ${pageCount} | Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      const fileName = `relatorio_jogo_${match.opponent_name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Relatório do Jogo
            </div>
            <Button onClick={generatePdf} disabled={generating}>
              <FileDown className="w-4 h-4 mr-2" />
              {generating ? 'A gerar...' : 'Exportar PDF'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">
              {match.is_home 
                ? `${teamName || 'Equipa'} ${goalsFor} - ${goalsAgainst} ${match.opponent_name}`
                : `${match.opponent_name} ${goalsAgainst} - ${goalsFor} ${teamName || 'Equipa'}`
              }
            </div>
            <Badge variant={result === 'Vitória' ? 'default' : result === 'Derrota' ? 'destructive' : 'secondary'}>
              {result}
            </Badge>
            <div className="text-sm text-muted-foreground mt-2">
              {ruleSnapshot && (
                <span className="mr-2">
                  <Badge variant="outline" className="mr-1">
                    {MODALITY_LABELS[ruleSnapshot.modality_code] || ruleSnapshot.modality_code}
                  </Badge>
                  {ruleSnapshot.age_group_code && (
                    <Badge variant="secondary" className="mr-1 capitalize">{ruleSnapshot.age_group_code}</Badge>
                  )}
                  {ruleSnapshot.reentry_allowed ? (
                    <Badge variant="default" className="text-xs">Reentrada permitida</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Sem reentrada</Badge>
                  )}
                </span>
              )}
              {partTimesDisplay} | Total: {totalMinutes}' (Regulamentar: {partMinutes.length}x{halfDuration}')
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-part starters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Titulares por Parte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const part1End = partMinutes[0] || halfDuration;
            const part1Starters = enrichedPlayers.filter(p => p.isStarter);
            const part2Starters = enrichedPlayers.filter(p =>
              p.intervals.some(iv => iv.start <= part1End && iv.end > part1End)
            );
            return (
              <>
                <div>
                  <div className="text-sm font-medium mb-2">1ª Parte ({part1Starters.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {part1Starters.map(p => (
                      <Badge key={p.player.id} variant="secondary">
                        {p.player.number || '-'} {p.player.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                {partMinutes.length > 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">2ª Parte ({part2Starters.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {part2Starters.map(p => (
                        <Badge key={p.player.id} variant="outline">
                          {p.player.number || '-'} {p.player.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-600" />
              Golos ({goals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem golos</p>
            ) : (
              goals.map(goal => {
                const half = getPartLabel(goal.minute);
                return (
                  <div key={goal.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{goal.minute}' ({half})</Badge>
                      {goal.event_type === 'own_goal' ? (
                        <span className="text-destructive">Auto-golo</span>
                      ) : goal.is_opponent ? (
                        <span>{match.opponent_name}</span>
                      ) : (
                        <span>{goal.player?.name}</span>
                      )}
                    </div>
                    {goal.assist_player && !goal.is_opponent && (
                      <span className="text-sm text-muted-foreground">
                        Assist: {goal.assist_player.name}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              Cartões ({cards.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem cartões</p>
            ) : (
              cards.map(card => {
                const half = getPartLabel(card.minute);
                return (
                  <div key={card.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                    <Badge variant="outline">{card.minute}' ({half})</Badge>
                    <div className={`w-4 h-5 rounded-sm ${card.event_type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                    <span>{card.is_opponent ? match.opponent_name : card.player?.name}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Player Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Estatísticas dos Jogadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Jogador</th>
                    <th className="text-center py-2 px-2">Min</th>
                    <th className="text-center py-2 px-2">G</th>
                    <th className="text-center py-2 px-2">A</th>
                    <th className="text-center py-2 px-2">
                      <div className="w-4 h-5 bg-yellow-400 rounded-sm mx-auto" />
                    </th>
                    <th className="text-center py-2 px-2">
                      <div className="w-4 h-5 bg-red-500 rounded-sm mx-auto" />
                    </th>
                    <th className="text-left py-2 px-2">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedPlayers.map(stat => (
                    <tr key={stat.player.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="min-w-[32px] justify-center">
                            {stat.player.number || '-'}
                          </Badge>
                          <span>{stat.player.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2 font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">
                              {stat.minutesPlayed}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <div className="font-medium">
                                {stat.partMinutes.map((m, i) => `${i + 1}.ª P ${m}'`).join(' + ')} = {stat.minutesPlayed}' reais
                              </div>
                              {stat.regulationMinutes !== stat.minutesPlayed && (
                                <div className="text-muted-foreground">
                                  Regulamentar: {stat.regulationMinutes}'
                                </div>
                              )}
                              <div className="border-t pt-1">
                                {stat.intervals.map((iv, i) => (
                                  <div key={i}>{iv.start}' → {iv.end}' = {iv.end - iv.start} min</div>
                                ))}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        {stat.partMinutes.filter(m => m > 0).length > 1 ? (
                          <div className="text-[10px] text-muted-foreground">{stat.partMinutes.filter(m => m > 0).join('+')}'</div>
                        ) : null}
                      </td>
                      <td className="text-center py-2 px-2">{stat.goals > 0 ? stat.goals : '-'}</td>
                      <td className="text-center py-2 px-2">{stat.assists > 0 ? stat.assists : '-'}</td>
                      <td className="text-center py-2 px-2">{stat.yellowCards > 0 ? stat.yellowCards : '-'}</td>
                      <td className="text-center py-2 px-2">{stat.redCards > 0 ? stat.redCards : '-'}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {stat.annotations.map((ann, i) => (
                            <Badge key={i} variant="outline" className={`text-xs ${
                              ann.startsWith('E') ? 'text-green-600' :
                              ann.startsWith('S') ? 'text-orange-600' : ''
                            }`}>
                              {ann}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
          <div className="text-xs text-muted-foreground mt-4">
            Legenda: G=Golos, A=Assistências, TIT=Titular, E=Entrou, S=Saiu
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
