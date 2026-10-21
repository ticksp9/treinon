import { DRILLS as PT_DRILLS } from './drills';
import { SESSION_PLANS as PT_PLANS, AGE_GUIDES as PT_GUIDES } from './sessions';
import { DRILL_CATEGORIES, EQUIPMENT_LABELS, type AgeGuide, type Drill, type SessionPlan } from './types';
import { tx } from '@/lib/i18n/ui';

export * from './types';

// The library is written in Portuguese; its texts are read in the chosen language when shown
// (getters, so a language change needs no reload). Copies made with {...drill} keep the language of that moment.
function localized<T extends object>(o: T, one: string[], many: string[] = []): T {
  const out = { ...o } as Record<string, unknown>;
  for (const k of one) {
    const pt = (o as Record<string, unknown>)[k];
    if (typeof pt === 'string') Object.defineProperty(out, k, { get: () => tx(pt), enumerable: true, configurable: true });
  }
  for (const k of many) {
    const pt = (o as Record<string, unknown>)[k];
    if (Array.isArray(pt)) Object.defineProperty(out, k, { get: () => pt.map((x: string) => tx(x)), enumerable: true, configurable: true });
  }
  return out as T;
}

export const DRILLS: Drill[] = PT_DRILLS.map((d) => Object.assign(localized(d, ['name', 'objective', 'setup', 'space'], ['howTo', 'coachingPoints', 'progressions']), {
  diagram: d.diagram.map((e) => ('label' in e && e.label ? localized(e, ['label']) : 'text' in e ? localized(e, ['text']) : e)),
}));
export const SESSION_PLANS: SessionPlan[] = PT_PLANS.map((p) => Object.assign(localized(p, ['name', 'theme', 'summary']), {
  blocks: p.blocks.map((b) => (b.note ? localized(b, ['note']) : b)),
}));
export const AGE_GUIDES: AgeGuide[] = PT_GUIDES.map((g) => localized(g, ['format', 'sessionShape'], ['priorities', 'avoid']));

const byId = new Map(DRILLS.map((d) => [d.id, d]));
export const getDrill = (id: string) => byId.get(id);

export const categoryLabel = (c: Drill['category']) => DRILL_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Plain-text description used when a drill is copied into the coach's own training. */
export function drillToText(d: Drill): string {
  const lines = [
    d.objective,
    '',
    `${tx('Organização:')} ${d.setup}`,
    `${tx('Espaço:')} ${d.space} · ${tx('Jogadores:')} ${d.players.min}–${d.players.max}`,
    `${tx('Material:')} ${d.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}`,
    '',
    tx('Como jogar:'),
    ...d.howTo.map((s) => `• ${s}`),
    '',
    tx('Pontos-chave:'),
    ...d.coachingPoints.map((s) => `• ${s}`),
  ];
  if (d.progressions?.length) lines.push('', tx('Progressões:'), ...d.progressions.map((s) => `• ${s}`));
  return lines.join('\n');
}

/** Exercises in the shape used by coach_trainings.exercises */
export function drillsToExercises(items: { drill: Drill & { anim?: unknown }; minutes: number; note?: string }[]) {
  return items.map(({ drill, minutes, note }, i) => ({
    id: `${Date.now()}-${i}`,
    name: drill.name,
    duration: minutes,
    description: (note ? `${tx('Nota:')} ${note}\n\n` : '') + drillToText(drill),
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
