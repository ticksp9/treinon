/**
 * "Cópia de segurança": the club (or the coach without a club) downloads everything that is
 * theirs as one file. The same file loads into another TreinON database — their own Supabase
 * project or a server of the club — so the data is never tied to where it is today.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { backupFileName, describeBackup, type BackupFile } from '@/lib/backup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

export function BackupCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isGuardian, isPlayer, isClubAdmin, loading } = useUserRole();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const { data: lastLog } = useQuery({
    queryKey: ['backup-log', user?.id],
    enabled: !!user && !loading && !isGuardian && !isPlayer,
    queryFn: async () => {
      const { data } = await db.from('backup_log').select('created_at, scope, row_count').order('created_at', { ascending: false }).limit(1);
      return ((data ?? [])[0] ?? null) as { created_at: string; scope: string; row_count: number } | null;
    },
  });

  if (loading || isGuardian || isPlayer) return null;

  const download = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('club-backup', { body: {} });
      if (error || !data || (data as { error?: string }).error) throw new Error((data as { error?: string })?.error || error?.message || 'sem resposta');
      const file = data as BackupFile;
      const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = backupFileName(file);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setLast(describeBackup(file));
      toast.success('Cópia de segurança descarregada. Guarde o ficheiro num sítio seguro.');
      qc.invalidateQueries({ queryKey: ['backup-log'] });
    } catch (e) {
      toast.error('Não foi possível fazer a cópia: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base"><DatabaseBackup className="h-4 w-4" />Cópia de segurança</CardTitle>
        <CardDescription>
          Descarrega um ficheiro com {isClubAdmin ? 'tudo o que é do clube' : 'tudo o que é seu'}: equipas, jogadores, jogos, treinos, presenças, avaliações, comunicação e eventos.
          O mesmo ficheiro serve para repor os dados ou para os levar para outra base de dados (do clube ou num servidor próprio).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Descarregar cópia de segurança
        </Button>
        {last && <p className="text-sm font-medium">{last}</p>}
        <p className="text-xs text-muted-foreground">
          {lastLog ? `Última cópia: ${new Date(lastLog.created_at).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' })}.` : 'Ainda não foi feita nenhuma cópia.'}
          {' '}O ficheiro tem dados pessoais de menores e dos encarregados: guarde-o protegido e não o partilhe. Não inclui palavras-passe nem os ficheiros carregados (fotografias e documentos).
        </p>
      </CardContent>
    </Card>
  );
}
