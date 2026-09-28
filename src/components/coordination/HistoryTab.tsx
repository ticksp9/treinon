import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Plus, 
  Pencil, 
  Trash2, 
  UserPlus, 
  UserMinus,
  Users,
  UserCog
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface HistoryTabProps {
  clubId: string;
}

interface HistoryEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, any> | null;
  performed_at: string;
  notes: string | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <Plus className="h-4 w-4 text-green-500" />,
  updated: <Pencil className="h-4 w-4 text-blue-500" />,
  deleted: <Trash2 className="h-4 w-4 text-red-500" />,
  player_added: <UserPlus className="h-4 w-4 text-green-500" />,
  player_removed: <UserMinus className="h-4 w-4 text-amber-500" />,
  coach_added: <UserCog className="h-4 w-4 text-green-500" />,
  coach_removed: <UserCog className="h-4 w-4 text-amber-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Criado',
  updated: 'Atualizado',
  deleted: 'Eliminado',
  player_added: 'Jogador adicionado',
  player_removed: 'Jogador removido',
  coach_added: 'Treinador adicionado',
  coach_removed: 'Treinador removido',
};

const ENTITY_LABELS: Record<string, string> = {
  team: 'Equipa',
  player_assignment: 'Atribuição de Jogador',
  coach_assignment: 'Atribuição de Treinador',
  age_group: 'Escalão',
};

export function HistoryTab({ clubId }: HistoryTabProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['coordination-history', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coordination_change_history')
        .select('*')
        .eq('club_id', clubId)
        .order('performed_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as HistoryEntry[];
    },
    enabled: !!clubId
  });

  const formatChanges = (changes: Record<string, any> | null): string => {
    if (!changes) return '';
    
    const parts: string[] = [];
    
    if (changes.player_name) {
      parts.push(changes.player_name);
    }
    if (changes.coach_name) {
      parts.push(changes.coach_name);
    }
    if (changes.team_name) {
      parts.push(`Equipa: ${changes.team_name}`);
    }
    if (changes.role) {
      parts.push(`Função: ${changes.role}`);
    }
    if (changes.from && changes.to) {
      parts.push(`De "${changes.from}" para "${changes.to}"`);
    }
    
    return parts.join(' • ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">A carregar...</p>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Ainda não há registos no histórico.</p>
            <p className="text-sm text-muted-foreground mt-2">
              As alterações a equipas, jogadores e treinadores serão registadas aqui.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {history.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">
                    {ACTION_ICONS[entry.action] || <History className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                      </Badge>
                      <Badge 
                        variant={entry.action.includes('removed') || entry.action === 'deleted' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Badge>
                    </div>
                    
                    {entry.changes && (
                      <p className="text-sm mt-1 text-foreground">
                        {formatChanges(entry.changes)}
                      </p>
                    )}
                    
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {entry.notes}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(entry.performed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
