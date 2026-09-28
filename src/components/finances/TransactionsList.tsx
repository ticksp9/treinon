import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TransactionsListProps {
  clubId: string;
}

export function TransactionsList({ clubId }: TransactionsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transações</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Lista de transações em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}
