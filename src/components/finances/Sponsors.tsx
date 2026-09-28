import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SponsorsProps {
  clubId: string;
}

export function Sponsors({ clubId }: SponsorsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patrocinadores</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Gestão de patrocínios em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}
