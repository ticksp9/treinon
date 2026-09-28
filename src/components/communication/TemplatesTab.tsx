import { useState } from 'react';
import {
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  CommunicationTemplate,
} from '@/hooks/useCommunicationPhase2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Plus, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TemplatesTabProps {
  clubId: string | null;
  userId?: string | null;
  onUseTemplate?: (template: CommunicationTemplate) => void;
}

const categoryLabels: Record<string, string> = {
  announcement: 'Anúncio',
  reminder: 'Lembrete',
  attendance: 'Presença',
};

const scopeLabels: Record<string, string> = {
  personal: 'Pessoal',
  team: 'Equipa',
  club: 'Clube',
};

export function TemplatesTab({ clubId, userId, onUseTemplate }: TemplatesTabProps) {
  const { data: templates = [], isLoading } = useTemplates(clubId, userId);
  const deleteTemplate = useDeleteTemplate();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Modelos</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum modelo criado</p>
          <p className="text-xs mt-1">Crie modelos para reutilizar em anúncios e lembretes</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] md:max-h-none">
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="text-sm font-semibold truncate">{t.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {categoryLabels[t.category] || t.category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {scopeLabels[t.scope] || t.scope}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {onUseTemplate && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onUseTemplate(t)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteTemplate.mutate(t.id, { onSuccess: () => toast.success('Modelo removido') })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateTemplateDialog clubId={clubId} open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}

function CreateTemplateDialog({
  clubId,
  open,
  onClose,
}: {
  clubId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateTemplate(clubId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('announcement');
  const [scope, setScope] = useState('personal');

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    create.mutate(
      { title: title.trim(), content: content.trim(), category, scope },
      {
        onSuccess: () => {
          toast.success('Modelo criado');
          setTitle(''); setContent('');
          onClose();
        },
        onError: () => toast.error('Erro ao criar modelo'),
      }
    );
  };

  const placeholderHints = [
    '{equipa}', '{escalao}', '{data}', '{hora}', '{local}', '{treinador}',
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lembrete de treino" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">Anúncio</SelectItem>
                <SelectItem value="reminder">Lembrete</SelectItem>
                <SelectItem value="attendance">Presença</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Âmbito</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Pessoal</SelectItem>
                <SelectItem value="team">Equipa</SelectItem>
                <SelectItem value="club">Clube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conteúdo *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o modelo aqui. Use variáveis como {equipa}, {data}, {hora}..."
              rows={4}
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {placeholderHints.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 transition-colors"
                  onClick={() => setContent((c) => c + ' ' + p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? 'A criar...' : 'Criar Modelo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
