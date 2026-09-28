import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContractorFeeBatch, PersonRegistry } from '@/hooks/useWorkforce';

const STATUS_MAP: Record<string, string> = {
  draft: 'Rascunho', under_review: 'Em Revisão', approved: 'Aprovado', paid: 'Pago', closed: 'Fechado',
};

interface Props {
  batches: ContractorFeeBatch[];
  people: PersonRegistry[];
  isLoading: boolean;
}

export function FeesTab({ batches, people, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lotes de Honorários</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Sem lotes de honorários registados.</p>
            <p className="text-sm mt-1">Crie um lote para lançar honorários de prestadores.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Lote</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batch_name}</TableCell>
                  <TableCell>{b.period_reference || '—'}</TableCell>
                  <TableCell><Badge variant={b.status === 'paid' ? 'default' : 'secondary'}>{STATUS_MAP[b.status] || b.status}</Badge></TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleDateString('pt-PT')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
