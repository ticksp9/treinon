/**
 * Paper attendance: print a sheet for the players to sign, then take a photo of it and the
 * app marks who came. The coach always sees (and can fix) the result before it is saved.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, FileDown, Loader2, Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { sendNotice } from '@/lib/notice';
import { cn } from '@/lib/utils';
import { useTeamBranding } from '@/hooks/useTeamBranding';
import { imageAsDataUrl } from '@/lib/team-branding';
import { MAX_SHEET_COLUMNS, MAX_SHEET_ROWS, alignSessions, sessionFor, binarize, findMarks, makeSheetCode, photoPixels, project, readSheet, sessionsForSheet, sheetLayout, toGray } from '@/lib/attendance-sheet';
import { buildAttendanceSheetPdf, sheetGeometryFor } from '@/lib/attendance-sheet-pdf';
import { deliverPdf } from '@/lib/native-files';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

interface Player { id: string; name: string; number: number | null; team_id?: string | null }
interface Session { id: string; date: string }
interface Sheet { id: string; team_id: string; code: string; session_ids: string[]; player_ids: string[]; session_map: Record<string, string[]> | null; layout: { version?: 1 | 2; nameW?: number } | null; created_at: string }
export interface GroupTeam { id: string; name: string }

/** "2026/2027" for a training in October 2026 (seasons start in July). */
const seasonOf = (d: Date) => (d.getMonth() >= 6 ? `${d.getFullYear()}/${d.getFullYear() + 1}` : `${d.getFullYear() - 1}/${d.getFullYear()}`);
const short = (d: string) => format(new Date(d), "EEE dd/MM", { locale: pt });

export function AttendanceSheetPanel({ teamId, teamName, players: ownPlayers, sessions, onSaved, trainsWith = [] }: {
  teamId: string; teamName: string; players: Player[]; sessions: Session[]; onSaved: () => void;
  /** teams that train together with this one: one sheet for all, each signature saved in the player's own team */
  trainsWith?: GroupTeam[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [printOpen, setPrintOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [count, setCount] = useState(7);
  const [busy, setBusy] = useState(false);

  // the crest goes on the sheet: read ahead so the PDF opens at once (iPad blocks late pop-ups)
  const { crestUrl } = useTeamBranding(teamId);
  const [crest, setCrest] = useState<{ dataUrl: string; ratio: number } | null>(null);
  useEffect(() => { let on = true; imageAsDataUrl(crestUrl).then((c) => on && setCrest(c)); return () => { on = false; }; }, [crestUrl]);

  const group = useMemo(() => [{ id: teamId, name: teamName }, ...trainsWith.filter((t) => t.id !== teamId)], [teamId, teamName, trainsWith]);
  const { data: groupPlayers = [] } = useQuery({
    queryKey: ['sheet-group-players', group.map((t) => t.id).join(',')],
    enabled: group.length > 1,
    queryFn: async () => ((await supabase.from('players').select('id, name, number, team_id').in('team_id', group.map((t) => t.id)).eq('is_active', true)).data ?? []) as Player[],
  });
  const players = group.length > 1 ? groupPlayers : ownPlayers.map((p) => ({ ...p, team_id: teamId }));
  const roster = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name, 'pt')).slice(0, MAX_SHEET_ROWS), [players]);
  const chosen = useMemo(() => sessionsForSheet(sessions, new Date(`${from}T00:00:00`), count), [sessions, from, count]);

  const { data: sheets = [] } = useQuery({
    queryKey: ['attendance-sheets', teamId],
    enabled: !!teamId,
    queryFn: async () => ((await db.from('attendance_sheets').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(12)).data ?? []) as Sheet[],
  });

  const makeSheet = async (mode: 'print' | 'download') => {
    if (!user || !chosen.length || !roster.length) return;
    setBusy(true);
    const code = makeSheetCode();
    let session_map: Record<string, string[]> | null = null;
    if (group.length > 1) {
      session_map = { [teamId]: chosen.map((s) => s.id) };
      const first = new Date(chosen[0].date), last = new Date(chosen[chosen.length - 1].date);
      const span = [new Date(first.getFullYear(), first.getMonth(), first.getDate()).toISOString(), new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59).toISOString()];
      const { data: base } = await supabase.from('training_sessions').select('id, date, location, duration_minutes, season_id').in('id', chosen.map((s) => s.id));
      for (const t of group.slice(1)) {
        const { data: theirs } = await supabase.from('training_sessions').select('id, date').eq('team_id', t.id).gte('date', span[0]).lte('date', span[1]);
        const aligned = alignSessions(chosen, (theirs ?? []) as Session[]);
        // a training of the other team that was not created yet: same day, same hour
        const missing = chosen.map((c, i) => (aligned[i] ? null : c)).filter((c): c is Session => !!c);
        if (missing.length) {
          const rows = missing.map((c) => { const b = base?.find((x) => x.id === c.id); return { team_id: t.id, owner_id: user.id, date: c.date, location: b?.location ?? null, duration_minutes: b?.duration_minutes ?? null, season_id: b?.season_id ?? null }; });
          const { data: made, error: e2 } = await supabase.from('training_sessions').insert(rows).select('id, date');
          if (e2) { setBusy(false); return toast.error(tx('Não foi possível criar os treinos de {{v0}}: {{v1}}', { v0: t.name, v1: e2.message })); }
          (made ?? []).forEach((m) => { const i = chosen.findIndex((c) => c.date === m.date && !aligned[chosen.indexOf(c)]); if (i >= 0) aligned[i] = m as Session; });
        }
        session_map[t.id] = aligned.map((x) => x?.id ?? '');
      }
    }
    // the geometry of this print is kept with the sheet: the photo is read with it
    const geometry = sheetGeometryFor(roster);
    const { error } = await db.from('attendance_sheets').insert({ team_id: teamId, owner_id: user.id, code, session_ids: chosen.map((s) => s.id), player_ids: roster.map((p) => p.id), session_map, layout: geometry });
    setBusy(false);
    if (error) return toast.error(tx('Não foi possível criar a folha: ') + error.message);
    qc.invalidateQueries({ queryKey: ['attendance-sheets', teamId] });
    const doc = buildAttendanceSheetPdf({
      teamName: group.map((t) => t.name).join(' + '), season: seasonOf(new Date(chosen[0].date)), code, sessions: chosen, crest, geometry,
      players: roster,
    });
    const name = `folha-presencas-${code}.pdf`;
    void deliverPdf(doc, name, { print: mode === 'print', title: tx('Folha de presenças {{v0}}', { v0: code }) });
    setPrintOpen(false);
    toast.success(tx('Folha {{v0}} criada. Depois de assinada, use "Ler folha assinada".', { v0: code }));
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="text-sm font-semibold">{tx('Folha para os jogadores assinarem')}</p>
          <p className="text-xs text-muted-foreground">{tx('Imprima a folha dos próximos treinos. Depois de assinada, tire-lhe uma fotografia e a app marca as presenças.')}</p>
        </div>
        <Button variant="outline" onClick={() => setPrintOpen(true)} disabled={!players.length}><Printer className="mr-1.5 h-4 w-4" />{tx('Imprimir folha')}</Button>
        <Button onClick={() => setReadOpen(true)} disabled={!sheets.length} title={sheets.length ? undefined : tx('Imprima primeiro uma folha')}><Camera className="mr-1.5 h-4 w-4" />{tx('Ler folha assinada')}</Button>
      </CardContent>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tx('Folha de presenças')}</DialogTitle>
            <DialogDescription>{tx('Uma coluna por treino e uma linha por jogador, como a folha do clube.')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="sh-from">{tx('A partir de')}</Label><Input id="sh-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div>
              <Label>{tx('Treinos na folha')}</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: MAX_SHEET_COLUMNS }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            {chosen.length === 0 ? (
              <p className="text-muted-foreground">{tx('Não há treinos marcados a partir desse dia. Crie-os em')}{' '}<strong>{tx('Configurar Treinos')}</strong>.</p>
            ) : (
              <>
                <p className="text-muted-foreground">{chosen.length} {chosen.length === 1 ? 'treino' : 'treinos'} · {roster.length} {tx('jogadores (por ordem alfabética)')}{group.length > 1 ? ` de ${group.map((t) => t.name).join(' e ')}` : ''}</p>
                <div className="flex flex-wrap gap-1">{chosen.map((s) => <span key={s.id} className="rounded border px-1.5 py-0.5 font-mono text-xs">{short(s.date)}</span>)}</div>
                {chosen.length < count && <p className="text-xs text-muted-foreground">{tx('Só há')}{' '}{chosen.length} {tx('treinos marcados. Para mais colunas, crie os treinos em Configurar Treinos.')}</p>}
              </>
            )}
            {players.length > MAX_SHEET_ROWS && <p className="text-xs text-destructive">{tx('A folha leva até')}{' '}{MAX_SHEET_ROWS} {tx('jogadores; ficam de fora os últimos por ordem alfabética.')}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => makeSheet('download')} disabled={busy || !chosen.length}><FileDown className="mr-1.5 h-4 w-4" />PDF</Button>
            <Button onClick={() => makeSheet('print')} disabled={busy || !chosen.length}><Printer className="mr-1.5 h-4 w-4" />{tx('Imprimir')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {readOpen && <ReadSheetDialog sheets={sheets} players={players.length ? players : ownPlayers.map((p) => ({ ...p, team_id: teamId }))} onClose={() => setReadOpen(false)} onSaved={() => { setReadOpen(false); onSaved(); }} teamId={teamId} />}
    </Card>
  );
}

function ReadSheetDialog({ sheets, players, teamId, onClose, onSaved }: { sheets: Sheet[]; players: Player[]; teamId: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? '');
  const sheet = sheets.find((s) => s.id === sheetId) ?? null;
  const [grid, setGrid] = useState<boolean[][] | null>(null);
  const [unsure, setUnsure] = useState<boolean[][] | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // the trainings of the sheet (they may be outside the season shown on the page)
  const { data: sheetSessions = [] } = useQuery({
    queryKey: ['sheet-sessions', sheet?.id],
    enabled: !!sheet,
    queryFn: async () => ((await supabase.from('training_sessions').select('id, date').in('id', sheet!.session_ids)).data ?? []) as Session[],
  });
  const cols = useMemo(() => (sheet ? sheet.session_ids.map((id) => sheetSessions.find((s) => s.id === id) ?? null) : []), [sheet, sheetSessions]);
  const names = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const teamOf = useMemo(() => new Map(players.map((p) => [p.id, p.team_id ?? null])), [players]);
  const now = Date.now();
  const happened = (s: Session | null) => !!s && Date.parse(s.date) <= now;

  useEffect(() => { setGrid(null); setUnsure(null); setProblem(null); if (canvas.current) canvas.current.innerHTML = ''; }, [sheetId]);

  const readPhoto = async (f: File) => {
    if (!sheet) return;
    setReading(true); setProblem(null);
    try {
      const { rgba, w, h, canvas: cv } = await photoPixels(f);
      const bin = binarize(toGray(rgba, w, h), w, h);
      const marks = findMarks(bin, w, h);
      if (!marks.ok) { setProblem(marks.reason); return; }
      const layout = sheetLayout(sheet.player_ids.length, sheet.session_ids.length, sheet.layout ?? { version: 1 });
      const r = readSheet(bin, w, h, marks.marks, layout);
      setGrid(r.signed.map((row) => [...row])); setUnsure(r.unsure);
      // show what was read on the photo itself
      const ctx = cv.getContext('2d')!;
      ctx.lineWidth = Math.max(2, w / 500);
      for (let row = 0; row < layout.rows; row++) for (let c = 0; c < layout.cols; c++) {
        const cell = layout.cell(row, c);
        const pts = [[cell.x, cell.y], [cell.x + cell.w, cell.y], [cell.x + cell.w, cell.y + cell.h], [cell.x, cell.y + cell.h]].map(([x, y]) => project(r.H, x, y));
        ctx.strokeStyle = r.signed[row][c] ? 'rgba(22,163,74,0.9)' : 'rgba(220,38,38,0.5)';
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      }
      cv.className = 'w-full rounded-md border';
      if (canvas.current) { canvas.current.innerHTML = ''; canvas.current.appendChild(cv); }
    } catch (e) {
      setProblem('Não foi possível ler a fotografia: ' + (e as Error).message);
    } finally { setReading(false); if (file.current) file.current.value = ''; }
  };

  const toggle = (r: number, c: number) => setGrid((g) => g && g.map((row, i) => (i === r ? row.map((v, j) => (j === c ? !v : v)) : row)));

  const save = async () => {
    if (!sheet || !grid || !user) return;
    const rows: { session_id: string; player_id: string; present: boolean; owner_id: string; recorded_at: string; recorded_by: string }[] = [];
    sheet.player_ids.forEach((pid, r) => {
      if (!names.has(pid)) return;
      cols.forEach((s, c) => {
        const sid = sessionFor(sheet, teamOf.get(pid), c);
        if (s && sid && happened(s)) rows.push({ session_id: sid, player_id: pid, present: !!grid[r]?.[c], owner_id: user.id, recorded_at: new Date().toISOString(), recorded_by: user.id });
      });
    });
    if (!rows.length) return toast.info(tx('Nenhum dos treinos desta folha já aconteceu.'));
    setSaving(true);
    const { error } = await db.from('training_attendance').upsert(rows, { onConflict: 'session_id,player_id' });
    setSaving(false);
    if (error) return toast.error(tx('Não foi possível guardar: ') + error.message);
    toast.success(tx('Presenças guardadas: {{v0}} presenças em {{v1}} treinos.', { v0: rows.filter((x) => x.present).length, v1: new Set(rows.map((x) => x.session_id)).size }));
    sendNotice({ kind: 'absence_alert', team_id: teamId }).catch(() => {});
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx('Ler folha assinada')}</DialogTitle>
          <DialogDescription>{tx('Fotografe a folha inteira, de frente, com os quatro quadrados pretos à vista. Confira o resultado antes de guardar.')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Label>{tx('Folha')}</Label>
            <Select value={sheetId} onValueChange={setSheetId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sheets.map((s) => <SelectItem key={s.id} value={s.id}>{tx('Folha')}{' '}{s.code} {tx('· criada')}{' '}{format(new Date(s.created_at), 'dd/MM')} · {s.session_ids.length} treinos</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])} />
          <Button onClick={() => file.current?.click()} disabled={reading || !sheet}>{reading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}{grid ? tx('Outra fotografia') : tx('Fotografar / escolher fotografia')}</Button>
        </div>
        {problem && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm">{problem}</p>}

        {grid && sheet && (
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground">{tx('Jogador')}</th>
                    {cols.map((s, c) => <th key={c} className="p-1 text-center font-mono text-[11px] font-semibold">{s ? short(s.date) : '—'}{s && !happened(s) && <span className="block font-sans text-[10px] font-normal text-muted-foreground">{tx('ainda não')}</span>}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sheet.player_ids.map((pid, r) => (
                    <tr key={pid} className="border-t">
                      <td className="p-1">{names.get(pid) ?? <span className="text-muted-foreground">{tx('(já não está na equipa)')}</span>}</td>
                      {cols.map((s, c) => {
                        const on = !!grid[r]?.[c], doubt = !!unsure?.[r]?.[c];
                        const off = !s || !happened(s) || !names.has(pid);
                        return (
                          <td key={c} className="p-0.5 text-center">
                            <button type="button" disabled={off} onClick={() => toggle(r, c)} aria-pressed={on}
                              aria-label={`${names.get(pid) ?? 'Jogador'}, ${s ? short(s.date) : ''}: ${on ? 'presente' : 'faltou'}`}
                              className={cn('inline-flex h-8 w-9 items-center justify-center rounded border', off ? 'opacity-30' : on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-input', doubt && !off && 'ring-2 ring-accent')}>
                              {on ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">{tx('Verde = assinou. Contorno laranja = a leitura teve dúvidas: confirme esses. Toque num quadrado para corrigir. Os treinos que ainda não aconteceram não são gravados.')}</p>
            </div>
            <div ref={canvas} className="space-y-1" aria-label={tx('Fotografia com os quadrados lidos')} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={!grid || saving}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{tx('Guardar presenças')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
