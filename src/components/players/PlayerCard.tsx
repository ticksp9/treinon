import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronRight, AlertCircle, ShieldAlert, ShieldCheck, UserMinus } from 'lucide-react';
import { POSITIONS } from '@/lib/player-constants';
import {
  computeAvailability,
  getClinicalStatusOption,
  type InjuryRecord,
} from '@/lib/player-availability';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  birth_date: string | null;
  is_active: boolean;
  photo_url: string | null;
}

interface PlayerCardProps {
  player: Player;
  sportType?: string;
  injuries?: InjuryRecord[];
  /** @deprecated use injuries */
  hasActiveInjury?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  /** Season/team scoped soft-remove (keeps the player and the history). */
  onRemoveFromTeam?: () => void;
}

export function PlayerCard({ player, sportType = 'football_11', injuries = [], hasActiveInjury, onEdit, onDelete, onView, onRemoveFromTeam }: PlayerCardProps) {
  const isFutsal = sportType === 'futsal';
  const positions = isFutsal ? POSITIONS.futsal : POSITIONS.football;
  const positionLabel = positions.find(p => p.value === player.position)?.label || player.position;
  const availability = computeAvailability(injuries);
  const statusOpt = getClinicalStatusOption(availability.status);
  const showInjuredBorder = !availability.callable || hasActiveInjury;

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const age = getAge(player.birth_date);

  return (
    <Card
      className={`group hover:shadow-md transition-all cursor-pointer ${
        !player.is_active ? 'opacity-60' : ''
      } ${showInjuredBorder ? 'border-red-500/50' : ''}`}
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {player.number && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {player.number}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{player.name}</h3>
              {!availability.callable ? (
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="Indisponível" />
              ) : availability.status !== 'apto' ? (
                <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="Convocável c/ restrição" />
              ) : hasActiveInjury ? (
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {positionLabel && (
                <Badge variant="secondary" className="text-xs">{positionLabel}</Badge>
              )}
              {statusOpt && availability.status !== 'apto' && (
                <Badge variant="outline" className={`text-xs ${statusOpt.tone}`}>
                  {statusOpt.label}
                </Badge>
              )}
              {age && <span className="text-xs text-muted-foreground">{age} anos</span>}
            </div>
            {availability.restrictions && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">⚠ {availability.restrictions}</p>
            )}
            {!player.is_active && (
              <Badge variant="outline" className="mt-1 text-xs">Inativo</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="w-4 h-4" />
            </Button>
            {onRemoveFromTeam && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Remover da equipa nesta época"
                aria-label="Remover da equipa nesta época"
                onClick={(e) => { e.stopPropagation(); onRemoveFromTeam(); }}
              >
                <UserMinus className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

