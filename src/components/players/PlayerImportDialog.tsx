/**
 * Import players from the club's Excel/CSV, so nobody types them by hand.
 *  1. file → the header is found automatically (title rows are skipped); columns can be corrected
 *  2. check → who is new and who already exists
 *  3. destination → one team, or by birth year (e.g. 2013+2014 → Sub-13; saved on the team)
 */
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  detectHeader, extractPlayers, isDuplicate, parseCsv, teamsForYear, IMPORT_FIELDS,
  type FieldKey, type ImportRow, type Mapping, type Rows, type YearTeam,
} from '@/lib/player-import';
import { BirthYearRules } from './BirthYearRules';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  teams: YearTeam[];
  seasonId: string | null;
  seasonStartYear: number;
}

type Step = 'file' | 'check' | 'dest' | 'done';
const NONE = '__none__';

async function readFile(file: File): Promise<Rows> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  const { readSheet } = await import('read-excel-file/browser');
  return (await readSheet(file)) as unknown as Rows;
}

export function PlayerImportDialog({ open, onClose, teams: teamsIn, seasonId, seasonStartYear }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('file');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Rows>([]);
  const [headerIndex, setHeaderIndex] = useState(-1);
  const [mapping, setMapping] = useState<Mapping>({});
  const [existing, setExisting] = useState<{ name: string; birth_date: string | null }[]>([]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<'team' | 'years'>('team');
  const [teamId, setTeamId] = useState(teamsIn[0]?.id ?? '');
  const [fallbackTeam, setFallbackTeam] = useState(teamsIn[0]?.id ?? '');
  const [teams, setTeams] = useState<YearTeam[]>(teamsIn);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number; perTeam: Record<string, number> } | null>(null);

  const players = useMemo(() => (rows.length ? extractPlayers(rows, headerIndex, mapping) : []), [rows, headerIndex, mapping]);
  const dup = useMemo(() => new Set(players.filter((p) => isDuplicate(p, existing)).map((p) => p.line)), [players, existing]);
  const toImport = players.filter((p) => !dup.has(p.line) && !skip.has(p.line));
  const headers = headerIndex >= 0 ? rows[headerIndex] : (rows[0] ?? []).map((_, i) => `Coluna ${i + 1}`);
  const withYear = toImport.filter((p) => p.birth_year).length;

  const reset = () => { setStep('file'); setRows([]); setResult(null); setSkip(new Set()); setFileName(''); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await readFile(file);
      if (!r.length) throw new Error('O ficheiro está vazio.');
      const d = detectHeader(r);
      setRows(r); setHeaderIndex(d.headerIndex); setMapping(d.mapping); setFileName(file.name);
      const { data } = await supabase.from('players').select('name, birth_date');
      setExisting((data ?? []) as { name: string; birth_date: string | null }[]);
      setStep('check');
    } catch (e) {
      toast.error('Não consegui ler o ficheiro: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  const destinationsOf = (p: ImportRow): string[] => {
    if (mode === 'team') return teamId ? [teamId] : [];
    const byYear = teamsForYear(p.birth_year, teams);
    return byYear.length ? byYear : fallbackTeam ? [fallbackTeam] : [];
  };

  const runImport = async () => {
    if (!user) return;
    if (mode === 'team' && !teamId) return toast.error('Escolha a equipa.');
    const plan = toImport.map((p) => ({ p, dest: destinationsOf(p) }));
    const missing = plan.filter((x) => x.dest.length === 0).length;
    if (missing) return toast.error(`${missing} jogador(es) sem equipa: escolha a equipa para quem não tem ano.`);
    setBusy(true);
    const perTeam: Record<string, number> = {};
    let created = 0;
    try {
      // the season roster lives in enrollments: make sure each team belongs to the season
      if (seasonId) {
        const teamIds = [...new Set(plan.flatMap((x) => x.dest))];
        for (const t of teamIds) {
          await supabase.from('season_team_memberships' as never).upsert({ season_id: seasonId, team_id: t } as never, { onConflict: 'season_id,team_id' });
        }
      }
      for (let i = 0; i < plan.length; i += 50) {
        const chunk = plan.slice(i, i + 50);
        setProgress(`A importar ${Math.min(i + 50, plan.length)} de ${plan.length}…`);
        const { data, error } = await supabase.from('players').insert(chunk.map(({ p, dest }) => ({
          owner_id: user.id, team_id: dest[0], name: p.name, birth_date: p.birth_date, number: p.number,
          position: p.position, foot: p.foot, gender: p.gender ?? 'male', phone: p.phone, email: p.email,
          parent_name: p.parent_name, parent_phone: p.parent_phone, parent_email: p.parent_email,
          federation_id: p.federation_id, nationality: p.nationality,
          notes: p.birth_year_only ? 'Data de nascimento importada só com o ano.' : null,
        })) as never).select('id');
        if (error) throw error;
        const ids = (data ?? []) as { id: string }[];
        created += ids.length;
        if (seasonId) {
          const enroll = ids.flatMap((row, k) => chunk[k].dest.map((t) => ({ season_id: seasonId, player_id: row.id, team_id: t, status: 'active', joined_at: new Date().toISOString().slice(0, 10) })));
          const { error: eErr } = await supabase.from('season_player_enrollments' as never).insert(enroll as never);
          if (eErr) throw eErr;
        }
        chunk.forEach(({ dest }) => dest.forEach((t) => { perTeam[t] = (perTeam[t] ?? 0) + 1; }));
      }
      setResult({ created, skipped: players.length - toImport.length, perTeam });
      setStep('done');
      qc.invalidateQueries({ queryKey: ['players'] });
      qc.invalidateQueries({ queryKey: ['season-enrollments'] });
      qc.invalidateQueries({ queryKey: ['team-players'] });
      qc.invalidateQueries({ queryKey: ['season-enrollment-counts'] });
    } catch (e) {
      toast.error(`Parou ao fim de ${created} jogadores: ${(e as Error).message}`);
      if (created) setResult({ created, skipped: 0, perTeam });
    } finally { setBusy(false); setProgress(''); }
  };

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '—';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Importar jogadores do Excel</DialogTitle>
          <DialogDescription>
            {step === 'file' && 'Escolha o ficheiro (.xlsx ou .csv). Basta uma coluna com o nome; data de nascimento, número, posição, pé e contactos do encarregado são lidos se existirem.'}
            {step === 'check' && `${fileName}: ${players.length} jogadores encontrados.`}
            {step === 'dest' && 'Para onde vão os jogadores?'}
            {step === 'done' && 'Importação concluída.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'file' && (
          <label className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center hover:border-primary', busy && 'opacity-60')}>
            {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
            <span className="font-medium">Escolher ficheiro</span>
            <span className="text-xs text-muted-foreground">Excel (.xlsx) ou CSV. Linhas de título no topo não fazem mal.</span>
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}

        {step === 'check' && (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Colunas {headerIndex >= 0 ? `(cabeçalho na linha ${headerIndex + 1})` : '(sem cabeçalho: lista de nomes)'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {IMPORT_FIELDS.filter((f) => mapping[f.key] !== undefined || ['name', 'birth_date', 'number', 'position'].includes(f.key)).map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{f.label}</span>
                    <Select value={mapping[f.key] !== undefined ? String(mapping[f.key]) : NONE}
                      onValueChange={(v) => setMapping((m) => { const n = { ...m }; if (v === NONE) delete n[f.key as FieldKey]; else n[f.key as FieldKey] = Number(v); return n; })}>
                      <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— não tem —</SelectItem>
                        {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h instanceof Date ? h.toLocaleDateString('pt-PT') : String(h ?? `Coluna ${i + 1}`) || `Coluna ${i + 1}`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                ))}
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 py-1.5" />
                    <th className="py-1.5 text-left font-medium">Nome</th>
                    <th className="py-1.5 font-medium">Nascimento</th>
                    <th className="py-1.5 font-medium">Nº</th>
                    <th className="py-1.5 font-medium">Pos</th>
                    <th className="py-1.5 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const isDup = dup.has(p.line);
                    return (
                      <tr key={p.line} className={cn('border-b last:border-0', (isDup || skip.has(p.line)) && 'text-muted-foreground')}>
                        <td className="py-1 text-center">
                          <Checkbox checked={!isDup && !skip.has(p.line)} disabled={isDup}
                            onCheckedChange={(v) => setSkip((s) => { const n = new Set(s); if (v) n.delete(p.line); else n.add(p.line); return n; })} />
                        </td>
                        <td className="py-1">{p.name}</td>
                        <td className="py-1 text-center font-mono text-xs">{p.birth_date ? (p.birth_year_only ? p.birth_year : p.birth_date.split('-').reverse().join('/')) : '—'}</td>
                        <td className="py-1 text-center font-mono text-xs">{p.number ?? '—'}</td>
                        <td className="py-1 text-center text-xs">{p.position ?? '—'}</td>
                        <td className="py-1 text-xs">{isDup ? 'Já existe' : skip.has(p.line) ? 'Não importar' : 'Novo'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={reset}>Outro ficheiro</Button>
              <Button onClick={() => setStep('dest')} disabled={toImport.length === 0}>Continuar ({toImport.length} novos)</Button>
            </div>
          </div>
        )}

        {step === 'dest' && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setMode('team')} className={cn('rounded-md border p-3 text-left text-sm', mode === 'team' && 'border-primary bg-primary/5')}>
                <b>Todos para uma equipa</b>
                <span className="block text-xs text-muted-foreground">Ex.: a lista de nomes de uma equipa.</span>
              </button>
              <button type="button" onClick={() => setMode('years')} className={cn('rounded-md border p-3 text-left text-sm', mode === 'years' && 'border-primary bg-primary/5')}>
                <b>Por ano de nascimento</b>
                <span className="block text-xs text-muted-foreground">{withYear} de {toImport.length} têm ano. Ex.: 2013 e 2014 → Sub-13.</span>
              </button>
            </div>

            {mode === 'team' ? (
              <div className="flex items-center gap-3 text-sm">
                <span>Equipa</span>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <BirthYearRules teams={teams} seasonStartYear={seasonStartYear} onChange={setTeams} />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Sem ano ou ano sem equipa →</span>
                  <Select value={fallbackTeam} onValueChange={setFallbackTeam}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {teams.map((t) => {
                    const n = toImport.filter((p) => destinationsOf(p).includes(t.id)).length;
                    return n ? <span key={t.id} className="rounded bg-muted px-2 py-1">{t.name}: <b>{n}</b></span> : null;
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setStep('check')}>Voltar</Button>
              <Button onClick={runImport} disabled={busy}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress || 'A importar…'}</> : `Importar ${toImport.length} jogadores`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-green-600" /><b>{result.created}</b> jogadores importados{result.skipped ? `, ${result.skipped} ignorados (já existiam ou desmarcados)` : ''}.</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(result.perTeam).map(([t, n]) => <span key={t} className="rounded bg-muted px-2 py-1">{teamName(t)}: <b>{n}</b></span>)}
            </div>
            <p className="text-xs text-muted-foreground">Pode completar os dados de cada jogador na sua ficha (data de nascimento, posição, encarregado…).</p>
            <div className="flex justify-end"><Button onClick={close}>Fechar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
