import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tx } from '@/lib/i18n/ui';

interface TicketSalesProps {
  clubId: string;
}

export function TicketSales({ clubId }: TicketSalesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx('Bilheteira')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{tx('Gestão de bilheteira em desenvolvimento...')}</p>
      </CardContent>
    </Card>
  );
}
