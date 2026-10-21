import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';
import { format } from 'date-fns';
import { tx } from '@/lib/i18n/ui';

const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  open: 'Aberto',
  in_progress: 'Em Curso',
  get review() { return tx('Revisão'); },
  published: 'Publicado',
  archived: 'Arquivado',
};

const CYCLE_TYPE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semester: 'Semestral',
  annual: 'Anual',
  get extraordinary() { return tx('Extraordinário'); },
};

export function AcademyAssessmentsTab() {
  const { assessmentCycles, assessments } = useAcademy();

  const cycles = assessmentCycles.data || [];
  const allAssessments = assessments.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{tx('Ciclos de Avaliação')}</CardTitle>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tx('Nenhum ciclo de avaliação criado.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx('Nome')}</TableHead>
                  <TableHead>{tx('Tipo')}</TableHead>
                  <TableHead>{tx('Período')}</TableHead>
                  <TableHead>{tx('Avaliações')}</TableHead>
                  <TableHead>{tx('Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map(c => {
                  const cycleAssessments = allAssessments.filter(a => a.cycle_id === c.id);
                  const submitted = cycleAssessments.filter(a => a.status !== 'draft').length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{CYCLE_TYPE_LABELS[c.cycle_type] || c.cycle_type}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(c.period_start), 'dd/MM/yyyy')} — {format(new Date(c.period_end), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{submitted}</span>
                        <span className="text-muted-foreground">/{cycleAssessments.length}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'published' ? 'default' : 'outline'}>
                          {CYCLE_STATUS_LABELS[c.status] || c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
