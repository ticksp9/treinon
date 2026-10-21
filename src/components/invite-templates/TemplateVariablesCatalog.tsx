import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VARIABLE_CATALOG } from '@/lib/template-engine';
import { Info } from 'lucide-react';
import { tx } from '@/lib/i18n/ui';

export function TemplateVariablesCatalog() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          {tx('Catálogo de Variáveis Dinâmicas')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {tx('Use estas variáveis nos templates com a sintaxe')}{' '}{tx('{{variavel}}')}{tx('. Apenas variáveis desta lista são permitidas.')}
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{tx('Variável')}</TableHead>
              <TableHead className="text-xs">{tx('Descrição')}</TableHead>
              <TableHead className="text-xs">{tx('Tipo')}</TableHead>
              <TableHead className="text-xs">{tx('Canais')}</TableHead>
              <TableHead className="text-xs">{tx('Exemplo')}</TableHead>
              <TableHead className="text-xs">{tx('Fallback')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {VARIABLE_CATALOG.map(v => (
              <TableRow key={v.key}>
                <TableCell className="font-mono text-xs text-primary">
                  {`{{${v.key}}}`}
                </TableCell>
                <TableCell className="text-xs">{v.description}</TableCell>
                <TableCell>
                  <Badge variant={v.required ? 'default' : 'secondary'} className="text-[10px]">
                    {v.required ? tx('Obrigatória') : tx('Opcional')}
                  </Badge>
                </TableCell>
                <TableCell className="text-[10px] text-muted-foreground">
                  {v.supportedChannels.map(c => c.toUpperCase()).join(', ')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.exampleValue}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.defaultFallback || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
