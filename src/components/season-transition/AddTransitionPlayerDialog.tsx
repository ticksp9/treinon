import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getBirthYear, isPlayerEligibleForAgeGroup, resolveAgeGroupForPlayer, type AgeGroupRule } from '@/lib/age-group-rules';
import { createTransitionPlayer } from '@/lib/season-transition-service';
import { matchTeamForAgeGroup, type ProposalRow, type TeamOption } from '@/lib/season-roster-service';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  ageGroups: AgeGroupRule[];
  referenceDate: string;
  /** Players already present in the transition (never duplicated). */
  existingPlayerIds: string[];
  /** Coach mode: destination age group is fixed. */
  fixedAgeGroupId?: string | null;
  onAdd: (row: ProposalRow) => void;
}

export function AddTransitionPlayerDialog({
  open,
  onOpenChange,
  teams,
  ageGroups,
  referenceDate,
  existingPlayerIds,
  fixedAgeGroupId,
  onAdd,
}: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [playerId, setPlayerId] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [teamId, setTeamId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['transition-add-players'],
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('id, name, birth_date, team_id').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; birth_date: string | null; team_id: string | null }>;
    },
    enabled: open,
  });

  const candidates = useMemo(
    () => allPlayers.filter((p) => !existingPlayerIds.includes(p.id)),
    [allPlayers, existingPlayerIds],
  );

  const selectedExisting = candidates.find((p) => p.id === playerId) ?? null;
  const effectiveBirthDate = mode === 'existing' ? selectedExisting?.birth_date ?? null : birthDate || null;

  // Suggests the correct age group from the birth date.
  useEffect(() => {
    if (fixedAgeGroupId) {
      setAgeGroupId(fixedAgeGroupId);
      return;
    }
    if (!effectiveBirthDate) return;
    const res = resolveAgeGroupForPlayer(effectiveBirthDate, referenceDate, ageGroups);
    if (res.ageGroup) setAgeGroupId(res.ageGroup.id);
  }, [effectiveBirthDate, referenceDate, ageGroups, fixedAgeGroupId]);

  useEffect(() => {
    if (!open) {
      setMode('existing');
      setPlayerId('');
      setName('');
      setBirthDate('');
      setTeamId('');
      setAgeGroupId('');
      setConfirmed(false);
    }
  }, [open]);

  const group = ageGroups.find((g) => g.id === ageGroupId) ?? null;
  const eligibility = isPlayerEligibleForAgeGroup(effectiveBirthDate, group);
  const needsConfirm = group != null && eligibility === false;

  const add = useMutation({
    mutationFn: async (): Promise<ProposalRow> => {
      const resolvedTeamId = teamId || matchTeamForAgeGroup(group, teams) || null;
      if (mode === 'new') {
        if (!resolvedTeamId) throw new Error('Escolhe a equipa para o novo jogador.');
        const created = await createTransitionPlayer({ name, birth_date: birthDate, team_id: resolvedTeamId });
        return buildRow(created.id, created.name, created.birth_date, resolvedTeamId);
      }
      if (!selectedExisting) throw new Error('Escolhe um jogador.');
      return buildRow(selectedExisting.id, selectedExisting.name, selectedExisting.birth_date, resolvedTeamId ?? selectedExisting.team_id);
    },
    onSuccess: (row) => {
      onAdd(row);
      toast.success(`${row.name} adicionado à nova época.`);
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      console.error('[season-transition] adicionar jogador', e);
      toast.error((e as { message?: string })?.message ?? 'Não foi possível adicionar o jogador.');
    },
  });

  function buildRow(id: string, playerName: string, bd: string | null, resolvedTeamId: string | null): ProposalRow {
    return {
      player_id: id,
      name: playerName,
      birth_date: bd,
      birth_year: getBirthYear(bd),
      current_team_id: null,
      current_team_name: null,
      current_age_group_id: null,
      current_status: 'active',
      target_age_group_id: ageGroupId || null,
      target_team_id: resolvedTeamId,
      action: 'stays',
      selected: true,
      manual: true,
      warning: null,
    };
  }

  const canSubmit =
    (mode === 'existing' ? !!playerId : !!name.trim() && !!birthDate) && (!needsConfirm || confirmed) && !add.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Adicionar jogador</DialogTitle>
          <DialogDescription>O jogador fica inscrito na nova época quando aplicares a transição.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')}>
              Da lista
            </Button>
            <Button size="sm" variant={mode === 'new' ? 'default' : 'outline'} onClick={() => setMode('new')}>
              Novo jogador
            </Button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-1">
              <Label>Jogador</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger><SelectValue placeholder="Selecionar jogador" /></SelectTrigger>
                <SelectContent className="max-h-[40vh]">
                  {candidates.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.birth_date ? ` · ${p.birth_date}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data de nascimento</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>
          )}

          {ageGroups.length > 0 && (
            <div className="space-y-1">
              <Label>Escalão</Label>
              <Select value={ageGroupId} onValueChange={setAgeGroupId} disabled={!!fixedAgeGroupId}>
                <SelectTrigger><SelectValue placeholder="Selecionar escalão" /></SelectTrigger>
                <SelectContent>
                  {ageGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Equipa</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Selecionar equipa" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {needsConfirm && (
            <div className="border border-amber-500/40 bg-amber-500/5 rounded p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {name || selectedExisting?.name} não é elegível para {group?.name} ({group?.min_birth_year}–{group?.max_birth_year}).
              </p>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
                Confirmo a inscrição mesmo assim.
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSubmit} onClick={() => add.mutate()}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
