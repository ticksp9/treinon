import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';
import { format } from 'date-fns';

const DECISION_LABELS: Record<string, string> = {
  promote: 'Promover',
  retain: 'Reter',
  release: 'Desligar',
  loan_internal: 'Empréstimo Interno',
  under_review: 'Em Revisão',
  defer: 'Adiar',
};

const DECISION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  promote: 'default',
  retain: 'secondary',
  release: 'destructive',
  under_review: 'outline',
  defer: 'outline',
  loan_internal: 'secondary',
};

export function AcademyPathwayTab() {
  const { promotionReviews, ageGroups } = useAcademy();

  const reviews = promotionReviews.data || [];
  const groups = ageGroups.data || [];
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Revisões de Promoção & Retenção</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma revisão de progressão registada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Jogador ID</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Decisão</TableHead>
                  <TableHead>Época</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.review_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono text-xs">{r.player_id?.slice(0, 8)}…</TableCell>
                    <TableCell>{r.current_age_group_id ? groupMap.get(r.current_age_group_id) || '—' : '—'}</TableCell>
                    <TableCell>{r.target_age_group_id ? groupMap.get(r.target_age_group_id) || '—' : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={DECISION_VARIANT[r.decision] || 'outline'}>
                        {DECISION_LABELS[r.decision] || r.decision}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.season || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
