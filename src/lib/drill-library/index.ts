import { DRILLS } from './drills';
import { SESSION_PLANS, AGE_GUIDES } from './sessions';
import { DRILL_CATEGORIES, EQUIPMENT_LABELS, type Drill, type SessionPlan } from './types';

export * from './types';
export { DRILLS, SESSION_PLANS, AGE_GUIDES };

const byId = new Map(DRILLS.map((d) => [d.id, d]));
export const getDrill = (id: string) => byId.get(id);

export const categoryLabel = (c: Drill['category']) => DRILL_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Plain-text description used when a drill is copied into the coach's own training. */
export function drillToText(d: Drill): string {
  const lines = [
    d.objective,
    '',
    `Organização: ${d.setup}`,
    `Espaço: ${d.space} · Jogadores: ${d.players.min}–${d.players.max}`,
    `Material: ${d.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}`,
    '',
    'Como jogar:',
    ...d.howTo.map((s) => `• ${s}`),
    '',
    'Pontos-chave:',
    ...d.coachingPoints.map((s) => `• ${s}`),
  ];
  if (d.progressions?.length) lines.push('', 'Progressões:', ...d.progressions.map((s) => `• ${s}`));
  return lines.join('\n');
}

/** Exercises in the shape used by coach_trainings.exercises */
export function drillsToExercises(items: { drill: Drill & { anim?: unknown }; minutes: number; note?: string }[]) {
  return items.map(({ drill, minutes, note }, i) => ({
    id: `${Date.now()}-${i}`,
    name: drill.name,
    duration: minutes,
    description: (note ? `Nota: ${note}\n\n` : '') + drillToText(drill),
    // drawing (and animation) shown in the training plan
    diagram: drill.diagram,
    anim: drill.anim ?? null,
  }));
}

export function sessionDrills(plan: SessionPlan) {
  return plan.blocks
    .map((b) => ({ drill: byId.get(b.drillId)!, minutes: b.minutes, note: b.note }))
    .filter((b) => !!b.drill);
}
