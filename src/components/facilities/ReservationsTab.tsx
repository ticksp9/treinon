import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending: { label: 'Pendente', variant: 'outline' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
  completed: { label: 'Concluída', variant: 'default' },
  blocked: { label: 'Bloqueio', variant: 'destructive' },
};

const TYPES = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'medical', label: 'Médico' },
  { value: 'maintenance_block', label: 'Manutenção' },
  { value: 'event', label: 'Evento' },
  { value: 'internal_use', label: 'Uso Interno' },
];

interface Props {
  reservations: any[];
  spaces: any[];
  facilities: any[];
  teams: any[];
  onCreateReservation: (d: any) => void;
}

export function ReservationsTab({ reservations, spaces, facilities, teams, onCreateReservation }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ facility_id: '', facility_space_id: '', reservation_type: 'training', starts_at: '', ends_at: '', team_id: '', notes: '' });

  const filteredSpaces = spaces.filter(s => s.facility_id === form.facility_id);

  const handleCreate = () => {
    if (!form.facility_id || !form.facility_space_id || !form.starts_at || !form.ends_at) return;
    onCreateReservation({ ...form, team_id: form.team_id || undefined });
    setOpen(false);
    setForm({ facility_id: '', facility_space_id: '', reservation_type: 'training', starts_at: '', ends_at: '', team_id: '', notes: '' });
  };

  const getSpaceName = (id: string) => spaces.find(s => s.id === id)?.name || id;
  const getTeamName = (id: string | null) => teams.find(t => t.id === id)?.name || '';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Reservas ({reservations.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Reserva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Reserva</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Instalação</Label><Select value={form.facility_id} onValueChange={v => setForm(p => ({ ...p, facility_id: v, facility_space_id: '' }))}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Espaço</Label><Select value={form.facility_space_id} onValueChange={v => setForm(p => ({ ...p, facility_space_id: v }))}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{filteredSpaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Tipo</Label><Select value={form.reservation_type} onValueChange={v => setForm(p => ({ ...p, reservation_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Equipa</Label><Select value={form.team_id} onValueChange={v => setForm(p => ({ ...p, team_id: v }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))} /></div>
              </div>
              <div><Label>Notas</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">Criar Reserva</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {reservations.slice(0, 50).map(r => {
          const st = STATUS_MAP[r.reservation_status] || { label: r.reservation_status, variant: 'outline' as const };
          return (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{getSpaceName(r.facility_space_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.starts_at), "dd MMM HH:mm", { locale: pt })} — {format(new Date(r.ends_at), "HH:mm", { locale: pt })}
                    {r.team_id && ` • ${getTeamName(r.team_id)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{TYPES.find(t => t.value === r.reservation_type)?.label || r.reservation_type}</Badge>
                  <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {reservations.length === 0 && <Card><CardContent className="py-6 text-center text-muted-foreground">Nenhuma reserva registada</CardContent></Card>}
      </div>
    </div>
  );
}
