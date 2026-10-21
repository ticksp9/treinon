import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { tx } from '@/lib/i18n/ui';

interface DocumentsTabProps {
  clubId: string;
}

interface Document {
  id: string;
  title: string;
  document_type: string;
  description: string | null;
  file_url: string | null;
  target_audience: string[];
  version: string;
  is_active: boolean;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: 'rules', get label() { return tx('Regras Internas'); } },
  { value: 'code_of_conduct', get label() { return tx('Código de Conduta'); } },
  { value: 'regulation', get label() { return tx('Regulamento'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

const AUDIENCES = [
  { value: 'parents', get label() { return tx('Pais'); } },
  { value: 'athletes', get label() { return tx('Atletas'); } },
  { value: 'coaches', get label() { return tx('Treinadores'); } },
];

export function DocumentsTab({ clubId }: DocumentsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    document_type: "rules",
    description: "",
    file_url: "",
    target_audience: ["parents", "athletes"] as string[],
    version: "1.0",
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['youth-coordination-documents', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_coordination_documents')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!clubId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('youth_coordination_documents')
        .insert({
          club_id: clubId,
          created_by: user?.id,
          title: data.title,
          document_type: data.document_type,
          description: data.description || null,
          file_url: data.file_url || null,
          target_audience: data.target_audience,
          version: data.version,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-documents', clubId] });
      toast.success(tx('Documento criado com sucesso'));
      resetForm();
    },
    onError: (error: any) => {
      toast.error(tx('Erro ao criar documento: {{v0}}', { v0: error.message }));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('youth_coordination_documents')
        .update({
          title: data.title,
          document_type: data.document_type,
          description: data.description || null,
          file_url: data.file_url || null,
          target_audience: data.target_audience,
          version: data.version,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-documents', clubId] });
      toast.success(tx('Documento atualizado com sucesso'));
      resetForm();
    },
    onError: (error: any) => {
      toast.error(tx('Erro ao atualizar documento: {{v0}}', { v0: error.message }));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('youth_coordination_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-documents', clubId] });
      toast.success(tx('Documento eliminado com sucesso'));
    },
    onError: (error: any) => {
      toast.error(tx('Erro ao eliminar documento: {{v0}}', { v0: error.message }));
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      document_type: "rules",
      description: "",
      file_url: "",
      target_audience: ["parents", "athletes"],
      version: "1.0",
    });
    setEditingDoc(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      document_type: doc.document_type,
      description: doc.description || "",
      file_url: doc.file_url || "",
      target_audience: doc.target_audience,
      version: doc.version,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingDoc) {
      updateMutation.mutate({ id: editingDoc.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleAudience = (audience: string) => {
    setFormData(prev => ({
      ...prev,
      target_audience: prev.target_audience.includes(audience)
        ? prev.target_audience.filter(a => a !== audience)
        : [...prev.target_audience, audience]
    }));
  };

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getAudienceLabels = (audiences: string[]) => {
    return audiences.map(a => AUDIENCES.find(aud => aud.value === a)?.label || a);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{tx('Documentos da Coordenação')}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingDoc(null); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              {tx('Novo Documento')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingDoc ? tx('Editar Documento') : tx('Novo Documento')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{tx('Título')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={tx('Ex: Código de Conduta para Atletas')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="document_type">{tx('Tipo')}</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">{tx('Versão')}</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{tx('Descrição')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={tx('Breve descrição do documento...')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file_url">{tx('URL do Ficheiro (opcional)')}</Label>
                <Input
                  id="file_url"
                  type="url"
                  value={formData.file_url}
                  onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>{tx('Destinatários')}</Label>
                <div className="flex gap-4">
                  {AUDIENCES.map((audience) => (
                    <div key={audience.value} className="flex items-center gap-2">
                      <Checkbox
                        id={audience.value}
                        checked={formData.target_audience.includes(audience.value)}
                        onCheckedChange={() => toggleAudience(audience.value)}
                      />
                      <label htmlFor={audience.value} className="text-sm">
                        {audience.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {tx('Cancelar')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingDoc ? tx('Guardar') : tx('Criar')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">{tx('A carregar...')}</p>
        ) : documents && documents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx('Documento')}</TableHead>
                <TableHead>{tx('Tipo')}</TableHead>
                <TableHead>{tx('Destinatários')}</TableHead>
                <TableHead>{tx('Versão')}</TableHead>
                <TableHead>{tx('Data')}</TableHead>
                <TableHead className="text-right">{tx('Ações')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(doc.document_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {getAudienceLabels(doc.target_audience).map((label) => (
                        <Badge key={label} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>v{doc.version}</TableCell>
                  <TableCell>
                    {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: pt })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {doc.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(doc.file_url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(doc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(tx('Tem a certeza que quer eliminar este documento?'))) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {tx('Ainda não tem documentos da coordenação.')}
            </p>
            <p className="text-sm text-muted-foreground">
              {tx('Adicione regras, códigos de conduta e regulamentos.')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
