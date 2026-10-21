import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContractorFeeBatch, PersonRegistry } from '@/hooks/useWorkforce';
import { tx, intlLocale } from '@/lib/i18n/ui';

const STATUS_MAP: Record<string, string> = {
  draft: 'Rascunho', get under_review() { return tx('Em Revisão'); }, approved: 'Aprovado', paid: 'Pago', closed: 'Fechado',
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
        <CardTitle>{tx('Lotes de Honorários')}</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{tx('Sem lotes de honorários registados.')}</p>
            <p className="text-sm mt-1">{tx('Crie um lote para lançar honorários de prestadores.')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx('Nome do Lote')}</TableHead>
                <TableHead>{tx('Período')}</TableHead>
                <TableHead>{tx('Estado')}</TableHead>
                <TableHead>{tx('Criado em')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batch_name}</TableCell>
                  <TableCell>{b.period_reference || '—'}</TableCell>
                  <TableCell><Badge variant={b.status === 'paid' ? 'default' : 'secondary'}>{STATUS_MAP[b.status] || b.status}</Badge></TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleDateString(intlLocale())}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
