/**
 * Personal data of a player (address, documents, tax number, the parents' names and contacts).
 * It lives in its own table, readable only by the club's administration, the coordinator of
 * the age group, the family — and by a coach without a club, who is responsible for it.
 * A coach working for a club gets nothing back here; the screens then simply show no
 * personal section.
 */
import { supabase } from '@/integrations/supabase/client';

export const PRIVATE_FIELDS = [
  'address', 'phone', 'email', 'tax_id',
  'id_document_type', 'id_document_number', 'id_document_expiry', 'id_document_url',
  'birth_place', 'nationality',
  'parent_name', 'parent_email', 'parent_phone', 'parent_name_2', 'parent_email_2', 'parent_phone_2',
] as const;
export type PrivateField = (typeof PRIVATE_FIELDS)[number];
export type PlayerPrivate = { player_id: string } & Partial<Record<PrivateField, string | null>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

/** player id → personal data, only for the players this user is allowed to see. */
export async function fetchPlayerPrivate(playerIds: string[]): Promise<Map<string, PlayerPrivate>> {
  const out = new Map<string, PlayerPrivate>();
  for (let i = 0; i < playerIds.length; i += 200) {
    const { data } = await db.from('player_private').select('*').in('player_id', playerIds.slice(i, i + 200));
    for (const row of (data ?? []) as PlayerPrivate[]) out.set(row.player_id, row);
  }
  return out;
}

/** The player row with its personal fields filled in (they are always empty on the row itself). */
export function withPrivate<T extends { id: string }>(player: T, priv: PlayerPrivate | undefined | null): T {
  if (!priv) return player;
  const extra: Record<string, unknown> = {};
  for (const f of PRIVATE_FIELDS) if (priv[f] != null) extra[f] = priv[f];
  return { ...player, ...extra };
}

export async function canSeePlayerPrivate(userId: string, playerId: string): Promise<boolean> {
  const { data } = await db.rpc('can_see_player_private', { _user: userId, _player: playerId });
  return data === true;
}

export interface EmergencyContact { parent_name: string | null; parent_phone: string | null; parent_name_2: string | null; parent_phone_2: string | null }
/** For a coach at a match: the parents' phone of ONE player. Every call is recorded for the club. */
export async function getEmergencyContact(playerId: string): Promise<{ contact: EmergencyContact | null; error?: string }> {
  const { data, error } = await db.rpc('get_emergency_contact', { _player: playerId });
  if (error) return { contact: null, error: error.message };
  return { contact: ((data ?? [])[0] ?? null) as EmergencyContact | null };
}

/** Changing or clearing a personal field (only succeeds for who may see the data). */
export async function updatePlayerPrivate(playerId: string, patch: Partial<Record<PrivateField, string | null>>): Promise<string | null> {
  const { error } = await db.from('player_private').upsert({ player_id: playerId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'player_id' });
  return error ? error.message : null;
}
