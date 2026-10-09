/**
 * Getting a message out of the app: email (edge function send-notice) and a
 * ready-to-paste WhatsApp text, because parents read those, not a tab in an app.
 */
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface NoticeResult { configured?: boolean; total?: number; sent?: number; failed?: number; skipped?: number; note?: string; error?: string; groups?: Record<string, number>; alerts?: number }
/** who a call-up email goes to; in a club team the coordinator always gets it, whatever is chosen here */
export interface CallupTargets { parents?: boolean; players?: boolean }

export type NoticeRequest =
  | { kind: 'announcement'; announcement_id: string }
  | { kind: 'callup'; match_id: string; player_ids: string[]; message?: string; to?: CallupTargets; /** sending again by hand: the coordinator already got it when it was saved */ resend?: boolean }
  | { kind: 'absence_alert'; team_id: string }
  | { kind: 'event'; event_id: string };

export async function sendNotice(body: NoticeRequest): Promise<NoticeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-notice', { body });
    if (error) return { error: error.message };
    return (data ?? {}) as NoticeResult;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** What to tell the coach after trying to email a notice. */
export function noticeSummary(r: NoticeResult): { level: 'success' | 'info' | 'error'; text: string } {
  if (r.error && !r.sent) return { level: 'error', text: `O email não foi enviado: ${r.error}` };
  if (r.note) return { level: 'info', text: r.note };
  if (r.configured === false) return { level: 'info', text: 'O envio por email ainda não está configurado. Use o botão WhatsApp para partilhar.' };
  if (!r.total) return { level: 'info', text: 'Ninguém com email para avisar: os pais ainda não têm conta nem email na ficha do jogador. Use o botão WhatsApp.' };
  const parts = [`Email enviado a ${r.sent} ${r.sent === 1 ? 'pessoa' : 'pessoas'}`];
  if (r.failed) parts.push(`${r.failed} falharam`);
  if (r.skipped) parts.push(`${r.skipped} ficaram de fora (limite diário)`);
  return { level: r.failed ? 'info' : 'success', text: parts.join(' · ') + '.' };
}

export function toastNotice(r: NoticeResult): void {
  const s = noticeSummary(r);
  toast[s.level](s.text);
}

const GROUP_LABELS: Record<string, string> = { coordenador: 'coordenador', pais: 'pais', jogadores: 'jogadores' };
/** After saving a call-up: who actually received it ("coordenador 1 · pais 12 · jogadores: sem email"). */
export function callupSummary(r: NoticeResult): { level: 'success' | 'info' | 'error'; text: string } | null {
  if (r.error && !r.sent) return { level: 'error', text: `A convocatória não foi enviada por email: ${r.error}` };
  const groups = r.groups ?? {};
  const keys = Object.keys(groups);
  if (keys.length === 0) return null; // nothing was asked for and there is no coordinator: stay quiet
  if (r.configured === false) return { level: 'info', text: 'O envio por email ainda não está configurado.' };
  const parts = keys.map((k) => `${GROUP_LABELS[k] ?? k}: ${groups[k] > 0 ? groups[k] : 'sem email'}`);
  return { level: keys.some((k) => groups[k] === 0) ? 'info' : 'success', text: `Convocatória enviada por email — ${parts.join(' · ')}` };
}

/** Opens WhatsApp with the text written; the coach picks the parents' group. */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const openWhatsApp = (text: string) => { window.open(whatsappUrl(text), '_blank', 'noopener'); };

export function announcementText(a: { title: string; content: string; priority?: string | null }): string {
  return `${a.priority === 'important' ? '❗ ' : ''}*${a.title.trim()}*\n\n${a.content.trim()}`;
}

export function callupText(p: { team?: string; opponent: string; date: string | Date; location?: string | null; players: string[]; message?: string }): string {
  const when = format(new Date(p.date), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt });
  return [
    `*Convocatória${p.team ? ` ${p.team}` : ''} vs ${p.opponent}*`,
    `📅 ${when}`,
    p.location ? `📍 ${p.location}` : null,
    p.message?.trim() ? `\n${p.message.trim()}` : null,
    `\nConvocados (${p.players.length}):`,
    ...p.players.map((n) => `• ${n}`),
  ].filter((x) => x !== null).join('\n');
}
