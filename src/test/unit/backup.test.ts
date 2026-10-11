import { describe, it, expect } from 'vitest';
import { backupFileName, backupRowCount, describeBackup, formatSize, isBackupFile, type BackupFile } from '@/lib/backup';

const file: BackupFile = {
  format: 'treinon-backup', version: 1, created_at: '2026-10-11T09:30:00+00:00',
  scope: { kind: 'club', club_id: 'c1', name: 'G.D. São João' },
  users: [{ id: 'u1', email: 'a@b.pt' }],
  tables: { teams: [{}, {}], players: Array(29).fill({}), matches: [{}], match_lineups: Array(17).fill({}) },
};

describe('backup file', () => {
  it('is named after the club and the day, with no accents or spaces', () => {
    expect(backupFileName(file)).toBe('treinon-backup-g-d-sao-joao-2026-10-11.json');
    expect(backupFileName({ scope: { kind: 'coach', owner_id: 'u' }, created_at: '2026-10-11T09:30:00Z' })).toBe('treinon-backup-treinador-2026-10-11.json');
  });

  it('says in one line what is inside', () => {
    expect(backupRowCount(file)).toBe(49);
    expect(describeBackup(file)).toBe('Cópia com 2 equipas · 29 jogadores · 1 jogo (49 registos em 4 tabelas).');
  });

  it('recognises a TreinON backup and nothing else', () => {
    expect(isBackupFile(file)).toBe(true);
    expect(isBackupFile({ format: 'outra-coisa', tables: {} })).toBe(false);
    expect(isBackupFile(null)).toBe(false);
  });

  it('shows the size of a stored copy in words a coach reads', () => {
    expect(formatSize(900)).toBe('900 B');
    expect(formatSize(136_965)).toBe('134 KB');
    expect(formatSize(12_400_000)).toBe('11,8 MB');
  });
});
