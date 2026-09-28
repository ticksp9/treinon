import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  inbound: 'Entrada', outbound: 'Saída', transfer: 'Transferência', adjustment: 'Ajuste',
  issue_to_team: 'Emissão Equipa', return_from_team: 'Devolução', consumption: 'Consumo',
  loss: 'Perda', writeoff: 'Abate', count_correction: 'Correção Contagem',
};

interface Props {
  movements: any[];
}

export function MovementsTab({ movements }: Props) {
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Movimentos de Stock ({movements.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead><TableHead>Custo Total</TableHead><TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem movimentos</TableCell></TableRow>
            ) : movements.slice(0, 100).map(m => (
              <TableRow key={m.id}>
                <TableCell className="text-sm">{m.movement_date ? format(new Date(m.movement_date), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell>
                  <Badge variant={['inbound', 'return_from_team'].includes(m.movement_type) ? 'secondary' : ['loss', 'writeoff'].includes(m.movement_type) ? 'destructive' : 'outline'}>
                    {TYPE_LABELS[m.movement_type] || m.movement_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                <TableCell>{fmt(Number(m.total_cost) || 0)}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{m.notes || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
