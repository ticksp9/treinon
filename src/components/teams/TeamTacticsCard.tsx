/**
 * "As nossas táticas": where the coach says how the team plays. The formations chosen here
 * come first in every list (match preparation, live match, tactical board) and the default
 * one is how a new match opens. They can be changed at any time during the season.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PenTool, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useTeamTactics } from '@/hooks/useTeamTactics';
import { promptNewFormation, useFormationsVersion } from '@/lib/custom-formations';
import { listAvailableFormations } from '@/lib/tactical-formations';
import { removeTactic, setDefaultTactic, tacticsFor, upsertTactic } from '@/lib/team-tactics';

const NEW = '__new__';
const SPORT_LABELS: Record<string, string> = { football_11: 'Futebol 11', football_9: 'Futebol 9', football_7: 'Futebol 7', football_5: 'Futebol 5', futsal: 'Futsal' };

export function TeamTacticsCard({ teamId, sportType, canEdit = true }: { teamId: string; sportType: string | null | undefined; canEdit?: boolean }) {
  const { user } = useAuth();
  useFormationsVersion();
  const { map, save } = useTeamTactics(teamId);
  const [adding, setAdding] = useState('');
  const sport = sportType || 'football_11';
  const tactics = tacticsFor(map, sport);
  const available = listAvailableFormations(sport).filter((f) => !tactics.list.some((t) => t.code === f.code));

  const add = async (picked: string) => {
    setAdding('');
    const code = picked === NEW
      ? await promptNewFormation(user?.id, sport, (msg, ok) => (ok ? toast.success(msg) : toast.error(msg)))
      : picked;
    if (!code) return;
    if (await save(upsertTactic(map, sport, code))) toast.success(`${code} juntou-se às táticas da equipa.`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><PenTool className="h-4 w-4" />As nossas táticas</CardTitle>
        <CardDescription>
          As formações com que a equipa joga ({SPORT_LABELS[sport] ?? sport}). Aparecem primeiro na preparação e durante o jogo; a que tem a estrela é a que abre num jogo novo.
          Pode mudar em qualquer altura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tactics.list.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Ainda não escolheu nenhuma: os jogos abrem na primeira formação da lista da aplicação. Junte a sua (pode criar uma nova, por exemplo 4-1-2-1).
          </p>
        )}
        <ul className="space-y-2">
          {tactics.list.map((t) => {
            const isDefault = t.code === tactics.default;
            return (
              <li key={t.code} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={!canEdit || isDefault}
                  onClick={() => save(setDefaultTactic(map, sport, t.code))}
                  aria-label={isDefault ? `${t.code} é a tática por defeito` : `Tornar ${t.code} a tática por defeito`} title={isDefault ? 'É a tática com que os jogos abrem' : 'Abrir os jogos com esta tática'}
                >
                  <Star className={isDefault ? 'h-4 w-4 fill-accent text-accent' : 'h-4 w-4 text-muted-foreground'} />
                </Button>
                <span className="font-mono text-sm font-semibold">{t.code}</span>
                {isDefault && <Badge variant="secondary" className="h-5">Por defeito</Badge>}
                <Input
                  className="h-8 min-w-[9rem] flex-1" maxLength={40} disabled={!canEdit} placeholder="Nome (ex.: Principal, A defender)"
                  defaultValue={t.name ?? ''} key={t.code + (t.name ?? '')}
                  onBlur={(e) => { if (e.target.value.trim() !== (t.name ?? '')) save(upsertTactic(map, sport, t.code, e.target.value)); }}
                  aria-label={`Nome da tática ${t.code}`}
                />
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => save(removeTactic(map, sport, t.code))} aria-label={`Tirar ${t.code} das táticas da equipa`} title="Tirar das táticas da equipa">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={adding} onValueChange={add}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Juntar uma formação…" /></SelectTrigger>
              <SelectContent>
                {available.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
                <SelectItem value={NEW} className="font-medium text-primary"><span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Nova formação…</span></SelectItem>
              </SelectContent>
            </Select>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/tactical-board"><PenTool className="mr-1.5 h-4 w-4" />Desenhar as posições no quadro</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
