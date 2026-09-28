import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Building2, 
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Trash2,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Accounting() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('movimentos');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['erp-transactions', clubId, filterType],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('club_id', clubId)
        .order('date', { ascending: false })
        .limit(100);
      
      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: categories } = useQuery({
    queryKey: ['erp-categories', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('*')
        .eq('club_id', clubId);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: accounts } = useQuery({
    queryKey: ['erp-accounts', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('club_accounts')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isClubAdmin || !clubId) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para administradores de clubes.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const filteredTransactions = transactions?.filter(t => 
    !searchTerm || 
    t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Contabilidade</h1>
            <p className="text-muted-foreground">
              Gestão de movimentos financeiros
            </p>
          </div>
          <TransactionDialog 
            clubId={clubId} 
            userId={user?.id || ''} 
            categories={categories || []}
            accounts={accounts || []}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentos" className="space-y-4 mt-6">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar movimentos..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'income' | 'expense')}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de transações */}
            <Card>
              <CardContent className="p-0">
                {transactionsLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-48" />
                  </div>
                ) : filteredTransactions?.length === 0 ? (
                  <div className="py-12 text-center">
                    <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum movimento registado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions?.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            {format(new Date(transaction.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>{transaction.description || '-'}</TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell className="capitalize">{transaction.payment_method || 'cash'}</TableCell>
                          <TableCell className={`text-right font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            <span className="flex items-center justify-end gap-1">
                              {transaction.type === 'income' ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {formatCurrency(Number(transaction.amount))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contas" className="space-y-4 mt-6">
            <AccountsManager clubId={clubId} userId={user?.id || ''} accounts={accounts || []} />
          </TabsContent>

          <TabsContent value="categorias" className="space-y-4 mt-6">
            <CategoriesManager clubId={clubId} userId={user?.id || ''} categories={categories || []} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function TransactionDialog({ clubId, userId, categories, accounts }: { 
  clubId: string; 
  userId: string; 
  categories: any[];
  accounts: any[];
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'cash',
    account_id: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('transactions')
        .insert({
          club_id: clubId,
          owner_id: userId,
          type: data.type,
          amount: parseFloat(data.amount),
          description: data.description,
          category: data.category,
          date: data.date,
          payment_method: data.payment_method,
          account_id: data.account_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-transactions', clubId] });
      toast.success('Movimento registado com sucesso');
      setOpen(false);
      setFormData({
        type: 'income',
        amount: '',
        description: '',
        category: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: 'cash',
        account_id: '',
      });
    },
    onError: () => {
      toast.error('Erro ao registar movimento');
    },
  });

  const filteredCategories = categories.filter(c => c.type === formData.type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Movimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registar Movimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.type === 'income' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormData(prev => ({ ...prev, type: 'income', category: '' }))}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Receita
              </Button>
              <Button
                type="button"
                variant={formData.type === 'expense' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: '' }))}
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Despesa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (€)</Label>
              <Input 
                id="amount" 
                type="number"
                step="0.01"
                required
                value={formData.amount} 
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input 
                id="date" 
                type="date"
                required
                value={formData.date} 
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select 
              value={formData.category} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Conta</Label>
            <Select 
              value={formData.account_id} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, account_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Método de Pagamento</Label>
            <Select 
              value={formData.payment_method} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, payment_method: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="mbway">MBWay</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea 
              id="description" 
              rows={2}
              value={formData.description} 
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountsManager({ clubId, userId, accounts }: { clubId: string; userId: string; accounts: any[] }) {
  const [newAccount, setNewAccount] = useState({ name: '', account_type: 'bank', iban: '' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('club_accounts')
        .insert({
          club_id: clubId,
          owner_id: userId,
          name: newAccount.name,
          account_type: newAccount.account_type,
          iban: newAccount.iban || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-accounts', clubId] });
      toast.success('Conta criada');
      setNewAccount({ name: '', account_type: 'bank', iban: '' });
    },
    onError: () => {
      toast.error('Erro ao criar conta');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Conta</CardTitle>
          <CardDescription>Caixa, banco ou carteira digital</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="flex gap-4">
            <Input 
              placeholder="Nome da conta"
              value={newAccount.name}
              onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Select 
              value={newAccount.account_type} 
              onValueChange={(v) => setNewAccount(prev => ({ ...prev, account_type: v }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Caixa</SelectItem>
                <SelectItem value="bank">Banco</SelectItem>
                <SelectItem value="digital">Digital (MBWay)</SelectItem>
              </SelectContent>
            </Select>
            <Input 
              placeholder="IBAN (opcional)"
              value={newAccount.iban}
              onChange={(e) => setNewAccount(prev => ({ ...prev, iban: e.target.value }))}
            />
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map(account => (
          <Card key={account.id}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{account.account_type}</p>
                </div>
              </div>
              <div className="mt-4 text-2xl font-bold">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(account.balance || 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CategoriesManager({ clubId, userId, categories }: { clubId: string; userId: string; categories: any[] }) {
  const [newCategory, setNewCategory] = useState({ name: '', type: 'income' as 'income' | 'expense' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('transaction_categories')
        .insert({
          club_id: clubId,
          owner_id: userId,
          name: newCategory.name,
          type: newCategory.type,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-categories', clubId] });
      toast.success('Categoria criada');
      setNewCategory({ name: '', type: 'income' });
    },
    onError: () => {
      toast.error('Erro ao criar categoria');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transaction_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-categories', clubId] });
      toast.success('Categoria eliminada');
    },
    onError: () => {
      toast.error('Erro ao eliminar categoria');
    },
  });

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="flex gap-4">
            <Input 
              placeholder="Nome da categoria"
              value={newCategory.name}
              onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Select 
              value={newCategory.type} 
              onValueChange={(v: 'income' | 'expense') => setNewCategory(prev => ({ ...prev, type: v }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-5 h-5" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incomeCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma categoria de receita</p>
            ) : (
              <div className="space-y-2">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span>{cat.name}</span>
                    {!cat.is_system && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(cat.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="w-5 h-5" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma categoria de despesa</p>
            ) : (
              <div className="space-y-2">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span>{cat.name}</span>
                    {!cat.is_system && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(cat.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
