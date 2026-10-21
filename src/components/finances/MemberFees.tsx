import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tx } from '@/lib/i18n/ui';

interface MemberFeesProps {
  clubId: string;
}

export function MemberFees({ clubId }: MemberFeesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx('Sócios')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{tx('Gestão de sócios em desenvolvimento...')}</p>
      </CardContent>
    </Card>
  );
}
