import { useEffect, useMemo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, ArrowRightLeft, Check, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  type PendingSubstitution,
  type SubstitutionBatchDraft,
  createSubstitutionDraft,
  addPendingSubstitution,
  updatePendingSubstitution,
  removePendingSubstitution,
  validateSubstitutionBatch,
} from '@/lib/substitution-batch-service';
import type { MatchEventForCalc } from '@/lib/match-playing-time';

export interface BatchPlayer {
  id: string;
  player_id: string;
  player: { id: string; name: string; number: number | null; position: string | null };
}

export interface SlotChoice {
  slot_id: string;
  label: string;
  role?: string | null;
}

interface SubstitutionBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  starters: BatchPlayer[];
  substitutes: BatchPlayer[];
  defaultMinute: number;
  /** When true the user can edit the minute (post-game). When false the minute is fixed (live). */
  editableMinute?: boolean;
  maxOnField: number;
  reentryAllowed: boolean;
  events: MatchEventForCalc[];
  sportType?: string | null;
  playerPlayTimes?: Map<string, number>;
  /** Commit handler: receives the validated batch. Should persist atomically. */
  onCommit: (substitutions: PendingSubstitution[], minute: number) => Promise<void> | void;
  title?: string;
  /** Optional pre-filled rows (e.g. when editing an existing substitution pair). */
  initialSubstitutions?: Array<{ playerOutId: string; playerInId: string; slotId?: string }>;
  /** When provided, each row gets a slot destination selector. */
  availableSlots?: SlotChoice[];
  /** Current slot of each on-field player (used to default slot of incoming). */
  currentSlotByPlayerId?: Map<string, { slot_id: string; role?: string | null }>;
}

export function SubstitutionBatchDialog(props: SubstitutionBatchDialogProps) {
  const isMobile = useIsMobile();
  const Container = isMobile ? Sheet : Dialog;
  const Content = isMobile ? SheetContent : DialogContent;
  const Header = isMobile ? SheetHeader : DialogHeader;
  const Title = isMobile ? SheetTitle : DialogTitle;
  const Description = isMobile ? SheetDescription : DialogDescription;
  const Footer = isMobile ? SheetFooter : DialogFooter;

  return (
    <Container open={props.open} onOpenChange={(v) => { if (!v) handleCancel(props); }}>
      <Content
        {...(isMobile ? { side: 'bottom' as const, className: 'max-h-[90vh] overflow-y-auto rounded-t-2xl' } : { className: 'max-w-2xl max-h-[85vh] overflow-y-auto' })}
      >
        <BatchBody {...props} Header={Header} Title={Title} Description={Description} Footer={Footer} />
      </Content>
    </Container>
  );
}

function handleCancel(props: SubstitutionBatchDialogProps) {
  props.onOpenChange(false);
}

interface BodyProps extends SubstitutionBatchDialogProps {
  Header: React.ComponentType<any>;
  Title: React.ComponentType<any>;
  Description: React.ComponentType<any>;
  Footer: React.ComponentType<any>;
}

function BatchBody({
  open,
  onOpenChange,
  matchId,
  starters,
  substitutes,
  defaultMinute,
  editableMinute = false,
  maxOnField,
  reentryAllowed,
  events,
  sportType,
  playerPlayTimes,
  onCommit,
  title = 'Substituições',
  initialSubstitutions,
  availableSlots,
  currentSlotByPlayerId,
  Header, Title, Description, Footer,
}: BodyProps) {
  const [draft, setDraft] = useState<SubstitutionBatchDraft>(() => createSubstitutionDraft(matchId));
  const [minute, setMinute] = useState<number>(defaultMinute);
  const [committing, setCommitting] = useState(false);
  // Snapshot starters when the dialog opens so projection stays stable
  // even if parent state mutates between rows of the same batch.
  const [startersSnapshot, setStartersSnapshot] = useState<BatchPlayer[]>(starters);

  // Reset draft and snapshot each time the dialog opens
  useEffect(() => {
    if (open) {
      let next = createSubstitutionDraft(matchId);
      const seed = initialSubstitutions && initialSubstitutions.length > 0
        ? initialSubstitutions
        : [{ playerOutId: '', playerInId: '' }];
      for (const s of seed) {
        next = addPendingSubstitution(next, { minute: defaultMinute, ...s });
      }
      setDraft(next);
      setMinute(defaultMinute);
      setStartersSnapshot(starters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentOnFieldIds = useMemo(() => startersSnapshot.map(s => s.player_id), [startersSnapshot]);

  const validation = useMemo(() => validateSubstitutionBatch({
    draft,
    currentOnFieldIds,
    events,
    sportType,
    maxOnField,
  }), [draft, currentOnFieldIds, events, sportType, maxOnField]);

  // Compute the projected on-field set _before_ each row, so the
  // selectors only show coherent options as rows are added.
  const projectedBeforeRow = useMemo(() => {
    const list: Set<string>[] = [];
    const proj = new Set(currentOnFieldIds);
    for (const sub of draft.substitutions) {
      list.push(new Set(proj));
      if (sub.playerOutId) proj.delete(sub.playerOutId);
      if (sub.playerInId) proj.add(sub.playerInId);
    }
    return list;
  }, [draft.substitutions, currentOnFieldIds]);

  const allPlayers = useMemo(
    () => [...startersSnapshot, ...substitutes],
    [startersSnapshot, substitutes],
  );

  const findPlayer = (id: string) => allPlayers.find(p => p.player_id === id);

  const handleAddRow = useCallback(() => {
    setDraft(d => addPendingSubstitution(d, { minute, playerOutId: '', playerInId: '' }));
  }, [minute]);

  const handleRemoveRow = useCallback((tempId: string) => {
    setDraft(d => removePendingSubstitution(d, tempId));
  }, []);

  const handleUpdateRow = useCallback((tempId: string, patch: Partial<PendingSubstitution>) => {
    setDraft(d => updatePendingSubstitution(d, tempId, (() => {
      // When the user picks an OUT player and we have slot info,
      // default the destination slot to the outgoing player's current slot.
      if (patch.playerOutId && availableSlots && currentSlotByPlayerId) {
        const cur = currentSlotByPlayerId.get(patch.playerOutId);
        if (cur && !patch.slotId) {
          return { ...patch, slotId: cur.slot_id, role: cur.role ?? undefined };
        }
      }
      return patch;
    })()));
  }, [availableSlots, currentSlotByPlayerId]);

  const handleMinuteChange = useCallback((value: number) => {
    setMinute(value);
    setDraft(d => ({
      ...d,
      substitutions: d.substitutions.map(s => ({ ...s, minute: value })),
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!validation.valid || committing) return;
    setCommitting(true);
    try {
      await onCommit(draft.substitutions, minute);
      onOpenChange(false);
    } finally {
      setCommitting(false);
    }
  }, [validation.valid, committing, onCommit, draft.substitutions, minute, onOpenChange]);

  const handleCancelClick = useCallback(() => {
    setDraft(createSubstitutionDraft(matchId));
    onOpenChange(false);
  }, [matchId, onOpenChange]);

  const issuesByRow = useMemo(() => {
    const map = new Map<string | undefined, string[]>();
    validation.issues.forEach(i => {
      const arr = map.get(i.tempId) ?? [];
      arr.push(i.message);
      map.set(i.tempId, arr);
    });
    return map;
  }, [validation.issues]);

  const globalIssues = issuesByRow.get(undefined) ?? [];

  return (
    <>
      <Header className="pb-2">
        <Title className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> {title}
          </span>
          <Badge variant="outline" className="font-mono">{minute}'</Badge>
        </Title>
        <Description className="flex items-center gap-2 text-xs flex-wrap">
          <span>Em campo: {currentOnFieldIds.length}/{maxOnField}</span>
          <span>•</span>
          <span>Reentrada: {reentryAllowed ? 'Sim' : 'Não'}</span>
          <span>•</span>
          <span>{draft.substitutions.length} linha(s) pendentes</span>
        </Description>
      </Header>

      {editableMinute && (
        <div className="mb-3">
          <Label className="text-xs">Minuto do lote</Label>
          <Input
            type="number"
            min={0}
            value={minute}
            onChange={e => handleMinuteChange(parseInt(e.target.value || '0', 10))}
            className="h-9"
          />
        </div>
      )}

      <div className="space-y-2 mb-3">
        {draft.substitutions.map((row, idx) => {
          const rowIssues = issuesByRow.get(row.tempId) ?? [];
          const onFieldNow = projectedBeforeRow[idx] ?? new Set(currentOnFieldIds);
          const outOptions = allPlayers.filter(p =>
            onFieldNow.has(p.player_id) || p.player_id === row.playerOutId,
          );
          const inOptions = allPlayers.filter(p =>
            !onFieldNow.has(p.player_id) || p.player_id === row.playerInId,
          );
          return (
            <div
              key={row.tempId}
              className={`p-3 rounded-lg border-2 ${rowIssues.length > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-secondary/20'}`}
            >
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="mt-1.5 shrink-0">#{idx + 1}</Badge>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Sai</Label>
                    <Select
                      value={row.playerOutId || undefined}
                      onValueChange={(v) => handleUpdateRow(row.tempId, { playerOutId: v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Quem sai" /></SelectTrigger>
                      <SelectContent>
                        {outOptions.map(p => (
                          <SelectItem key={p.player_id} value={p.player_id}>
                            {p.player.number ? `${p.player.number} - ` : ''}{p.player.name}
                            {playerPlayTimes?.get(p.player_id) ? ` · ${playerPlayTimes.get(p.player_id)}'` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Entra</Label>
                    <Select
                      value={row.playerInId || undefined}
                      onValueChange={(v) => handleUpdateRow(row.tempId, { playerInId: v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Quem entra" /></SelectTrigger>
                      <SelectContent>
                        {inOptions.map(p => (
                          <SelectItem key={p.player_id} value={p.player_id}>
                            {p.player.number ? `${p.player.number} - ` : ''}{p.player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {availableSlots && availableSlots.length > 0 && (
                    <div className="sm:col-span-2">
                      <Label className="text-[10px] uppercase text-muted-foreground">Slot destino</Label>
                      <Select
                        value={row.slotId || undefined}
                        onValueChange={(v) => {
                          const slot = availableSlots.find(s => s.slot_id === v);
                          handleUpdateRow(row.tempId, { slotId: v, role: slot?.role ?? undefined });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="(manter slot do que sai)" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSlots.map(s => (
                            <SelectItem key={s.slot_id} value={s.slot_id}>
                              {s.label}{s.role ? ` · ${s.role}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveRow(row.tempId)}
                  aria-label="Remover linha"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {rowIssues.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>{rowIssues.map((m, i) => <div key={i}>{m}</div>)}</div>
                </div>
              )}
              {row.playerOutId && row.playerInId && rowIssues.length === 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Sai <span className="font-medium text-foreground">{findPlayer(row.playerOutId)?.player.name ?? '—'}</span>
                  {' '}/ Entra <span className="font-medium text-foreground">{findPlayer(row.playerInId)?.player.name ?? '—'}</span>
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddRow}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar outra substituição
        </Button>
      </div>

      {globalIssues.length > 0 && (
        <div className="mb-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>{globalIssues.map((m, i) => <div key={i}>{m}</div>)}</div>
        </div>
      )}

      <Footer className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={handleCancelClick} disabled={committing}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!validation.valid || committing}>
          <Check className="w-4 h-4 mr-1" /> {committing ? 'A confirmar…' : 'OK'}
        </Button>
      </Footer>
    </>
  );
}
