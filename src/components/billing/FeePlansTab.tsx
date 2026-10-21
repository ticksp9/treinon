import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeePlans, useCreateFeePlan, useUpdateFeePlan } from '@/hooks/useBilling';
import { Plus, Edit, Settings2 } from 'lucide-react';
import { getCurrentSeasonName } from '@/lib/constants';
import { tx, intlLocale } from '@/lib/i18n/ui';

interface Props { clubId: string; }

const PLAN_TYPES = [
  { value: 'monthly_fee', get label() { return tx('Mensalidade'); } },
  { value: 'membership_quota', get label() { return tx('Quota Sócio'); } },
  { value: 'registration', get label() { return tx('Inscrição'); } },
  { value: 'insurance', get label() { return tx('Seguro'); } },
  { value: 'annual_fee', get label() { return tx('Taxa Anual'); } },
  { value: 'extra', get label() { return tx('Extra'); } },
];
const FREQUENCIES = [
  { value: 'monthly', get label() { return tx('Mensal'); } },
  { value: 'quarterly', get label() { return tx('Trimestral'); } },
  { value: 'annual', get label() { return tx('Anual'); } },
  { value: 'one_time', get label() { return tx('Única'); } },
];

export function FeePlansTab({ clubId }: Props) {
  const { data: plans, isLoading } = useFeePlans(clubId);
  const createPlan = useCreateFeePlan(clubId);
  const updatePlan = useUpdateFeePlan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', plan_type: 'monthly_fee', amount: '', billing_frequency: 'monthly',
    due_day: '8', season: getCurrentSeasonName(), applies_to_scope: 'club', is_mandatory: true, auto_generate: true, send_alerts: true,
  });

  const handleCreate = () => {
    createPlan.mutate({
      name: form.name, description: form.description, plan_type: form.plan_type,
      amount: parseFloat(form.amount) || 0, billing_frequency: form.billing_frequency,
      due_day: parseInt(form.due_day) || 8, season: form.season, applies_to_scope: form.applies_to_scope,
      is_mandatory: form.is_mandatory, auto_generate: form.auto_generate, send_alerts: form.send_alerts,
    }, { onSuccess: () => { setOpen(false); setForm({ name: '', description: '', plan_type: 'monthly_fee', amount: '', billing_frequency: 'monthly', due_day: '8', season: getCurrentSeasonName(), applies_to_scope: 'club', is_mandatory: true, auto_generate: true, send_alerts: true }); } });
  };

  const toggleActive = (plan: any) => {
    updatePlan.mutate({ id: plan.id, is_active: !plan.is_active });
  };

  if (isLoading) return <Skeleton className="h-64" />;

  const fmt = (v: number) => new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h3 className="font-semibold">{tx('Planos de Cobrança')}</h3><p className="text-sm text-muted-foreground">{tx('Configure mensalidades, quotas e taxas')}</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> {tx('Novo Plano')}</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{tx('Criar Plano de Cobrança')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>{tx('Nome')}</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder={tx('Ex: Mensalidade Sub-13')} /></div>
                <div><Label>{tx('Tipo')}</Label><Select value={form.plan_type} onValueChange={v => setForm(f => ({...f, plan_type: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLAN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>{tx('Frequência')}</Label><Select value={form.billing_frequency} onValueChange={v => setForm(f => ({...f, billing_frequency: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FREQUENCIES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>{tx('Valor (€)')}</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} /></div>
                <div><Label>{tx('Dia Vencimento')}</Label><Input type="number" min="1" max="28" value={form.due_day} onChange={e => setForm(f => ({...f, due_day: e.target.value}))} /></div>
                <div><Label>{tx('Época')}</Label><Input value={form.season} onChange={e => setForm(f => ({...f, season: e.target.value}))} /></div>
                <div><Label>{tx('Âmbito')}</Label><Select value={form.applies_to_scope} onValueChange={v => setForm(f => ({...f, applies_to_scope: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="club">{tx('Clube')}</SelectItem><SelectItem value="team">{tx('Equipa')}</SelectItem><SelectItem value="age_group">{tx('Escalão')}</SelectItem><SelectItem value="individual">{tx('Individual')}</SelectItem></SelectContent></Select></div>
              </div>
              <div className="col-span-2"><Label>{tx('Descrição')}</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
              <div className="flex gap-6"><div className="flex items-center gap-2"><Switch checked={form.auto_generate} onCheckedChange={v => setForm(f => ({...f, auto_generate: v}))} /><Label>{tx('Geração automática')}</Label></div><div className="flex items-center gap-2"><Switch checked={form.send_alerts} onCheckedChange={v => setForm(f => ({...f, send_alerts: v}))} /><Label>{tx('Alertas')}</Label></div></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{tx('Cancelar')}</Button><Button onClick={handleCreate} disabled={!form.name || !form.amount || createPlan.isPending}>{tx('Criar')}</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!plans || plans.length === 0) ? (
        <Card><CardContent className="py-12 text-center"><Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">{tx('Nenhum plano criado. Crie o primeiro plano de cobrança.')}</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan: any) => (
            <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{plan.name}</span>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>{plan.is_active ? tx('Ativo') : tx('Inativo')}</Badge>
                    <Badge variant="outline">{PLAN_TYPES.find(t => t.value === plan.plan_type)?.label || plan.plan_type}</Badge>
                    <Badge variant="outline">{FREQUENCIES.find(f => f.value === plan.billing_frequency)?.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description || plan.season || ''} {tx('· Venc. dia')}{' '}{plan.due_day}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{fmt(plan.amount)}</span>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(plan)}>{plan.is_active ? tx('Desativar') : tx('Ativar')}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
