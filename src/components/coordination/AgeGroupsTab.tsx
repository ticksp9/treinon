import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { getSeasonStartYear, getCurrentSeasonName } from "@/lib/constants";
import { alignAgeGroupsToSeason, type AgeGroupRule } from "@/lib/age-group-rules";

interface AgeGroupsTabProps {
  clubId: string;
}

interface AgeGroup {
  id: string;
  name: string;
  min_birth_year: number;
  max_birth_year: number;
  display_order: number;
  is_active: boolean;
}

export function AgeGroupsTab({ clubId }: AgeGroupsTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AgeGroup | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    min_birth_year: new Date().getFullYear() - 10,
    max_birth_year: new Date().getFullYear() - 8,
  });

  const { data: ageGroups, isLoading } = useQuery({
    queryKey: ['youth-age-groups', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_age_groups')
        .select('*')
        .eq('club_id', clubId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as AgeGroup[];
    },
    enabled: !!clubId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const maxOrder = ageGroups?.length ? Math.max(...ageGroups.map(g => g.display_order)) + 1 : 0;
      
      const { error } = await supabase
        .from('youth_age_groups')
        .insert({
          club_id: clubId,
          name: data.name,
          min_birth_year: data.min_birth_year,
          max_birth_year: data.max_birth_year,
          display_order: maxOrder,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-age-groups', clubId] });
      toast.success("Escalão criado com sucesso");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar escalão: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('youth_age_groups')
        .update({
          name: data.name,
          min_birth_year: data.min_birth_year,
          max_birth_year: data.max_birth_year,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-age-groups', clubId] });
      toast.success("Escalão atualizado com sucesso");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar escalão: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('youth_age_groups')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-age-groups', clubId] });
      toast.success("Escalão eliminado com sucesso");
    },
    onError: (error: any) => {
      toast.error(`Erro ao eliminar escalão: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      min_birth_year: new Date().getFullYear() - 10,
      max_birth_year: new Date().getFullYear() - 8,
    });
    setEditingGroup(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (group: AgeGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      min_birth_year: group.min_birth_year,
      max_birth_year: group.max_birth_year,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Escalões</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingGroup(null); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Escalão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Editar Escalão" : "Novo Escalão"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Escalão</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Infantis, Iniciados, Juvenis"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_birth_year">Ano Nasc. Mínimo</Label>
                  <Input
                    id="min_birth_year"
                    type="number"
                    value={formData.min_birth_year}
                    onChange={(e) => setFormData({ ...formData, min_birth_year: parseInt(e.target.value) })}
                    min={currentYear - 25}
                    max={currentYear - 5}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Jogadores nascidos a partir de {formData.min_birth_year}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max_birth_year">Ano Nasc. Máximo</Label>
                  <Input
                    id="max_birth_year"
                    type="number"
                    value={formData.max_birth_year}
                    onChange={(e) => setFormData({ ...formData, max_birth_year: parseInt(e.target.value) })}
                    min={currentYear - 25}
                    max={currentYear - 5}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Jogadores nascidos até {formData.max_birth_year}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingGroup ? "Guardar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">A carregar...</p>
        ) : ageGroups && ageGroups.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Anos de Nascimento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const [aligned] = alignAgeGroupsToSeason([{ ...group, code: '' } as AgeGroupRule], getSeasonStartYear());
                      const changed = aligned.min_birth_year !== group.min_birth_year || aligned.max_birth_year !== group.max_birth_year;
                      return (
                        <div>
                          <span>{aligned.min_birth_year} - {aligned.max_birth_year}</span>
                          {changed && (
                            <div className="text-xs text-muted-foreground">
                              Ajustado para {getCurrentSeasonName()} (guardado: {group.min_birth_year} - {group.max_birth_year})
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={group.is_active ? "default" : "secondary"}>
                      {group.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(group)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Tem a certeza que quer eliminar este escalão?")) {
                            deleteMutation.mutate(group.id);
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
              Ainda não tem escalões definidos.
            </p>
            <p className="text-sm text-muted-foreground">
              Crie escalões como "Infantis", "Iniciados", "Juvenis", etc.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
