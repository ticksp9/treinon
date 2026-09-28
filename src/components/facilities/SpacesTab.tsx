import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const FACILITY_TYPES = [
  { value: 'stadium', label: 'Estádio' },
  { value: 'training_center', label: 'Centro de Treino' },
  { value: 'gym', label: 'Ginásio' },
  { value: 'medical_room', label: 'Gabinete Médico' },
  { value: 'office', label: 'Escritório' },
  { value: 'warehouse', label: 'Armazém' },
  { value: 'locker_room', label: 'Balneário' },
  { value: 'leased_space', label: 'Espaço Alugado' },
  { value: 'other', label: 'Outro' },
];

const SPACE_TYPES = [
  { value: 'field', label: 'Campo' },
  { value: 'locker_room', label: 'Balneário' },
  { value: 'medical_room', label: 'Gab. Médico' },
  { value: 'gym_area', label: 'Ginásio' },
  { value: 'meeting_room', label: 'Sala Reunião' },
  { value: 'office', label: 'Escritório' },
  { value: 'storage', label: 'Armazém' },
  { value: 'other', label: 'Outro' },
];

interface Props {
  facilities: any[];
  spaces: any[];
  onCreateFacility: (d: any) => void;
  onCreateSpace: (d: any) => void;
}

export function SpacesTab({ facilities, spaces, onCreateFacility, onCreateSpace }: Props) {
  const [facOpen, setFacOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [facForm, setFacForm] = useState({ name: '', facility_code: '', facility_type: 'training_center', ownership_type: 'owned', address: '' });
  const [spaceForm, setSpaceForm] = useState({ facility_id: '', name: '', space_code: '', space_type: 'field' });

  const handleCreateFacility = () => {
    if (!facForm.name || !facForm.facility_code) return;
    onCreateFacility(facForm);
    setFacOpen(false);
    setFacForm({ name: '', facility_code: '', facility_type: 'training_center', ownership_type: 'owned', address: '' });
  };

  const handleCreateSpace = () => {
    if (!spaceForm.facility_id || !spaceForm.name || !spaceForm.space_code) return;
    onCreateSpace(spaceForm);
    setSpaceOpen(false);
    setSpaceForm({ facility_id: '', name: '', space_code: '', space_type: 'field' });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Dialog open={facOpen} onOpenChange={setFacOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Instalação</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Instalação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={facForm.name} onChange={e => setFacForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Código</Label><Input value={facForm.facility_code} onChange={e => setFacForm(p => ({ ...p, facility_code: e.target.value }))} /></div>
              <div><Label>Tipo</Label><Select value={facForm.facility_type} onValueChange={v => setFacForm(p => ({ ...p, facility_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FACILITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Morada</Label><Input value={facForm.address} onChange={e => setFacForm(p => ({ ...p, address: e.target.value }))} /></div>
              <Button onClick={handleCreateFacility} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={spaceOpen} onOpenChange={setSpaceOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Espaço</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Espaço</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Instalação</Label><Select value={spaceForm.facility_id} onValueChange={v => setSpaceForm(p => ({ ...p, facility_id: v }))}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Nome</Label><Input value={spaceForm.name} onChange={e => setSpaceForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Código</Label><Input value={spaceForm.space_code} onChange={e => setSpaceForm(p => ({ ...p, space_code: e.target.value }))} /></div>
              <div><Label>Tipo</Label><Select value={spaceForm.space_type} onValueChange={v => setSpaceForm(p => ({ ...p, space_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SPACE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <Button onClick={handleCreateSpace} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {facilities.map(fac => (
        <Card key={fac.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{fac.name}</span>
              <Badge variant="outline">{FACILITY_TYPES.find(t => t.value === fac.facility_type)?.label || fac.facility_type}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{fac.facility_code} • {fac.address || 'Sem morada'}</p>
          </CardHeader>
          <CardContent>
            {spaces.filter(s => s.facility_id === fac.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem espaços registados</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {spaces.filter(s => s.facility_id === fac.id).map(s => (
                  <div key={s.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.name}</span>
                      <Badge variant={s.active ? 'default' : 'secondary'} className="text-xs">{s.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{SPACE_TYPES.find(t => t.value === s.space_type)?.label || s.space_type} • {s.space_code}</p>
                    {s.floodlights && <Badge variant="outline" className="text-xs mt-1">Iluminação</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {facilities.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma instalação registada</CardContent></Card>}
    </div>
  );
}
