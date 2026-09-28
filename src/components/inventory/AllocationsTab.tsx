import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, string> = {
  allocated: 'Atribuído', partially_returned: 'Parc. Devolvido', returned: 'Devolvido',
  consumed: 'Consumido', lost: 'Perdido', damaged: 'Danificado',
};

interface Props {
  allocations: any[];
  kitAssignments: any[];
  teams: any[];
}

export function AllocationsTab({ allocations, kitAssignments, teams }: Props) {
  const teamMap = new Map(teams.map((t: any) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Alocações por Equipa ({allocations.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipa</TableHead><TableHead>Tipo Item</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Data</TableHead><TableHead>Devolução</TableHead><TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem alocações</TableCell></TableRow>
              ) : allocations.slice(0, 50).map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{teamMap.get(a.team_id) || 'N/A'}</TableCell>
                  <TableCell className="text-xs">{a.item_type}</TableCell>
                  <TableCell>{a.quantity}</TableCell>
                  <TableCell className="text-sm">{a.allocation_date ? format(new Date(a.allocation_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-sm">{a.return_due_date ? format(new Date(a.return_due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell><Badge variant={a.allocation_status === 'returned' ? 'secondary' : a.allocation_status === 'lost' || a.allocation_status === 'damaged' ? 'destructive' : 'outline'}>{STATUS_MAP[a.allocation_status] || a.allocation_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Kits por Atleta ({kitAssignments.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Tamanho</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Emissão</TableHead><TableHead>Devolução</TableHead><TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kitAssignments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem kits atribuídos</TableCell></TableRow>
              ) : kitAssignments.slice(0, 50).map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.item_description}</TableCell>
                  <TableCell>{k.size || '—'}</TableCell>
                  <TableCell>{k.quantity}</TableCell>
                  <TableCell className="text-sm">{k.issue_date ? format(new Date(k.issue_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-sm">{k.return_date ? format(new Date(k.return_date), 'dd/MM/yyyy') : k.return_expected ? format(new Date(k.return_expected), 'dd/MM/yyyy') + ' (prev.)' : '—'}</TableCell>
                  <TableCell><Badge variant={k.status === 'returned' ? 'secondary' : k.status === 'lost' || k.status === 'damaged' ? 'destructive' : 'outline'}>{k.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
