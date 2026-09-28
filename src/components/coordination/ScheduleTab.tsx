import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { generateSchedulePdf } from "@/lib/generateSchedulePdf";

interface ScheduleTabProps {
  clubId: string;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  youth_team_id: string;
  youth_teams: {
    id: string;
    name: string;
    youth_age_groups: {
      id: string;
      name: string;
    };
  };
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const SCHEDULE_COLORS: Record<string, string> = {
  "Petizes": "bg-pink-100 border-pink-300 text-pink-800",
  "Traquinas": "bg-purple-100 border-purple-300 text-purple-800",
  "Benjamins": "bg-blue-100 border-blue-300 text-blue-800",
  "Infantis": "bg-green-100 border-green-300 text-green-800",
  "Iniciados": "bg-yellow-100 border-yellow-300 text-yellow-800",
  "Juvenis": "bg-orange-100 border-orange-300 text-orange-800",
  "Juniores": "bg-red-100 border-red-300 text-red-800",
};

export function ScheduleTab({ clubId }: ScheduleTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    youth_team_id: "",
    day_of_week: 1,
    start_time: "18:00",
    end_time: "19:30",
    location: "",
  });

  // Fetch teams for dropdown
  const { data: teams } = useQuery({
    queryKey: ['youth-teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_teams')
        .select(`
          *,
          youth_age_groups (id, name)
        `)
        .eq('club_id', clubId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clubId
  });

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['youth-training-schedules', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youth_training_schedules')
        .select(`
          *,
          youth_teams (
            id,
            name,
            youth_age_groups (id, name)
          )
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!clubId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('youth_training_schedules')
        .insert({
          club_id: clubId,
          youth_team_id: data.youth_team_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
          location: data.location || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-training-schedules', clubId] });
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-stats', clubId] });
      toast.success("Horário adicionado com sucesso");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar horário: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('youth_training_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youth-training-schedules', clubId] });
      queryClient.invalidateQueries({ queryKey: ['youth-coordination-stats', clubId] });
      toast.success("Horário eliminado com sucesso");
    },
    onError: (error: any) => {
      toast.error(`Erro ao eliminar horário: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      youth_team_id: "",
      day_of_week: 1,
      start_time: "18:00",
      end_time: "19:30",
      location: "",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getColorClass = (ageGroupName: string) => {
    return SCHEDULE_COLORS[ageGroupName] || "bg-gray-100 border-gray-300 text-gray-800";
  };

  const getDayLabel = (day: number) => {
    return DAYS_OF_WEEK.find(d => d.value === day)?.label || "";
  };

  // Group schedules by day
  const schedulesByDay = DAYS_OF_WEEK.slice(0, 5).map(day => ({
    ...day,
    schedules: schedules?.filter(s => s.day_of_week === day.value) || []
  }));

  const handleExportPDF = () => {
    if (!schedules || schedules.length === 0) {
      toast.warning("Não há horários para exportar");
      return;
    }
    generateSchedulePdf(schedules, "Quadro Semanal");
    toast.success("PDF gerado com sucesso");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quadro Semanal de Treinos</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!teams?.length}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Horário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Horário de Treino</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team">Equipa</Label>
                  <Select
                    value={formData.youth_team_id}
                    onValueChange={(value) => setFormData({ ...formData, youth_team_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar equipa" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams?.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.youth_age_groups?.name} - {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="day">Dia da Semana</Label>
                  <Select
                    value={String(formData.day_of_week)}
                    onValueChange={(value) => setFormData({ ...formData, day_of_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Hora Início</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">Hora Fim</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Local (opcional)</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Campo 1, Pavilhão"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Adicionar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!teams?.length ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Primeiro crie equipas no separador "Equipas".
            </p>
          </div>
        ) : isLoading ? (
          <p className="text-muted-foreground text-center py-8">A carregar...</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {schedulesByDay.map((day) => (
              <div key={day.value} className="space-y-2">
                <div className="text-center font-semibold text-sm py-2 bg-muted rounded-t-lg">
                  {day.label.split("-")[0]}
                </div>
                <div className="min-h-[300px] space-y-2">
                  {day.schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-2 rounded border text-xs ${getColorClass(schedule.youth_teams?.youth_age_groups?.name || "")}`}
                    >
                      <div className="font-semibold">
                        {schedule.youth_teams?.youth_age_groups?.name}
                      </div>
                      <div>{schedule.youth_teams?.name}</div>
                      <div className="mt-1">
                        {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                      </div>
                      {schedule.location && (
                        <div className="text-xs opacity-75">{schedule.location}</div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 mt-1"
                        onClick={() => deleteMutation.mutate(schedule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {day.schedules.length === 0 && (
                    <div className="text-center text-muted-foreground text-xs py-4">
                      Sem treinos
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
