import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserMinus, UserPlus } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface MatchEvent {
  id: string;
  event_type: string;
  minute: number;
  second: number | null;
  player_id: string | null;
  assist_player_id: string | null;
  is_opponent: boolean;
  notes: string | null;
  player?: Player;
  assist_player?: Player;
}

interface MatchEventsProps {
  events: MatchEvent[];
  onDeleteEvent: (eventId: string) => void;
  canEdit: boolean;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  goal: <span className="text-base">⚽</span>,
  own_goal: <span className="text-base">⚽</span>,
  yellow_card: <div className="w-4 h-5 bg-yellow-400 rounded-sm shadow-sm border border-yellow-500" />,
  red_card: <div className="w-4 h-5 bg-red-600 rounded-sm shadow-sm border border-red-700" />,
  substitution_in: <UserPlus className="w-4 h-4 text-green-600" />,
  substitution_out: <UserMinus className="w-4 h-4 text-red-600" />,
};

const EVENT_LABELS: Record<string, string> = {
  goal: 'Golo',
  own_goal: 'Auto-golo',
  yellow_card: 'Cartão Amarelo',
  red_card: 'Cartão Vermelho',
  substitution_in: 'Entrou',
  substitution_out: 'Saiu',
};

export function MatchEvents({ events, onDeleteEvent, canEdit }: MatchEventsProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incidências</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Sem incidências registadas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incidências ({events.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[60vh] md:max-h-none">
          <div className="space-y-2">
            {events.map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="min-w-[50px] justify-center font-mono">
                    {event.minute}'
                  </Badge>
                  <div className="flex items-center gap-2">
                    {EVENT_ICONS[event.event_type]}
                    <span className="font-medium">
                      {EVENT_LABELS[event.event_type] || event.event_type}
                    </span>
                  </div>
                  <div className="text-sm">
                    {event.is_opponent ? (
                      <span className="text-muted-foreground">(Adversário)</span>
                    ) : event.player ? (
                      <span>
                        {event.player.number && `${event.player.number}. `}
                        {event.player.name}
                      </span>
                    ) : null}
                    {event.assist_player && (
                      <span className="text-muted-foreground ml-2">
                        (Assist: {event.assist_player.name})
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteEvent(event.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
