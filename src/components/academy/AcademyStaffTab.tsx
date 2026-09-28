import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';
import { AlertTriangle } from 'lucide-react';

export function AcademyStaffTab() {
  const { staffAssignments, ageGroups } = useAcademy();

  const staff = staffAssignments.data || [];
  const groups = ageGroups.data || [];
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const now = new Date();
  const expiringLicenses = staff.filter(s => s.license_valid_until && new Date(s.license_valid_until) < now);

  return (
    <div className="space-y-4">
      {expiringLicenses.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">{expiringLicenses.length}</span> membro(s) do staff com qualificação/licença vencida
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff da Formação</CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum staff registado na academia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Escalão</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead>Licença até</TableHead>
                  <TableHead>Época</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map(s => {
                  const expired = s.license_valid_until && new Date(s.license_valid_until) < now;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.user_id?.slice(0, 8)}…</TableCell>
                      <TableCell>{s.role}</TableCell>
                      <TableCell>{s.age_group_id ? groupMap.get(s.age_group_id) || '—' : '—'}</TableCell>
                      <TableCell>{s.qualification || '—'}</TableCell>
                      <TableCell>
                        {s.license_valid_until ? (
                          <Badge variant={expired ? 'destructive' : 'outline'}>
                            {s.license_valid_until}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{s.season || '—'}</TableCell>
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
