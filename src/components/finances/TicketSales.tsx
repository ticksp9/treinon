import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TicketSalesProps {
  clubId: string;
}

export function TicketSales({ clubId }: TicketSalesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bilheteira</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Gestão de bilheteira em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}
