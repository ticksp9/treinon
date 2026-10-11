/** The backup file produced by the `club-backup` function (see docs/BACKUP-E-MIGRACAO.md). */
export interface BackupFile {
  format: 'treinon-backup';
  version: number;
  created_at: string;
  scope: { kind: 'club' | 'coach'; club_id?: string; owner_id?: string; name?: string | null };
  migrations?: number | null;
  last_migration?: string | null;
  users: { id: string; email: string | null }[];
  tables: Record<string, unknown[]>;
  source?: string;
}

export const isBackupFile = (x: unknown): x is BackupFile =>
  !!x && typeof x === 'object' && (x as { format?: unknown }).format === 'treinon-backup' && typeof (x as { tables?: unknown }).tables === 'object';

export const backupRowCount = (b: Pick<BackupFile, 'tables'>) => Object.values(b.tables).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);

/** treinon-backup-gd-exemplo-2026-10-11.json */
export function backupFileName(b: Pick<BackupFile, 'scope' | 'created_at'>): string {
  const who = (b.scope.kind === 'club' ? b.scope.name || 'clube' : 'treinador')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dados';
  return `treinon-backup-${who}-${String(b.created_at).slice(0, 10)}.json`;
}

const count = (b: Pick<BackupFile, 'tables'>, t: string) => (Array.isArray(b.tables[t]) ? b.tables[t].length : 0);

/** One line the coach can check at a glance: "2 equipas · 29 jogadores · 6 jogos · 41 treinos". */
export function describeBackup(b: BackupFile): string {
  const parts: [number, string, string][] = [
    [count(b, 'teams'), 'equipa', 'equipas'],
    [count(b, 'players'), 'jogador', 'jogadores'],
    [count(b, 'matches'), 'jogo', 'jogos'],
    [count(b, 'training_sessions'), 'treino', 'treinos'],
  ];
  const text = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(' · ');
  return `Cópia com ${text || 'os seus dados'} (${backupRowCount(b)} registos em ${Object.keys(b.tables).length} tabelas).`;
}
