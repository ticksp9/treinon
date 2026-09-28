import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OverduePlayer {
  playerId: string;
  monthsOverdue: number;
  totalAmount: number;
}

export function useOverduePlayersBlock(clubId: string | undefined) {
  return useQuery({
    queryKey: ['overdue-players-block', clubId],
    queryFn: async () => {
      if (!clubId) return new Set<string>();
      
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      // Get all unpaid fees
      const { data: unpaidFees, error } = await supabase
        .from('player_fees')
        .select('player_id, month, year, amount')
        .eq('club_id', clubId)
        .eq('is_paid', false);
      
      if (error) throw error;
      
      // Group by player and count overdue months
      const playerOverdue: Record<string, OverduePlayer> = {};
      
      unpaidFees?.forEach(fee => {
        // Calculate months overdue
        const monthsDiff = (currentYear - fee.year) * 12 + (currentMonth - fee.month);
        
        if (monthsDiff >= 2) {
          const playerId = fee.player_id;
          if (!playerOverdue[playerId]) {
            playerOverdue[playerId] = {
              playerId,
              monthsOverdue: 0,
              totalAmount: 0
            };
          }
          playerOverdue[playerId].monthsOverdue++;
          playerOverdue[playerId].totalAmount += fee.amount;
        }
      });
      
      // Return set of blocked player IDs
      return new Set(Object.keys(playerOverdue));
    },
    enabled: !!clubId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useIsPlayerBlocked(playerId: string, clubId: string | undefined) {
  const { data: blockedPlayers } = useOverduePlayersBlock(clubId);
  return blockedPlayers?.has(playerId) || false;
}
