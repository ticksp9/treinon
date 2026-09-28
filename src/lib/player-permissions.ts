// Central permission guards for the Players module.
// Keeps RBAC logic out of JSX. RLS still enforces authoritative rules server-side.

export interface PlayerPermissionContext {
  userId: string | null;
  isClubAdmin: boolean;
  isCoordinator: boolean;
  isCoach: boolean;
  isStaff: boolean;
  isGuardian: boolean;
  isPlayer: boolean;
  /** Team IDs the coach is assigned to (when isCoach). */
  coachedTeamIds?: string[];
  /** Player IDs linked to the guardian (when isGuardian). */
  guardianPlayerIds?: string[];
  /** Player ID linked to the player account (when isPlayer). */
  selfPlayerId?: string | null;
}

export interface PlayerScope {
  id: string;
  team_id?: string | null;
  club_id?: string | null;
}

function inCoachScope(ctx: PlayerPermissionContext, player: PlayerScope): boolean {
  if (!ctx.isCoach || !player.team_id) return false;
  return (ctx.coachedTeamIds || []).includes(player.team_id);
}

function isGuardianOf(ctx: PlayerPermissionContext, player: PlayerScope): boolean {
  if (!ctx.isGuardian) return false;
  return (ctx.guardianPlayerIds || []).includes(player.id);
}

function isSelf(ctx: PlayerPermissionContext, player: PlayerScope): boolean {
  return !!(ctx.isPlayer && ctx.selfPlayerId && ctx.selfPlayerId === player.id);
}

/** Read access to the player profile. */
export function canViewPlayerProfile(ctx: PlayerPermissionContext, player: PlayerScope): boolean {
  if (!ctx.userId) return false;
  if (ctx.isClubAdmin || ctx.isCoordinator || ctx.isStaff) return true;
  if (inCoachScope(ctx, player)) return true;
  if (isGuardianOf(ctx, player)) return true;
  if (isSelf(ctx, player)) return true;
  return false;
}

/** Edit base profile data (name, position, height...). */
export function canEditPlayerProfile(ctx: PlayerPermissionContext, player: PlayerScope): boolean {
  if (!ctx.userId) return false;
  if (ctx.isClubAdmin || ctx.isCoordinator) return true;
  if (inCoachScope(ctx, player)) return true;
  return false;
}

export function canCreatePlayerEvaluation(
  ctx: PlayerPermissionContext,
  player: PlayerScope,
): boolean {
  if (!ctx.userId) return false;
  if (ctx.isClubAdmin || ctx.isCoordinator) return true;
  if (inCoachScope(ctx, player)) return true;
  return false;
}

export interface EvaluationScope {
  id: string;
  evaluator_id?: string | null;
}

export function canEditPlayerEvaluation(
  ctx: PlayerPermissionContext,
  evaluation: EvaluationScope,
  player: PlayerScope,
): boolean {
  if (!ctx.userId) return false;
  if (ctx.isClubAdmin || ctx.isCoordinator) return true;
  // coach can edit only own evaluations on players in scope
  if (inCoachScope(ctx, player) && evaluation.evaluator_id === ctx.userId) return true;
  return false;
}

export function canManagePlayerDevelopmentPlan(
  ctx: PlayerPermissionContext,
  player: PlayerScope,
): boolean {
  return canCreatePlayerEvaluation(ctx, player);
}

export function canViewPlayerSeasonHistory(
  ctx: PlayerPermissionContext,
  player: PlayerScope,
): boolean {
  return canViewPlayerProfile(ctx, player);
}

/** Sensitive internal notes — hidden from guardians/players. */
export function canViewSensitiveNotes(
  ctx: PlayerPermissionContext,
  player: PlayerScope,
): boolean {
  if (ctx.isGuardian || ctx.isPlayer) return false;
  return canViewPlayerProfile(ctx, player);
}

export function canEditStrengthsFocus(
  ctx: PlayerPermissionContext,
  player: PlayerScope,
): boolean {
  return canCreatePlayerEvaluation(ctx, player);
}
