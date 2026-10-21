import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tx } from '@/lib/i18n/ui';

interface TransactionsListProps {
  clubId: string;
}

export function TransactionsList({ clubId }: TransactionsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx('Transações')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{tx('Lista de transações em desenvolvimento...')}</p>
      </CardContent>
    </Card>
  );
}
