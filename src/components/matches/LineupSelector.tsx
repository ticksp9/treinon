import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Users, Play, Star, UserMinus, UserX } from 'lucide-react';
import { getSportFormatRules } from '@/lib/match-playing-time';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface Lineup {
  id: string;
  player_id: string;
  is_starter: boolean;
  minutes_played: number | null;
  position_played: string | null;
  player: Player;
}

interface LineupSelectorProps {
  matchId: string;
  teamId: string;
  lineups: Lineup[];
  onLineupsChange: () => void;
  onStartMatch: () => void;
  isHalftime?: boolean;
  isEditing?: boolean;
  sportType?: string | null;
  /** the substitute did not come to the match: take him out (asks the reason) */
  onAbsent?: (playerId: string) => void;
  /** who can still be taken out; omitted = every substitute (before kick-off) */
  absentable?: Set<string>;
}

// Position categories for grouping
const POSITION_CATEGORIES = {
  goalkeeper: ['GK'],
  defense: ['CB', 'LB', 'RB', 'FIX'],
  midfield: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'ALA'],
  attack: ['LW', 'RW', 'CF', 'ST', 'PIV', 'UNI'],
};

const POSITION_CATEGORY_LABELS: Record<string, string> = {
  goalkeeper: 'Guarda-Redes',
  defense: 'Defesas',
  midfield: 'Médios',
  attack: 'Atacantes',
  other: 'Outros',
};

export function LineupSelector({ matchId, teamId, lineups, onLineupsChange, onStartMatch, isHalftime = false, isEditing = false, sportType, onAbsent, absentable }: LineupSelectorProps) {
  const { user } = useAuth();
  const [selectedStarters, setSelectedStarters] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const sportRules = getSportFormatRules(sportType);

  useEffect(() => {
    // Initialize starters from lineups
    const starters = new Set(lineups.filter(l => l.is_starter).map(l => l.player_id));
    setSelectedStarters(starters);
  }, [lineups]);

  const getPositionCategory = (position: string | null): string => {
    if (!position) return 'other';
    for (const [category, positions] of Object.entries(POSITION_CATEGORIES)) {
      if (positions.includes(position)) return category;
    }
    return 'other';
  };

  const groupPlayersByPosition = () => {
    const groups: Record<string, Lineup[]> = {
      goalkeeper: [],
      defense: [],
      midfield: [],
      attack: [],
      other: [],
    };

    lineups.forEach(lineup => {
      const category = getPositionCategory(lineup.player?.position);
      groups[category].push(lineup);
    });

    // Sort by number
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.player?.number || 99) - (b.player?.number || 99));
    });

    return groups;
  };

  const toggleStarter = async (playerId: string) => {
    if (!user) return;

    const lineup = lineups.find(l => l.player_id === playerId);
    if (!lineup) return;

    setSaving(true);
    try {
      const newIsStarter = !selectedStarters.has(playerId);

      if (newIsStarter && selectedStarters.size >= sportRules.playersOnField) {
        toast.error(`Escalação inválida: máximo de ${sportRules.playersOnField} jogadores titulares no ${sportRules.label}.`);
        return;
      }

      const { error } = await supabase
        .from('match_lineups')
        .update({ is_starter: newIsStarter })
        .eq('id', lineup.id);

      if (error) throw error;

      setSelectedStarters(prev => {
        const next = new Set(prev);
        if (newIsStarter) {
          next.add(playerId);
        } else {
          next.delete(playerId);
        }
        return next;
      });

      onLineupsChange();
    } catch (error) {
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const setAllAsStarters = async (playerIds: string[]) => {
    if (!user) return;
    setSaving(true);
    try {
      if (playerIds.length > sportRules.playersOnField) {
        toast.error(`Escalação inválida: máximo de ${sportRules.playersOnField} jogadores titulares no ${sportRules.label}.`);
        return;
      }

      for (const playerId of playerIds) {
        const lineup = lineups.find(l => l.player_id === playerId);
        if (lineup && !selectedStarters.has(playerId)) {
          await supabase
            .from('match_lineups')
            .update({ is_starter: true })
            .eq('id', lineup.id);
        }
      }
      setSelectedStarters(new Set(playerIds));
      onLineupsChange();
      toast.success('Titulares definidos!');
    } catch (error) {
      toast.error('Erro ao definir titulares');
    } finally {
      setSaving(false);
    }
  };

  const clearStarters = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const lineup of lineups) {
        await supabase
          .from('match_lineups')
          .update({ is_starter: false })
          .eq('id', lineup.id);
      }
      setSelectedStarters(new Set());
      onLineupsChange();
    } catch (error) {
      toast.error('Erro ao limpar titulares');
    } finally {
      setSaving(false);
    }
  };

  const groupedPlayers = groupPlayersByPosition();
  const starterCount = selectedStarters.size;
  const substituteCount = lineups.length - starterCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Selecionar Titulares e Suplentes
        </CardTitle>
        <CardDescription>
          Clique num jogador para alternar entre titular e suplente · Máximo em campo: {sportRules.playersOnField}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {lineups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum jogador convocado para este jogo.
            Vá à secção de Treino &gt; Convocatórias para adicionar jogadores.
          </p>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="font-medium">Titulares: {starterCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <span className="font-medium">Suplentes: {substituteCount}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearStarters}
                  disabled={saving || starterCount === 0}
                >
                  Limpar
                </Button>
              </div>
            </div>

            {/* Titulares Section */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-primary">
                <Star className="w-4 h-4" />
                TITULARES ({starterCount})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {lineups
                  .filter(l => selectedStarters.has(l.player_id))
                  .sort((a, b) => (a.player?.number || 99) - (b.player?.number || 99))
                  .map(lineup => (
                    <div
                      key={lineup.id}
                      onClick={() => toggleStarter(lineup.player_id)}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all bg-primary/10 border-2 border-primary hover:bg-primary/20"
                    >
                      <Badge className="min-w-[40px] justify-center">
                        {lineup.player?.number || '-'}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lineup.player?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {lineup.player?.position || 'Sem posição'}
                        </div>
                      </div>
                      <Star className="w-4 h-4 text-primary" />
                    </div>
                  ))}
              </div>
              {starterCount === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  Clique nos jogadores abaixo para os definir como titulares
                </p>
              )}
            </div>

            <Separator />

            {/* Suplentes Section */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
                <UserMinus className="w-4 h-4" />
                SUPLENTES ({substituteCount})
              </h4>
              {Object.entries(groupedPlayers)
                .filter(([_, players]) => players.some(l => !selectedStarters.has(l.player_id)))
                .map(([category, players]) => {
                  const subs = players.filter(l => !selectedStarters.has(l.player_id));
                  if (subs.length === 0) return null;

                  return (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {POSITION_CATEGORY_LABELS[category]}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {subs.map(lineup => (
                          <div
                            key={lineup.id}
                            onClick={() => toggleStarter(lineup.player_id)}
                            className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all bg-secondary/30 border-2 border-transparent hover:border-primary/30 hover:bg-secondary/50"
                          >
                            <Badge variant="outline" className="min-w-[40px] justify-center">
                              {lineup.player?.number || '-'}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{lineup.player?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {lineup.player?.position || 'Sem posição'}
                              </div>
                            </div>
                            {onAbsent && (!absentable || absentable.has(lineup.player_id)) && (
                              <Button
                                type="button" size="icon" variant="ghost"
                                className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                onClick={(e) => { e.stopPropagation(); onAbsent(lineup.player_id); }}
                                aria-label={`${lineup.player?.name ?? 'Jogador'} está ausente: retirar do jogo`} title="Não veio ao jogo: retirar"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            <Separator />

            <Button
              onClick={onStartMatch}
              className="w-full"
              size="lg"
              disabled={starterCount === 0 || saving}
            >
              <Play className="w-5 h-5 mr-2" />
              {isEditing
                ? `Confirmar Alterações (${starterCount} titulares)`
                : isHalftime
                  ? `Iniciar 2ª Parte (${starterCount} titulares, ${substituteCount} suplentes)`
                  : `Iniciar Jogo (${starterCount} titulares, ${substituteCount} suplentes)`
              }
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
