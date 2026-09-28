import { Database } from '@/integrations/supabase/types';

// Row types from Supabase schema
export type Team = Database['public']['Tables']['teams']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Club = Database['public']['Tables']['clubs']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ClubStaff = Database['public']['Tables']['club_staff']['Row'];
export type MatchEvent = Database['public']['Tables']['match_events']['Row'];
export type MatchLineup = Database['public']['Tables']['match_lineups']['Row'];
export type PlayerFee = Database['public']['Tables']['player_fees']['Row'];
export type PlayerInjury = Database['public']['Tables']['player_injuries']['Row'];
export type PlayerEvaluation = Database['public']['Tables']['player_evaluations']['Row'];
export type CoachTraining = Database['public']['Tables']['coach_trainings']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type Sponsor = Database['public']['Tables']['sponsors']['Row'];
export type Championship = Database['public']['Tables']['championships']['Row'];

// Insert types
export type TeamInsert = Database['public']['Tables']['teams']['Insert'];
export type PlayerInsert = Database['public']['Tables']['players']['Insert'];
export type MatchInsert = Database['public']['Tables']['matches']['Insert'];
export type MatchEventInsert = Database['public']['Tables']['match_events']['Insert'];

// Update types
export type TeamUpdate = Database['public']['Tables']['teams']['Update'];
export type PlayerUpdate = Database['public']['Tables']['players']['Update'];
export type MatchUpdate = Database['public']['Tables']['matches']['Update'];

// Enums
export type AccountType = Database['public']['Enums']['account_type'];
export type MatchEventType = Database['public']['Enums']['match_event_type'];
export type ClubStaffRole = Database['public']['Enums']['club_staff_role'];

// App-specific derived types
export interface TeamWithCount extends Team {
  players_count?: number;
}

export interface PlayerWithTeam extends Player {
  team?: Pick<Team, 'id' | 'name' | 'sport_type' | 'gender' | 'category'> | null;
}

export interface DashboardStats {
  teamsCount: number;
  playersCount: number;
  matchesCount: number;
  upcomingMatches: number;
}

// Form payload types
export interface TeamFormData {
  name: string;
  sport_type: string;
  gender: string;
  category: string;
  season: string;
  formation: string;
}

export interface PlayerFormPayload {
  name: string;
  number?: number | null;
  position?: string | null;
  birth_date?: string | null;
  team_id: string;
  gender?: string;
  [key: string]: unknown;
}
