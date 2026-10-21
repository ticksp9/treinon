import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeCostsByFacility, computeCostsByTeam } from '@/hooks/useFacilities';
import { tx, intlLocale } from '@/lib/i18n/ui';

const COST_TYPES: Record<string, string> = {
  utilities: 'Utilidades', cleaning: 'Limpeza', maintenance: 'Manutenção', rental: 'Aluguer',
  security: 'Segurança', staffing: 'Staff', lighting: 'Iluminação', water: 'Água',
  insurance: 'Seguros', certification: 'Certificação', repairs: 'Reparações', other: 'Outros',
};

interface Props {
  operationalCosts: any[];
  facilities: any[];
  teams: any[];
}

export function CostsTab({ operationalCosts, facilities, teams }: Props) {
  const byFacility = computeCostsByFacility(operationalCosts);
  const byTeam = computeCostsByTeam(operationalCosts);
  const total = operationalCosts.reduce((s: number, c: any) => s + Number(c.amount), 0);

  const getFacName = (id: string) => facilities.find(f => f.id === id)?.name || id;
  const getTeamName = (id: string) => id === 'unassigned' ? 'Sem equipa' : (teams.find(t => t.id === id)?.name || id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">{tx('Total: €')}{total.toLocaleString(intlLocale())}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-sm">{tx('Por Instalação')}</h4>
              <div className="space-y-2">
                {Object.entries(byFacility).sort((a, b) => b[1] - a[1]).map(([id, amount]) => (
                  <div key={id} className="flex justify-between items-center text-sm">
                    <span>{getFacName(id)}</span>
                    <Badge variant="outline">€{amount.toLocaleString(intlLocale())}</Badge>
                  </div>
                ))}
                {Object.keys(byFacility).length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem dados')}</p>}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-sm">{tx('Por Equipa')}</h4>
              <div className="space-y-2">
                {Object.entries(byTeam).sort((a, b) => b[1] - a[1]).map(([id, amount]) => (
                  <div key={id} className="flex justify-between items-center text-sm">
                    <span>{getTeamName(id)}</span>
                    <Badge variant="outline">€{amount.toLocaleString(intlLocale())}</Badge>
                  </div>
                ))}
                {Object.keys(byTeam).length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem dados')}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{tx('Detalhes')}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {operationalCosts.slice(0, 50).map((c: any) => (
              <div key={c.id} className="flex justify-between items-center text-sm border-b pb-2">
                <div>
                  <span className="font-medium">{getFacName(c.facility_id)}</span>
                  <span className="text-muted-foreground"> • {COST_TYPES[c.cost_type] || c.cost_type} • {c.period_reference}</span>
                </div>
                <span className="font-medium">€{Number(c.amount).toLocaleString(intlLocale())}</span>
              </div>
            ))}
            {operationalCosts.length === 0 && <p className="text-center text-muted-foreground">{tx('Nenhum custo operacional registado')}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
