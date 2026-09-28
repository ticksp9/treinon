import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';
import { format } from 'date-fns';

const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  open: 'Aberto',
  in_progress: 'Em Curso',
  review: 'Revisão',
  published: 'Publicado',
  archived: 'Arquivado',
};

const CYCLE_TYPE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semester: 'Semestral',
  annual: 'Anual',
  extraordinary: 'Extraordinário',
};

export function AcademyAssessmentsTab() {
  const { assessmentCycles, assessments } = useAcademy();

  const cycles = assessmentCycles.data || [];
  const allAssessments = assessments.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ciclos de Avaliação</CardTitle>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum ciclo de avaliação criado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Avaliações</TableHead>
                  <TableHead>Status</TableHead>
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
