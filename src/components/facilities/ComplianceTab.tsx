import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileCheck } from 'lucide-react';

const DOC_TYPES: Record<string, string> = {
  usage_license: 'Licença de Utilização', lease_contract: 'Contrato de Arrendamento',
  inspection_report: 'Relatório de Inspeção', safety_regulation: 'Regulamento de Segurança',
  lighting_certificate: 'Certificado de Iluminação', insurance: 'Seguro',
  municipal_authorization: 'Autorização Municipal', other: 'Outro',
};

interface Props {
  documents: any[];
  complianceAlerts: any[];
  facilities: any[];
}

export function ComplianceTab({ documents, complianceAlerts, facilities }: Props) {
  const getFacName = (facId: string) => facilities.find(f => f.id === facId)?.name || facId;
  const now = Date.now();
  const expired = documents.filter(d => d.valid_to && new Date(d.valid_to).getTime() < now);
  const expiring = documents.filter(d => {
    if (!d.valid_to) return false;
    const diff = (new Date(d.valid_to).getTime() - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  return (
    <div className="space-y-6">
      {(expired.length > 0 || expiring.length > 0 || complianceAlerts.length > 0) && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Alertas de Conformidade</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expired.map(d => (
              <div key={d.id} className="flex justify-between items-center text-sm">
                <span>{DOC_TYPES[d.document_type] || d.document_type} — {getFacName(d.facility_id)}</span>
                <Badge variant="destructive">Expirado</Badge>
              </div>
            ))}
            {expiring.map(d => (
              <div key={d.id} className="flex justify-between items-center text-sm">
                <span>{DOC_TYPES[d.document_type] || d.document_type} — {getFacName(d.facility_id)}</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300">A expirar</Badge>
              </div>
            ))}
            {complianceAlerts.map(a => (
              <div key={a.id} className="flex justify-between items-center text-sm">
                <span>{a.alert_type}</span>
                <Badge variant={a.severity === 'high' ? 'destructive' : 'outline'}>{a.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-5 w-5" />Documentação ({documents.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documents.map(d => {
              const isExpired = d.valid_to && new Date(d.valid_to).getTime() < now;
              return (
                <div key={d.id} className="flex justify-between items-center text-sm border-b pb-2">
                  <div>
                    <span className="font-medium">{DOC_TYPES[d.document_type] || d.document_type}</span>
                    <span className="text-muted-foreground"> — {getFacName(d.facility_id)}</span>
                    {d.mandatory && <Badge variant="secondary" className="ml-2 text-xs">Obrigatório</Badge>}
                  </div>
                  <div className="flex gap-2 items-center">
                    {d.valid_to && <span className="text-xs text-muted-foreground">Até {new Date(d.valid_to).toLocaleDateString('pt-PT')}</span>}
                    <Badge variant={isExpired ? 'destructive' : 'default'} className="text-xs">{isExpired ? 'Expirado' : d.status}</Badge>
                  </div>
                </div>
              );
            })}
            {documents.length === 0 && <p className="text-center text-muted-foreground">Nenhum documento registado</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
