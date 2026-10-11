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
import { backupFileName, describeBackup, formatSize, type AutoCopy, type BackupFile } from '@/lib/backup';

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

  // the copies the server makes on its own every night
  const { data: auto } = useQuery({
    queryKey: ['backup-auto', user?.id],
    enabled: !!user && !loading && !isGuardian && !isPlayer,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('club-backup', { body: { action: 'list' } });
      if (error || !data || (data as { error?: string }).error) return { keep: 14, copies: [] as AutoCopy[] };
      return data as { keep: number; copies: AutoCopy[] };
    },
  });
  const [fetching, setFetching] = useState<string | null>(null);

  if (loading || isGuardian || isPlayer) return null;

  const save = (file: BackupFile, name: string) => {
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  const downloadAuto = async (c: AutoCopy) => {
    setFetching(c.name);
    try {
      const { data, error } = await supabase.functions.invoke('club-backup', { body: { action: 'download', name: c.name } });
      const file = (typeof data === 'string' ? JSON.parse(data) : data) as BackupFile & { error?: string };
      if (error || !file || file.error) throw new Error(file?.error || error?.message || 'sem resposta');
      save(file, backupFileName(file));
      setLast(describeBackup(file));
    } catch (e) {
      toast.error('Não foi possível descarregar a cópia: ' + (e as Error).message);
    } finally {
      setFetching(null);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('club-backup', { body: {} });
      if (error || !data || (data as { error?: string }).error) throw new Error((data as { error?: string })?.error || error?.message || 'sem resposta');
      const file = data as BackupFile;
      save(file, backupFileName(file));
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
          Fazer e descarregar uma cópia agora
        </Button>
        {last && <p className="text-sm font-medium">{last}</p>}

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">Cópias automáticas</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Todas as noites o servidor guarda uma cópia. Ficam as últimas {auto?.keep ?? 14}; pode descarregar qualquer uma.
          </p>
          {!auto ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : auto.copies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há nenhuma: a primeira é feita esta noite.</p>
          ) : (
            <ul className="divide-y text-sm">
              {auto.copies.map((c) => (
                <li key={c.name} className="flex items-center gap-2 py-1.5">
                  <span className="font-medium">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  {c.size != null && <span className="text-xs text-muted-foreground">{formatSize(c.size)}</span>}
                  <Button size="sm" variant="outline" className="ml-auto h-8" disabled={fetching === c.name} onClick={() => downloadAuto(c)}>
                    {fetching === c.name ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Descarregar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {lastLog ? `Última cópia: ${new Date(lastLog.created_at).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' })}.` : 'Ainda não foi feita nenhuma cópia.'}
          {' '}O ficheiro tem dados pessoais de menores e dos encarregados: guarde-o protegido e não o partilhe. Não inclui palavras-passe nem os ficheiros carregados (fotografias e documentos).
        </p>
      </CardContent>
    </Card>
  );
}
