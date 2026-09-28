import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface Props {
  maintenance: any[];
}

export function MaintenanceTab({ maintenance }: Props) {
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const statusLabel: Record<string, string> = {
    scheduled: 'Agendada', in_progress: 'Em Curso', completed: 'Concluída', overdue: 'Em Atraso', cancelled: 'Cancelada',
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Manutenções ({maintenance.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead><TableHead>Data Agendada</TableHead><TableHead>Data Realizada</TableHead>
              <TableHead>Custo</TableHead><TableHead>Próxima</TableHead><TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {maintenance.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem manutenções</TableCell></TableRow>
            ) : maintenance.slice(0, 50).map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.maintenance_type}</TableCell>
                <TableCell className="text-sm">{m.scheduled_date ? format(new Date(m.scheduled_date), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell className="text-sm">{m.performed_date ? format(new Date(m.performed_date), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell>{fmt(Number(m.cost) || 0)}</TableCell>
                <TableCell className="text-sm">{m.next_due_date ? format(new Date(m.next_due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell>
                  <Badge variant={m.status === 'completed' ? 'secondary' : m.status === 'overdue' ? 'destructive' : 'outline'}>
                    {statusLabel[m.status] || m.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
