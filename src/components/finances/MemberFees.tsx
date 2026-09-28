import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MemberFeesProps {
  clubId: string;
}

export function MemberFees({ clubId }: MemberFeesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sócios</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Gestão de sócios em desenvolvimento...</p>
      </CardContent>
    </Card>
  );
}
