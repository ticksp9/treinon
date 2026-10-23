/** Everything the team dossier shows (and prints) for one team and season. */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { categoryAverage, overallAverage, type AttributeScores } from '@/lib/player-attributes';
import { activeWeeks, sessionRecorded, seasonWeeks, weekEnd, weekStartOf, type Mesocycle, type Microcycle, type PlanPeriod, type PlanSession } from '@/lib/training-plan';
import type { DossierCounts } from '@/lib/dossier';
import { objectiveStats, type DossierObjective } from '@/lib/objectives';
import { ageOfCategory, formatOfTeam, guidelinesProgress, MODEL_FIELDS, type GameFormat, type Guidelines } from '@/lib/guidelines';
import { typicalMap, type TrainingSlot, type TypicalRow } from '@/lib/club-map';
import type { MatchReview } from '@/components/matches/MatchReviewCard';

const db = supabase as any; // newer than the generated types

export interface DossierPlayer { id: string; name: string; number: number | null; position: string | null; birth_date: string | null }
export interface DossierEvaluation { player_id: string; evaluation_date: string; period_label: string | null; behaviour: number | null; performance: number | null }
export interface DossierMatch {
  id: string; match_date: string; opponent_name: string; is_home: boolean | null; goals_for: number | null; goals_against: number | null;
  called: number; avgRating: number | null; playerNotes: number; opponentNotes: string | null;
  review: MatchReview | null;
}
export interface DossierReview { id: string; created_at: string; note: string | null; reviewer: string }
export interface DossierData {
  team: { id: string; name: string; category: string | null; club_name: string | null; sport_type: string | null };
  season: { id: string; name: string; start_date: string; end_date: string };
  objectives: string | null;
  /** objectives with indicator, target and deadline: the team's and each player's */
  teamObjectives: DossierObjective[];
  playerObjectives: DossierObjective[];
  /** the club's guiding document and the game format of this team */
  guidelines: Guidelines | null;
  format: GameFormat | null;
  /** the team's weekly timetable (club map), as the FPF "mapa-tipo" row */
  slots: TrainingSlot[];
  typical: TypicalRow | null;
  materials: string | null;
  periods: PlanPeriod[];
  mesos: Mesocycle[];
  micros: Microcycle[];
  sessions: (PlanSession & { present: number; marked: number })[];
  players: DossierPlayer[];
  evaluations: DossierEvaluation[];
  matches: DossierMatch[];
  reviews: DossierReview[];
  canReview: boolean;
  counts: DossierCounts;
}

export function useDossierData(teamId: string | null, season: { id: string; name: string; start_date: string; end_date: string } | null) {
  return useQuery({
    queryKey: ['dossier', teamId, season?.id],
    enabled: !!teamId && !!season,
    queryFn: async (): Promise<DossierData> => {
      const from = season!.start_date.slice(0, 10), to = season!.end_date.slice(0, 10), toEnd = `${to}T23:59:59`;
      const nowIso = new Date().toISOString();
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const [team, plan, mesos, micros, sessions, players, matches, reviews, canReview, objectives, slots] = await Promise.all([
        supabase.from('teams').select('id, name, category, sport_type, club_id, club:clubs(name)').eq('id', teamId!).maybeSingle(),
        db.from('team_season_plans').select('objectives, periods, materials').eq('team_id', teamId).eq('season_id', season!.id).maybeSingle(),
        db.from('training_mesocycles').select('*').eq('team_id', teamId).eq('season_id', season!.id).order('start_date'),
        db.from('training_microcycles').select('*').eq('team_id', teamId).gte('week_start', weekStartOf(from)).lte('week_start', to).order('week_start'),
        db.from('training_sessions').select('id, date, duration_minutes, objectives, exercises, notes, actual_minutes, session_rating, closed_at, status, session_type')
          .eq('team_id', teamId).gte('date', from).lte('date', toEnd).order('date'),
        supabase.from('players').select('id, name, number, position, birth_date').eq('team_id', teamId!).eq('is_active', true).order('number'),
        supabase.from('matches').select('id, match_date, opponent_name, is_home, goals_for, goals_against, status').eq('team_id', teamId!).eq('is_deleted', false)
          .gte('match_date', from).lte('match_date', toEnd).order('match_date'),
        db.from('dossier_reviews').select('id, created_at, note, reviewed_by').eq('team_id', teamId).eq('season_id', season!.id).order('created_at', { ascending: false }),
        db.rpc('can_review_dossier', { _user: userId, _team: teamId }),
        db.from('dossier_objectives').select('*').eq('team_id', teamId).order('sort_order').order('created_at'),
        db.from('team_training_slots').select('*').eq('team_id', teamId).order('weekday'),
      ]);
      const t = team.data as any;
      const guidelinesQ = db.from('club_guidelines').select('content');

      const playerList = ((players.data ?? []) as DossierPlayer[]).sort((x, y) => (x.number ?? 999) - (y.number ?? 999) || x.name.localeCompare(y.name));
      const sessionList = ((sessions.data ?? []) as PlanSession[]).filter((s) => s.status !== 'cancelled');
      const pastSessions = sessionList.filter((s) => s.date <= nowIso);
      const finished = ((matches.data ?? []) as any[]).filter((m) => m.status === 'completed' || m.status === 'finished' || (m.goals_for != null && m.match_date <= nowIso));

      const [evals, attendance, lineups, notes, oppObs, reviewers, matchReviews, guidelines] = await Promise.all([
        playerList.length ? supabase.from('player_evaluations').select('player_id, evaluation_date, period_label, attributes')
          .in('player_id', playerList.map((p) => p.id)).gte('evaluation_date', from).lte('evaluation_date', to).order('evaluation_date', { ascending: false }) : { data: [] },
        pastSessions.length ? supabase.from('training_attendance').select('session_id, present').in('session_id', pastSessions.map((s) => s.id)) : { data: [] },
        finished.length ? supabase.from('match_lineups').select('match_id, rating').in('match_id', finished.map((m) => m.id)) : { data: [] },
        finished.length ? db.from('match_player_notes').select('match_id').in('match_id', finished.map((m) => m.id)) : { data: [] },
        finished.length ? db.from('scout_opponent_observations').select('match_id, notes, formation').in('match_id', finished.map((m) => m.id)) : { data: [] },
        (reviews.data ?? []).length ? supabase.from('profiles').select('id, display_name, full_name').in('id', (reviews.data as any[]).map((r) => r.reviewed_by).filter(Boolean)) : { data: [] },
        finished.length ? db.from('match_reviews').select('match_id, positives, improve, next_focus').in('match_id', finished.map((m) => m.id)) : { data: [] },
        (t?.club_id ? guidelinesQ.eq('club_id', t.club_id) : guidelinesQ.eq('owner_id', userId)).maybeSingle(),
      ]);

      const evaluations: DossierEvaluation[] = ((evals.data ?? []) as any[]).map((e) => {
        const scores = (e.attributes ?? {}) as AttributeScores;
        return { player_id: e.player_id, evaluation_date: e.evaluation_date, period_label: e.period_label, behaviour: categoryAverage(scores, 'behaviour'), performance: overallAverage(scores) };
      });
      const att = new Map<string, { present: number; marked: number }>();
      for (const a of (attendance.data ?? []) as { session_id: string; present: boolean }[]) {
        const v = att.get(a.session_id) ?? { present: 0, marked: 0 };
        v.marked++; if (a.present) v.present++;
        att.set(a.session_id, v);
      }
      const matchList: DossierMatch[] = finished.map((m) => {
        const ls = ((lineups.data ?? []) as { match_id: string; rating: number | null }[]).filter((l) => l.match_id === m.id);
        const rated = ls.filter((l) => l.rating != null);
        const opp = ((oppObs.data ?? []) as { match_id: string; notes: string | null; formation: string | null }[]).find((o) => o.match_id === m.id);
        const rv = ((matchReviews.data ?? []) as (MatchReview & { match_id: string })[]).find((r) => r.match_id === m.id);
        const review = rv && [rv.positives, rv.improve, rv.next_focus].some((v) => v?.trim()) ? { positives: rv.positives, improve: rv.improve, next_focus: rv.next_focus } : null;
        return {
          id: m.id, match_date: m.match_date, opponent_name: m.opponent_name, is_home: m.is_home, goals_for: m.goals_for, goals_against: m.goals_against,
          called: ls.length,
          avgRating: rated.length ? rated.reduce((a, l) => a + Number(l.rating), 0) / rated.length : null,
          playerNotes: ((notes.data ?? []) as { match_id: string }[]).filter((n) => n.match_id === m.id).length,
          opponentNotes: opp ? [opp.formation, opp.notes].filter(Boolean).join(' · ') || null : null,
          review,
        };
      });
      const names = new Map(((reviewers.data ?? []) as any[]).map((p) => [p.id, p.display_name || p.full_name || '']));

      const thisWeek = weekStartOf(new Date());
      const weeks = seasonWeeks(from, to);
      // only the weeks with training or matches need a microcycle
      const working = activeWeeks(sessionList, (matches.data ?? []) as { match_date: string }[]);
      const soFar = weeks.filter((w) => w <= thisWeek && working.has(w));
      const over = weeks.filter((w) => weekEnd(w) < nowIso.slice(0, 10) && working.has(w));
      const microList = (micros.data ?? []) as Microcycle[];
      const microBy = new Map(microList.map((m) => [m.week_start, m]));
      const withBehaviour = new Set(evaluations.filter((e) => e.behaviour != null).map((e) => e.player_id));
      const withPerformance = new Set(evaluations.filter((e) => e.performance != null).map((e) => e.player_id));
      const periods = ((plan.data?.periods ?? []) as PlanPeriod[]);
      // objectives of this season (or without a season)
      const objectiveList = ((objectives.data ?? []) as DossierObjective[]).filter((o) => !o.season_id || o.season_id === season!.id);
      const teamObjectives = objectiveList.filter((o) => !o.player_id);
      const playerIds = new Set(playerList.map((p) => p.id));
      const playerObjectives = objectiveList.filter((o) => o.player_id && playerIds.has(o.player_id));
      const tStats = objectiveStats(teamObjectives);
      const gl = ((guidelines as { data?: { content?: Guidelines } | null })?.data?.content ?? null) as Guidelines | null;
      const format = formatOfTeam({ category: t?.category, sport_type: t?.sport_type });
      const model = format ? gl?.models?.[format] : undefined;
      const slotList = (slots.data ?? []) as TrainingSlot[];
      const typical = slotList.length ? typicalMap(slotList, [{ id: teamId!, name: t?.name ?? '', category: t?.category ?? null }], ageOfCategory)[0] : null;

      return {
        team: { id: teamId!, name: t?.name ?? '', category: t?.category ?? null, club_name: (Array.isArray(t?.club) ? t.club[0] : t?.club)?.name ?? null, sport_type: t?.sport_type ?? null },
        season: season!,
        objectives: plan.data?.objectives ?? null,
        teamObjectives, playerObjectives,
        guidelines: gl, format,
        slots: slotList, typical,
        materials: plan.data?.materials ?? null,
        periods,
        mesos: (mesos.data ?? []) as Mesocycle[],
        micros: microList,
        sessions: sessionList.map((s) => ({ ...s, ...(att.get(s.id) ?? { present: 0, marked: 0 }) })),
        players: playerList,
        evaluations,
        matches: matchList,
        reviews: ((reviews.data ?? []) as any[]).map((r) => ({ id: r.id, created_at: r.created_at, note: r.note, reviewer: names.get(r.reviewed_by) ?? '' })),
        canReview: canReview.data === true,
        counts: {
          players: playerList.length,
          playersWithBehaviour: playerList.filter((p) => withBehaviour.has(p.id)).length,
          playersWithPerformance: playerList.filter((p) => withPerformance.has(p.id)).length,
          hasObjectives: !!plan.data?.objectives?.trim(),
          periods: periods.length,
          mesocycles: (mesos.data ?? []).length,
          weeksSoFar: soFar.length,
          weeksPlanned: soFar.filter((w) => microBy.get(w)?.objectives?.trim()).length,
          weeksOver: over.length,
          weeksReviewed: over.filter((w) => microBy.get(w)?.review?.trim()).length,
          sessionsDone: pastSessions.length,
          sessionsRecorded: pastSessions.filter(sessionRecorded).length,
          matchesPlayed: matchList.length,
          matchesEvaluated: matchList.filter((m) => m.avgRating != null || m.playerNotes > 0 || m.opponentNotes || m.review).length,
          teamObjectives: tStats.total,
          teamObjectivesMeasurable: tStats.measurable,
          teamObjectivesEvaluated: tStats.evaluated,
          playersWithObjectives: new Set(playerObjectives.map((o) => o.player_id)).size,
          guidelinesModel: !!model && MODEL_FIELDS.filter((k) => k.key !== 'setPieces').every((k) => !!model[k.key]?.trim()),
          guidelinesStages: guidelinesProgress(gl).stages,
          slots: slotList.length,
          slotsWithSpace: slotList.filter((s) => !!s.space).length,
          needsFullPitch: !!typical?.needsFullPitch,
          hasMaterials: !!plan.data?.materials?.trim(),
          matchesReviewed: matchList.filter((m) => m.review).length,
        },
      };
    },
  });
}
