import { useState } from 'react';
import { useAllInviteTemplates, useUpdateInviteTemplate, useDuplicateTemplate, type InviteTemplate } from '@/hooks/useInviteTemplatesAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, MoreHorizontal, Edit, Copy, Star, StarOff, Eye, EyeOff, Mail, Phone, MessageCircle, Search, History } from 'lucide-react';
import { toast } from 'sonner';

const PROFILE_LABELS: Record<string, string> = {
  guardian: 'Encarregado',
  player: 'Atleta',
  coach: 'Treinador',
  assistant_coach: 'Adjunto',
  staff: 'Staff',
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail, sms: Phone, whatsapp: MessageCircle,
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  published: { label: 'Publicado', variant: 'default' },
  draft: { label: 'Rascunho', variant: 'secondary' },
  archived: { label: 'Arquivado', variant: 'outline' },
};

interface Props {
  onEdit: (t: InviteTemplate) => void;
  onCreate: () => void;
  onViewHistory?: (t: InviteTemplate) => void;
}

export function TemplateListPanel({ onEdit, onCreate, onViewHistory }: Props) {
  const [profileFilter, setProfileFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: string; template: InviteTemplate } | null>(null);

  const { data: templates = [], isLoading } = useAllInviteTemplates({
    profileType: profileFilter || undefined,
    channel: channelFilter || undefined,
    isActive: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
    search: search.trim() || undefined,
  });

  const updateTemplate = useUpdateInviteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const handleToggleActive = (t: InviteTemplate) => {
    if (t.is_active) {
      setConfirmAction({ type: 'deactivate', template: t });
    } else {
      updateTemplate.mutate(
        { id: t.id, is_active: true, status: 'published' },
        { onSuccess: () => toast.success('Template ativado') }
      );
    }
  };

  const confirmDeactivate = () => {
    if (!confirmAction) return;
    updateTemplate.mutate(
      { id: confirmAction.template.id, is_active: false, status: 'draft' },
      { onSuccess: () => { toast.success('Template desativado'); setConfirmAction(null); } }
    );
  };

  const handleToggleDefault = (t: InviteTemplate) => {
    updateTemplate.mutate(
      { id: t.id, is_default: !t.is_default },
      { onSuccess: () => toast.success(t.is_default ? 'Default removido' : 'Definido como default') }
    );
  };

  const handleDuplicate = (t: InviteTemplate) => {
    duplicateTemplate.mutate(t.id, {
      onSuccess: () => toast.success('Template duplicado'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou chave..."
            className="pl-9"
          />
        </div>
        <Select value={profileFilter} onValueChange={v => setProfileFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os perfis" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {Object.entries(PROFILE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={v => setChannelFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Todos os canais" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={v => setActiveFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{templates.length} template(s) encontrado(s)</p>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum template encontrado</p>
          <Button size="sm" className="mt-3" onClick={onCreate}>Criar Template</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => {
            const ChannelIcon = CHANNEL_ICONS[t.delivery_channel] || Mail;
            const statusInfo = STATUS_LABELS[t.status] || STATUS_LABELS.draft;

            return (
              <Card key={t.id} className={`transition-opacity ${!t.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(t)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-semibold truncate">{t.name || t.template_key}</h4>
                        {t.is_default && (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">
                            <Star className="h-3 w-3 mr-0.5" /> Default
                          </Badge>
                        )}
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {PROFILE_LABELS[t.profile_type] || t.profile_type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <ChannelIcon className="h-3 w-3" />
                          {t.delivery_channel.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">v{t.version_number}</span>
                        <span className="text-[10px] text-muted-foreground">{t.language.toUpperCase()}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(t.updated_at).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(t)}>
                          <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        {onViewHistory && (
                          <DropdownMenuItem onClick={() => onViewHistory(t)}>
                            <History className="h-3.5 w-3.5 mr-2" /> Histórico
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleActive(t)}>
                          {t.is_active ? <EyeOff className="h-3.5 w-3.5 mr-2" /> : <Eye className="h-3.5 w-3.5 mr-2" />}
                          {t.is_active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleDefault(t)}>
                          {t.is_default ? <StarOff className="h-3.5 w-3.5 mr-2" /> : <Star className="h-3.5 w-3.5 mr-2" />}
                          {t.is_default ? 'Remover default' : 'Definir default'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deactivation confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{confirmAction?.template.name}" deixará de ser utilizado para novos envios.
              Templates já enviados mantêm o conteúdo original.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
