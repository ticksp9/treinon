import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy } from '@/hooks/useAcademy';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  under_observation: 'Observação',
  high_potential: 'Alto Potencial',
  accelerated: 'Acelerado',
  eligible_promotion: 'Elegível',
  promoted: 'Promovido',
  retained: 'Retido',
  in_transition: 'Transição',
  unavailable: 'Indisponível',
  released: 'Desligado',
  archived: 'Arquivado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  high_potential: 'default',
  promoted: 'secondary',
  released: 'destructive',
  under_observation: 'outline',
};

export function AcademyAthletesTab() {
  const { playerProfiles, ageGroups } = useAcademy();

  const profiles = playerProfiles.data || [];
  const groups = ageGroups.data || [];
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Atletas da Formação</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum atleta registado na academia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogador ID</TableHead>
                  <TableHead>Escalão</TableHead>
                  <TableHead>Posição</TableHead>
                  <TableHead>Pé</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Época</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.player_id?.slice(0, 8)}…</TableCell>
                    <TableCell>{p.age_group_id ? groupMap.get(p.age_group_id) || '—' : '—'}</TableCell>
                    <TableCell>{p.primary_position || '—'}</TableCell>
                    <TableCell>{p.dominant_foot || '—'}</TableCell>
                    <TableCell>{p.entry_date || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.pathway_status] || 'outline'}>
                        {STATUS_LABELS[p.pathway_status] || p.pathway_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.season || '—'}</TableCell>
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
