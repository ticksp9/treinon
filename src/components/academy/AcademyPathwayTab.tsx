import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';
import { format } from 'date-fns';
import { tx } from '@/lib/i18n/ui';

const DECISION_LABELS: Record<string, string> = {
  promote: 'Promover',
  retain: 'Reter',
  release: 'Desligar',
  get loan_internal() { return tx('Empréstimo Interno'); },
  get under_review() { return tx('Em Revisão'); },
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
          <CardTitle>{tx('Revisões de Promoção & Retenção')}</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tx('Nenhuma revisão de progressão registada.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx('Data')}</TableHead>
                  <TableHead>{tx('Jogador ID')}</TableHead>
                  <TableHead>{tx('De')}</TableHead>
                  <TableHead>{tx('Para')}</TableHead>
                  <TableHead>{tx('Decisão')}</TableHead>
                  <TableHead>{tx('Época')}</TableHead>
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
