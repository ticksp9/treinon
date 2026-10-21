import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tx } from '@/lib/i18n/ui';

interface SponsorsProps {
  clubId: string;
}

export function Sponsors({ clubId }: SponsorsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx('Patrocinadores')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{tx('Gestão de patrocínios em desenvolvimento...')}</p>
      </CardContent>
    </Card>
  );
}
