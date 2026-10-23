import { useEffect, useState } from 'react';
import { OpponentMatchNotes } from './OpponentMatchNotes';
import { imageAsDataUrl } from '@/lib/team-branding';
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
import { orderByPosition, partLineup, shortName, type PartLineup } from '@/lib/report-lineup';
import type { LiveTactics } from '@/lib/live-tactics';
import { deliverPdf } from '@/lib/native-files';
import { dateLocale, tr, tx, useT, lang, inPdfLanguage } from '@/lib/i18n/ui';

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
  /** our crest, on top of the PDF */
  crestUrl?: string | null;
  /** the tactic at the end of the match, and the one each part started with (when saved) */
  liveTactics?: LiveTactics | null;
  partTactics?: Record<string, LiveTactics> | null;
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
  football_11: tr('Futebol 11'),
  football_9: tr('Futebol 9'),
  football_7: tr('Futebol 7'),
  football_5: tr('Futebol 5'),
  futsal: tr('Futsal'),
};

export function MatchReport({ crestUrl, liveTactics, partTactics, match, lineups, events, teamName, partElapsedSeconds, halfDuration = 45, partRegulationMinutes, partStartersByIndex, partsCount, sportType, ruleSnapshot, secondHalfStarterIds, halfTimes }: MatchReportProps) {
  const [generating, setGenerating] = useState(false);
  const t = useT();
  // read ahead, so the PDF is made the moment the coach asks for it
  const [crest, setCrest] = useState<{ dataUrl: string; ratio: number } | null>(null);
  useEffect(() => { let on = true; imageAsDataUrl(crestUrl).then((c) => on && setCrest(c)); return () => { on = false; }; }, [crestUrl]);

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

  // who started each part: the saved starting players of the part, else whoever was on the pitch when it began
  const partStartMinute = partMinutes.map((_, i) => partMinutes.slice(0, i).reduce((a, b) => a + b, 0));
  const startersByPart: string[][] = partMinutes.map((_, i) => {
    if (i === 0) return enrichedPlayers.filter(p => p.isStarter).map(p => p.player.id);
    const saved = partStartersByIndex?.[String(i + 1)] ?? (i === 1 ? secondHalfStarterIds : null);
    if (saved?.length) return saved.filter(id => enrichedPlayers.some(p => p.player.id === id));
    const tm = partStartMinute[i];
    return enrichedPlayers.filter(p => p.intervals.some(iv => iv.start <= tm && iv.end > tm)).map(p => p.player.id);
  });
  const positionOf = (id: string) => lineups.find(l => l.player_id === id)?.player?.position ?? null;
  const numberOf = (id: string) => lineups.find(l => l.player_id === id)?.player?.number ?? null;
  const lineupByPart: (PartLineup | null)[] = startersByPart.map((ids, i) => partLineup(sportType, i + 1, partTactics, liveTactics, ids, positionOf));
  /** the starters of a part: goalkeeper, defenders, midfielders, forwards */
  const playersOf = (ids: string[], part = -1) => orderByPosition(ids, lineupByPart[part] ?? null, positionOf, numberOf)
    .map(id => enrichedPlayers.find(p => p.player.id === id)).filter((p): p is (typeof enrichedPlayers)[number] => !!p);
  const nameOf = (id: string | null) => (id ? lineups.find(l => l.player_id === id)?.player : null);
  /** "TIT 1ªP/3ªP, S59' (3.ºP)": the parts a player started, then when he came on or off */
  const obsFor = (p: (typeof enrichedPlayers)[number]) => {
    const started = startersByPart.map((ids, i) => (ids.includes(p.player.id) ? i + 1 : 0)).filter(Boolean);
    const rest = p.annotations.filter(a => !/^TIT\b/.test(a));
    return [started.length ? `TIT ${started.map(n => `${n}ªP`).join('/')}` : '', ...rest].filter(Boolean).join(', ');
  };

  // Get events grouped by type
  const goals = events.filter(e => e.event_type === 'goal' || e.event_type === 'own_goal');
  const cards = events.filter(e => e.event_type === 'yellow_card' || e.event_type === 'red_card');
  const substitutions = events.filter(e => e.event_type === 'substitution_in');

  const goalsFor = match.goals_for || 0;
  const goalsAgainst = match.goals_against || 0;
  const result = goalsFor > goalsAgainst ? tr('Vitória') : goalsFor < goalsAgainst ? tr('Derrota') : tr('Empate');

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
  const partTimesDisplay = partMinutes.map((m, i) => `${tx('{{n}}ª Parte', { n: i + 1 })}: ${m}'`).join(' | ');

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

  const generatePdf = () => inPdfLanguage(() => {
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
      if (crest) { const h = 18; doc.addImage(crest.dataUrl, 'PNG', 14, 8, h * crest.ratio, h); }
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(tx('RELATORIO DE JOGO'), pageWidth / 2, y, { align: 'center' });
      y += 12;

      // ── Match info ──
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const matchTitle = match.is_home 
        ? `${teamName || tx('Equipa')} ${goalsFor} - ${goalsAgainst} ${match.opponent_name}`
        : `${match.opponent_name} ${goalsAgainst} - ${goalsFor} ${teamName || tx('Equipa')}`;
      doc.text(matchTitle, pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      
      const matchInfo = [];
      if (match.match_date) {
        matchInfo.push(format(new Date(match.match_date), "dd/MM/yyyy HH:mm", { locale: dateLocale() }));
      }
      if (match.competition) matchInfo.push(tx(match.competition));
      if (match.location) matchInfo.push(match.location);
      matchInfo.push(tx(result));
      
      doc.text(matchInfo.join(' | '), pageWidth / 2, y, { align: 'center' });
      y += 6;

      // ── Modality ──
      if (sportType || ruleSnapshot) {
        const modalityLabel = ruleSnapshot
          ? tx(MODALITY_LABELS[ruleSnapshot.modality_code] || ruleSnapshot.modality_code)
          : (sportType ? tx(MODALITY_LABELS[sportType] || sportType) : '');
        const ageLabel = ruleSnapshot?.age_group_code ? ` | ${ruleSnapshot.age_group_code}` : '';
        const reentryLabel = ruleSnapshot
          ? (ruleSnapshot.reentry_allowed ? ' | ' + tx('Reentrada permitida') : ' | ' + tx('Sem reentrada'))
          : '';
        doc.text(`${modalityLabel}${ageLabel}${reentryLabel}`, pageWidth / 2, y, { align: 'center' });
        y += 6;
      }

      // ── Part times ──
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      // the minutes each part was meant to last (e.g. 15 + 15 + 30), not one value for all
      const regulamentarTotal = regulationPartMinutes.reduce((a, b) => a + b, 0);
      const partTimesLines = partMinutes.map((m, i) => tx('{{n}}a Parte: {{min}} (reg: {{reg}})', { n: i + 1, min: `${m}'`, reg: `${regulationPartMinutes[i] ?? halfDuration}'` })).join(' | ');
      doc.text(partTimesLines, pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text(tx('Total real: {{real}} | Regulamentar: {{reg}}', { real: `${totalMinutes}'`, reg: `${regulamentarTotal}'` }), pageWidth / 2, y, { align: 'center' });
      y += 5;

      // ── Tactic and starting line-up, drawn ──
      const start = lineupByPart[0];
      if (start) {
        addSection(tx('TATICA E ONZE INICIAL'));
        const pw = 78, ph = 100, px = 14, py = y;
        ensureSpace(ph + 6);
        // pitch (own goal at the bottom)
        doc.setFillColor(42, 119, 71); doc.rect(px, py, pw, ph, 'F');
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.4);
        doc.rect(px + 2, py + 2, pw - 4, ph - 4);
        doc.line(px + 2, py + ph / 2, px + pw - 2, py + ph / 2);
        doc.circle(px + pw / 2, py + ph / 2, 9);
        doc.rect(px + pw / 2 - 18, py + 2, 36, 14); doc.rect(px + pw / 2 - 18, py + ph - 16, 36, 14);
        start.spots.forEach(spot => {
          const cx = px + 4 + spot.x * (pw - 8), cy = py + 4 + (1 - spot.y) * (ph - 12);
          const pl = nameOf(spot.playerId);
          doc.setFillColor(spot.role === 'goalkeeper' ? 234 : 30, spot.role === 'goalkeeper' ? 179 : 64, spot.role === 'goalkeeper' ? 8 : 175);
          doc.setDrawColor(255, 255, 255); doc.circle(cx, cy, 3.2, 'FD');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
          doc.text(pl?.number != null ? String(pl.number) : spot.label, cx, cy + 1, { align: 'center' });
          doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
          doc.text(pl ? shortName(pl.name) : spot.label, cx, cy + 6.2, { align: 'center' });
        });
        doc.setTextColor(0, 0, 0);
        // the tactic of every part, beside the pitch
        let ty = py + 4;
        const tX = px + pw + 8;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(tx('Tatica: {{f}}', { f: start.formation }), tX, ty); ty += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        lineupByPart.forEach((l, i) => { doc.text(tx('{{n}}a Parte: {{f}}', { n: i + 1, f: l?.formation ?? '-' }), tX, ty); ty += 4.5; });
        if (start.estimated) {
          ty += 2; doc.setFontSize(8); doc.setTextColor(110, 110, 110);
          const note = doc.splitTextToSize(tx('Posicoes do onze inicial reconstituidas a partir da tatica do fim do jogo (os jogos novos guardam a tatica de cada parte).'), pageWidth - tX - 14);
          doc.text(note, tX, ty); ty += note.length * 3.6; doc.setTextColor(0, 0, 0);
        }
        y = py + ph + 4;
      }

      // ── Titulares por Parte ──
      addSection(tx('TITULARES POR PARTE'));
      doc.setFontSize(10);
      startersByPart.forEach((ids, i) => {
        const list = playersOf(ids, i);
        ensureSpace(15);
        doc.setFont('helvetica', 'bold');
        doc.text(`${tx('{{n}}a Parte ({{c}})', { n: i + 1, c: list.length })}${lineupByPart[i] ? ` - ${lineupByPart[i]!.formation}` : ''}:`, 14, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const names = list.map(p => `${p.player.number || '-'} ${p.player.name}`).join(', ');
        const lines = doc.splitTextToSize(names || '-', pageWidth - 28);
        doc.text(lines, 14, y);
        y += lines.length * 4 + 3;
      });

      // ── Goals ──
      if (goals.length > 0) {
        addSection(tx('GOLOS'));
        doc.setFontSize(10);
        goals.forEach(goal => {
          ensureSpace(8);
          const half = getPartLabel(goal.minute);
          if (goal.event_type === 'own_goal') {
            doc.text(`${goal.minute}' (${half}) - ${tx('Auto-golo')}${goal.player ? ` (${goal.player.name})` : ''}`, 14, y);
          } else if (goal.is_opponent) {
            doc.text(`${goal.minute}' (${half}) - ${match.opponent_name}`, 14, y);
          } else {
            const assistText = goal.assist_player ? ` (${tx('Assist')}: ${goal.assist_player.name})` : '';
            doc.text(`${goal.minute}' (${half}) - ${goal.player?.name || tx('Desconhecido')}${assistText}`, 14, y);
          }
          y += 5;
        });
      }

      // ── Cards ──
      if (cards.length > 0) {
        addSection(tx('CARTOES'));
        doc.setFontSize(10);
        cards.forEach(card => {
          ensureSpace(8);
          const half = getPartLabel(card.minute);
          const cardType = card.event_type === 'yellow_card' ? tx('Amarelo') : tx('Vermelho');
          const playerName = card.is_opponent ? match.opponent_name : (card.player?.name || tx('Desconhecido'));
          doc.text(`${card.minute}' (${half}) - ${cardType} - ${playerName}`, 14, y);
          y += 5;
        });
      }

      // ── Substitutions ──
      const subPairs = buildSubstitutionPairs();
      if (subPairs.length > 0) {
        addSection(tx('SUBSTITUICOES'));
        doc.setFontSize(10);
        subPairs.forEach(pair => {
          ensureSpace(8);
          doc.text(`${pair.minute}' (${pair.part}) - ${tx('Saiu')}: ${pair.outName} --> ${tx('Entrou')}: ${pair.inName}`, 14, y);
          y += 5;
        });
      }

      // ── Player Statistics Table ──
      addSection(tx('ESTATISTICAS DOS JOGADORES'));
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
      doc.text(tx('Jogador'), colPlayer, y);
      doc.text(t('Min'), colMin, y);
      doc.text(tx('G'), colG, y);
      doc.text(tx('A'), colA, y);
      doc.text(tx('CA'), colCA, y);
      doc.text(tx('CV'), colCV, y);
      doc.text(tx('Obs'), colObs, y);
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

        // Obs: which parts he started, then entries and exits
        const obsText = obsFor(stat);
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
      doc.text(tx('Legenda: G=Golos, A=Assistencias, CA=Cartoes Amarelos, CV=Cartoes Vermelhos, TIT=Titular, E=Entrou, S=Saiu'), 14, y);
      y += 4;
      doc.text(tx('Jogadores a cinzento = nao utilizados (0 minutos)'), 14, y);

      // ── Footer ──
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          tx('Pagina {{i}} de {{n}} | Gerado em {{when}}', { i, n: pageCount, when: format(new Date(), 'dd/MM/yyyy HH:mm') }),
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      const fileName = `${lang() !== 'pt' ? 'match_report' : 'relatorio_jogo'}_${match.opponent_name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      void deliverPdf(doc, fileName, { title: tx('Relatório de jogo') });
    } finally {
      setGenerating(false);
    }
  });

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {t('Relatório do Jogo')}
            </div>
            <Button onClick={generatePdf} disabled={generating}>
              <FileDown className="w-4 h-4 mr-2" />
              {generating ? t('A gerar...') : t('Exportar PDF')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">
              {match.is_home 
                ? `${teamName || t('Equipa')} ${goalsFor} - ${goalsAgainst} ${match.opponent_name}`
                : `${match.opponent_name} ${goalsAgainst} - ${goalsFor} ${teamName || t('Equipa')}`
              }
            </div>
            <Badge variant={result === tr('Vitória') ? 'default' : result === tr('Derrota') ? 'destructive' : 'secondary'}>
              {t(result)}
            </Badge>
            <div className="text-sm text-muted-foreground mt-2">
              {ruleSnapshot && (
                <span className="mr-2">
                  <Badge variant="outline" className="mr-1">
                    {t(MODALITY_LABELS[ruleSnapshot.modality_code] || ruleSnapshot.modality_code)}
                  </Badge>
                  {ruleSnapshot.age_group_code && (
                    <Badge variant="secondary" className="mr-1 capitalize">{ruleSnapshot.age_group_code}</Badge>
                  )}
                  {ruleSnapshot.reentry_allowed ? (
                    <Badge variant="default" className="text-xs">{t('Reentrada permitida')}</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">{t('Sem reentrada')}</Badge>
                  )}
                </span>
              )}
              {partTimesDisplay} | {t('Total')}: {totalMinutes}' ({t('Regulamentar')}: {regulationPartMinutes.map(m => `${m}'`).join(' + ')} = {regulationPartMinutes.reduce((a, b) => a + b, 0)}')
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What the coach saw of the opponent (also kept in their Scouting sheet) */}
      <OpponentMatchNotes matchId={match.id} />

      {/* Per-part starters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('Titulares por Parte')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineupByPart[0] && (
            <div className="flex flex-wrap items-start gap-4">
              <svg viewBox="0 0 78 100" className="w-48 shrink-0 rounded-md" role="img" aria-label={t('Onze inicial em {{f}}', { f: lineupByPart[0].formation })}>
                <rect width="78" height="100" fill="#2a7747" />
                <g stroke="white" strokeWidth="0.4" fill="none">
                  <rect x="2" y="2" width="74" height="96" /><line x1="2" y1="50" x2="76" y2="50" /><circle cx="39" cy="50" r="9" />
                  <rect x="21" y="2" width="36" height="14" /><rect x="21" y="84" width="36" height="14" />
                </g>
                {lineupByPart[0].spots.map(spot => {
                  const cx = 4 + spot.x * 70, cy = 4 + (1 - spot.y) * 88;
                  const pl = nameOf(spot.playerId);
                  return (
                    <g key={spot.slotId}>
                      <circle cx={cx} cy={cy} r="3.2" fill={spot.role === 'goalkeeper' ? '#eab308' : '#1e40af'} stroke="white" strokeWidth="0.4" />
                      <text x={cx} y={cy + 1} textAnchor="middle" fontSize="3" fontWeight="700" fill="white">{pl?.number ?? spot.label}</text>
                      <text x={cx} y={cy + 6.2} textAnchor="middle" fontSize="2.6" fill="white">{pl ? shortName(pl.name) : spot.label}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{t('Tática: {{f}}', { f: lineupByPart[0].formation })}</p>
                {lineupByPart.map((l, i) => <p key={i} className="text-muted-foreground">{t('{{n}}ª Parte', { n: i + 1 })}: {l?.formation ?? '—'}</p>)}
                {lineupByPart[0].estimated && <p className="max-w-xs text-xs text-muted-foreground">{t('Posições reconstituídas a partir da tática do fim do jogo. Os jogos novos guardam a tática de cada parte.')}</p>}
              </div>
            </div>
          )}
          {startersByPart.map((ids, i) => {
            const list = playersOf(ids, i);
            return (
              <div key={i}>
                <div className="text-sm font-medium mb-2">{t('{{n}}ª Parte', { n: i + 1 })} ({list.length}){lineupByPart[i] ? ` · ${lineupByPart[i]!.formation}` : ''}</div>
                <div className="flex flex-wrap gap-1">
                  {list.map(p => (
                    <Badge key={p.player.id} variant={i === 0 ? 'secondary' : 'outline'}>
                      {p.player.number || '-'} {p.player.name}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-600" />
              {t('Golos ({{n}})', { n: goals.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('Sem golos')}</p>
            ) : (
              goals.map(goal => {
                const half = getPartLabel(goal.minute);
                return (
                  <div key={goal.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{goal.minute}' ({half})</Badge>
                      {goal.event_type === 'own_goal' ? (
                        <span className="text-destructive">{t('Auto-golo')}</span>
                      ) : goal.is_opponent ? (
                        <span>{match.opponent_name}</span>
                      ) : (
                        <span>{goal.player?.name}</span>
                      )}
                    </div>
                    {goal.assist_player && !goal.is_opponent && (
                      <span className="text-sm text-muted-foreground">
                        {t('Assist')}: {goal.assist_player.name}
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
              {t('Cartões ({{n}})', { n: cards.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('Sem cartões')}</p>
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
            {t('Estatísticas dos Jogadores')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">{t('Jogador')}</th>
                    <th className="text-center py-2 px-2">{t('Min')}</th>
                    <th className="text-center py-2 px-2">{t('G')}</th>
                    <th className="text-center py-2 px-2">{t('A')}</th>
                    <th className="text-center py-2 px-2">
                      <div className="w-4 h-5 bg-yellow-400 rounded-sm mx-auto" />
                    </th>
                    <th className="text-center py-2 px-2">
                      <div className="w-4 h-5 bg-red-500 rounded-sm mx-auto" />
                    </th>
                    <th className="text-left py-2 px-2">{t('Obs')}</th>
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
                                {stat.partMinutes.map((m, i) => `${tx('{{n}}.ª P', { n: i + 1 })} ${m}'`).join(' + ')} = {stat.minutesPlayed}' {t('reais')}
                              </div>
                              {stat.regulationMinutes !== stat.minutesPlayed && (
                                <div className="text-muted-foreground">
                                  {t('Regulamentar')}: {stat.regulationMinutes}'
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
                          {obsFor(stat).split(', ').filter(Boolean).map((ann, i) => (
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
            {t('Legenda: G=Golos, A=Assistências, TIT=Titular, E=Entrou, S=Saiu')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
