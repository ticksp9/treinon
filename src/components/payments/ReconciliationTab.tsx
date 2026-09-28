import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBankImports, useBankStatementLines, useAutoMatch, useImportStatement, useBankAccounts, useCreateBankAccount } from '@/hooks/usePaymentIntents';
import { format } from 'date-fns';
import { Upload, Zap, FileText, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props { clubId: string; }

export function ReconciliationTab({ clubId }: Props) {
  const { data: imports, isLoading: importsLoading } = useBankImports(clubId);
  const { data: accounts } = useBankAccounts(clubId);
  const autoMatch = useAutoMatch(clubId);
  const importStatement = useImportStatement(clubId);
  const createAccount = useCreateBankAccount(clubId);
  const [selectedImport, setSelectedImport] = useState<string>();
  const { data: lines } = useBankStatementLines(selectedImport);
  const [showImport, setShowImport] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const parseCsv = (text: string) => {
    const rows = text.trim().split('\n');
    if (rows.length < 2) return [];
    const headers = rows[0].split(';').map(h => h.trim().toLowerCase());
    return rows.slice(1).map(row => {
      const cols = row.split(';');
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i]?.trim(); });
      return {
        booking_date: obj.data || obj.date || obj.booking_date,
        amount: obj.montante || obj.amount || obj.valor,
        description: obj.descricao || obj.description || obj.remittance_info || '',
        counterparty_name: obj.entidade || obj.counterparty_name || obj.payer || '',
        bank_reference: obj.referencia || obj.reference || obj.bank_reference || '',
      };
    }).filter(r => r.booking_date && r.amount);
  };

  const handleImport = () => {
    const rows = parseCsv(csvText);
    if (rows.length === 0) return;
    importStatement.mutate({ bankAccountId, rows }, {
      onSuccess: () => { setShowImport(false); setCsvText(''); },
    });
  };

  const handleAddAccount = () => {
    if (!newAccountName || !newAccountLabel) return;
    createAccount.mutate({ bank_name: newAccountName, account_label: newAccountLabel }, {
      onSuccess: () => { setShowAddAccount(false); setNewAccountName(''); setNewAccountLabel(''); },
    });
  };

  const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    auto_matched: 'default', manually_matched: 'default', unmatched: 'destructive',
  };

  if (importsLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Reconciliação Bancária</h3>
          <p className="text-sm text-muted-foreground">Importar extratos e reconciliar com cobranças</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Conta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Conta Bancária</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome do Banco" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
                <Input placeholder="Identificação (ex: Conta Principal)" value={newAccountLabel} onChange={e => setNewAccountLabel(e.target.value)} />
                <Button onClick={handleAddAccount} className="w-full" disabled={!newAccountName || !newAccountLabel}>Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showImport} onOpenChange={setShowImport}>
            <DialogTrigger asChild><Button size="sm"><Upload className="w-4 h-4 mr-1" />Importar Extrato</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Importar Extrato CSV</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta bancária" /></SelectTrigger>
                  <SelectContent>
                    {(accounts || []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_label} ({a.bank_name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder={"data;montante;descricao;entidade;referencia\n2025-01-15;50.00;Mensalidade Jan;João Silva;REF001"}
                  rows={8} value={csvText} onChange={e => setCsvText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Formato CSV com ; como separador. Colunas: data, montante, descricao, entidade, referencia</p>
                <Button onClick={handleImport} className="w-full" disabled={!bankAccountId || !csvText || importStatement.isPending}>
                  {importStatement.isPending ? 'A importar...' : 'Importar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={() => autoMatch.mutate(selectedImport)} disabled={autoMatch.isPending}>
            <Zap className="w-4 h-4 mr-1" />{autoMatch.isPending ? 'A processar...' : 'Auto-Match'}
          </Button>
        </div>
      </div>

      {/* Imports list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(imports || []).map((imp: any) => (
          <Card key={imp.id} className={`cursor-pointer transition ${selectedImport === imp.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedImport(imp.id)}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{(imp.bank_accounts as any)?.account_label || 'Conta'}</span>
                </div>
                <Badge variant={imp.import_status === 'completed' ? 'default' : 'secondary'}>{imp.import_status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {imp.row_count} linhas · {imp.matched_count || 0} reconciliadas
                {imp.period_start && ` · ${imp.period_start} a ${imp.period_end}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statement lines */}
      {selectedImport && lines && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Linhas do Extrato</h4>
          {lines.map((line: any) => (
            <Card key={line.id}>
              <CardContent className="flex items-center justify-between py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{line.counterparty_name || 'N/A'}</span>
                    <Badge variant={STATUS_BADGE[line.reconciliation_status] || 'outline'}>
                      {line.reconciliation_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(line.booking_date), 'dd/MM/yyyy')}
                    {line.remittance_info && ` · ${line.remittance_info.substring(0, 40)}`}
                    {line.bank_reference && ` · Ref: ${line.bank_reference}`}
                  </p>
                </div>
                <span className={`font-bold ${line.debit_credit === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {line.debit_credit === 'debit' ? '-' : '+'}{fmt(Number(line.amount))}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
