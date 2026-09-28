export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      academy_age_groups: {
        Row: {
          club_id: string
          code: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          max_birth_year: number | null
          min_birth_year: number | null
          name: string
          notes: string | null
          phase: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          max_birth_year?: number | null
          min_birth_year?: number | null
          name: string
          notes?: string | null
          phase?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          max_birth_year?: number | null
          min_birth_year?: number | null
          name?: string
          notes?: string | null
          phase?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_age_groups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_assessment_cycles: {
        Row: {
          academy_program_id: string | null
          age_group_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          cycle_type: string
          deadline: string | null
          id: string
          name: string
          notes: string | null
          period_end: string
          period_start: string
          season: string | null
          season_id: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          academy_program_id?: string | null
          age_group_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          cycle_type: string
          deadline?: string | null
          id?: string
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          academy_program_id?: string | null
          age_group_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          cycle_type?: string
          deadline?: string | null
          id?: string
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_assessment_cycles_academy_program_id_fkey"
            columns: ["academy_program_id"]
            isOneToOne: false
            referencedRelation: "academy_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_assessment_cycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_assessment_scores: {
        Row: {
          assessment_id: string
          comments: string | null
          created_at: string
          dimension_id: string
          id: string
          max_score: number | null
          score: number | null
        }
        Insert: {
          assessment_id: string
          comments?: string | null
          created_at?: string
          dimension_id: string
          id?: string
          max_score?: number | null
          score?: number | null
        }
        Update: {
          assessment_id?: string
          comments?: string | null
          created_at?: string
          dimension_id?: string
          id?: string
          max_score?: number | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_assessment_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "academy_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessment_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "academy_development_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_assessments: {
        Row: {
          areas_to_develop: string | null
          assessor_role: string | null
          assessor_user_id: string | null
          attitude: string | null
          club_id: string
          competitive_capacity: string | null
          consistency: string | null
          created_at: string
          cycle_id: string
          discipline: string | null
          general_comments: string | null
          id: string
          metadata: Json | null
          notes: string | null
          overall_score: number | null
          perceived_potential: string | null
          player_id: string
          promotion_readiness: string | null
          status: string
          strengths: string | null
          submitted_at: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          areas_to_develop?: string | null
          assessor_role?: string | null
          assessor_user_id?: string | null
          attitude?: string | null
          club_id: string
          competitive_capacity?: string | null
          consistency?: string | null
          created_at?: string
          cycle_id: string
          discipline?: string | null
          general_comments?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          overall_score?: number | null
          perceived_potential?: string | null
          player_id: string
          promotion_readiness?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          areas_to_develop?: string | null
          assessor_role?: string | null
          assessor_user_id?: string | null
          attitude?: string | null
          club_id?: string
          competitive_capacity?: string | null
          consistency?: string | null
          created_at?: string
          cycle_id?: string
          discipline?: string | null
          general_comments?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          overall_score?: number | null
          perceived_potential?: string | null
          player_id?: string
          promotion_readiness?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_assessments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "academy_assessment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_audit_logs: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_compliance_items: {
        Row: {
          club_id: string
          created_at: string
          description: string
          due_date: string | null
          evidence_url: string | null
          id: string
          item_type: string
          notes: string | null
          resolved_at: string | null
          responsible_user_id: string | null
          season: string | null
          season_id: string | null
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          description: string
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          item_type: string
          notes?: string | null
          resolved_at?: string | null
          responsible_user_id?: string | null
          season?: string | null
          season_id?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          item_type?: string
          notes?: string | null
          resolved_at?: string | null
          responsible_user_id?: string | null
          season?: string | null
          season_id?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_compliance_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_compliance_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_compliance_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_compliance_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      academy_development_dimensions: {
        Row: {
          category: string
          club_id: string
          code: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          name: string
          weight: number | null
        }
        Insert: {
          category: string
          club_id: string
          code: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name: string
          weight?: number | null
        }
        Update: {
          category?: string
          club_id?: string
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_development_dimensions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_development_goals: {
        Row: {
          created_at: string
          description: string | null
          dimension_id: string | null
          id: string
          notes: string | null
          plan_id: string
          priority: string | null
          progress_pct: number | null
          status: string
          success_criteria: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          priority?: string | null
          progress_pct?: number | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          priority?: string | null
          progress_pct?: number | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_development_goals_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "academy_development_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_development_goals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "academy_development_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_development_plans: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          overall_objective: string | null
          player_id: string
          responsible_user_id: string | null
          season: string | null
          season_id: string | null
          status: string
          updated_at: string
          version_no: number
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          overall_objective?: string | null
          player_id: string
          responsible_user_id?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          version_no?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          overall_objective?: string | null
          player_id?: string
          responsible_user_id?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_development_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_development_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_development_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_development_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_development_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_development_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      academy_goal_reviews: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          new_strategy: string | null
          notes: string | null
          obstacles: string | null
          progress_pct: number | null
          review_date: string
          reviewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          new_strategy?: string | null
          notes?: string | null
          obstacles?: string | null
          progress_pct?: number | null
          review_date?: string
          reviewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          new_strategy?: string | null
          notes?: string | null
          obstacles?: string | null
          progress_pct?: number | null
          review_date?: string
          reviewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_goal_reviews_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "academy_development_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_observations: {
        Row: {
          club_id: string
          content: string
          context: string | null
          created_at: string
          dimension_observed: string | null
          follow_up: boolean | null
          id: string
          notes: string | null
          observation_date: string
          observer_user_id: string | null
          player_id: string
          recommendation: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          club_id: string
          content: string
          context?: string | null
          created_at?: string
          dimension_observed?: string | null
          follow_up?: boolean | null
          id?: string
          notes?: string | null
          observation_date?: string
          observer_user_id?: string | null
          player_id: string
          recommendation?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          content?: string
          context?: string | null
          created_at?: string
          dimension_observed?: string | null
          follow_up?: boolean | null
          id?: string
          notes?: string | null
          observation_date?: string
          observer_user_id?: string | null
          player_id?: string
          recommendation?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_observations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_observations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_observations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_pathway_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          club_id: string
          id: string
          new_status: string
          notes: string | null
          player_id: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          club_id: string
          id?: string
          new_status: string
          notes?: string | null
          player_id: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          club_id?: string
          id?: string
          new_status?: string
          notes?: string | null
          player_id?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_pathway_status_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_pathway_status_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_pathway_status_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_player_profiles: {
        Row: {
          academy_program_id: string | null
          age_group_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dominant_foot: string | null
          entry_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          origin: string | null
          pathway_status: string
          player_id: string
          previous_clubs: string | null
          primary_position: string | null
          safeguarding_flags: string | null
          season: string | null
          season_id: string | null
          secondary_position: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academy_program_id?: string | null
          age_group_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dominant_foot?: string | null
          entry_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          origin?: string | null
          pathway_status?: string
          player_id: string
          previous_clubs?: string | null
          primary_position?: string | null
          safeguarding_flags?: string | null
          season?: string | null
          season_id?: string | null
          secondary_position?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academy_program_id?: string | null
          age_group_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dominant_foot?: string | null
          entry_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          origin?: string | null
          pathway_status?: string
          player_id?: string
          previous_clubs?: string | null
          primary_position?: string | null
          safeguarding_flags?: string | null
          season?: string | null
          season_id?: string | null
          secondary_position?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_player_profiles_academy_program_id_fkey"
            columns: ["academy_program_id"]
            isOneToOne: false
            referencedRelation: "academy_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_player_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      academy_player_school_records: {
        Row: {
          academic_status: string | null
          club_id: string
          conflict_flags: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          observations: string | null
          player_id: string
          school_name: string | null
          school_schedule: string | null
          school_year: string | null
          season: string | null
          season_id: string | null
          updated_at: string
        }
        Insert: {
          academic_status?: string | null
          club_id: string
          conflict_flags?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          observations?: string | null
          player_id: string
          school_name?: string | null
          school_schedule?: string | null
          school_year?: string | null
          season?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_status?: string | null
          club_id?: string
          conflict_flags?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          observations?: string | null
          player_id?: string
          school_name?: string | null
          school_schedule?: string | null
          school_year?: string | null
          season?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_player_school_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_school_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_school_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_school_records_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_school_records_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_player_school_records_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      academy_player_wellbeing_records: {
        Row: {
          category: string | null
          club_id: string
          created_at: string
          description: string | null
          follow_up_notes: string | null
          follow_up_required: boolean | null
          id: string
          notes: string | null
          player_id: string
          record_date: string
          reported_by: string | null
          resolved_at: string | null
          safeguarding_flag: boolean | null
          updated_at: string
          wellbeing_status: string | null
        }
        Insert: {
          category?: string | null
          club_id: string
          created_at?: string
          description?: string | null
          follow_up_notes?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          player_id: string
          record_date?: string
          reported_by?: string | null
          resolved_at?: string | null
          safeguarding_flag?: boolean | null
          updated_at?: string
          wellbeing_status?: string | null
        }
        Update: {
          category?: string | null
          club_id?: string
          created_at?: string
          description?: string | null
          follow_up_notes?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          player_id?: string
          record_date?: string
          reported_by?: string | null
          resolved_at?: string | null
          safeguarding_flag?: boolean | null
          updated_at?: string
          wellbeing_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_player_wellbeing_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_wellbeing_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_player_wellbeing_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_programs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          club_id: string
          created_at: string
          created_by: string | null
          curriculum_summary: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          metadata: Json | null
          methodology: string | null
          name: string
          notes: string | null
          objectives: string | null
          philosophy: string | null
          responsible_user_id: string | null
          review_process: string | null
          safeguarding_policy: string | null
          season: string | null
          season_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          curriculum_summary?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          metadata?: Json | null
          methodology?: string | null
          name: string
          notes?: string | null
          objectives?: string | null
          philosophy?: string | null
          responsible_user_id?: string | null
          review_process?: string | null
          safeguarding_policy?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_no?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          curriculum_summary?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          metadata?: Json | null
          methodology?: string | null
          name?: string
          notes?: string | null
          objectives?: string | null
          philosophy?: string | null
          responsible_user_id?: string | null
          review_process?: string | null
          safeguarding_policy?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_programs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      academy_promotion_reviews: {
        Row: {
          assessment_cycle_id: string | null
          club_id: string
          created_at: string
          current_age_group_id: string | null
          current_team_id: string | null
          decided_by: string | null
          decision: string
          evidence: string | null
          id: string
          justification: string | null
          metadata: Json | null
          notes: string | null
          player_id: string
          review_date: string
          risks: string | null
          season: string | null
          season_id: string | null
          staff_involved: string[] | null
          target_age_group_id: string | null
          target_team_id: string | null
          transition_plan: string | null
          updated_at: string
        }
        Insert: {
          assessment_cycle_id?: string | null
          club_id: string
          created_at?: string
          current_age_group_id?: string | null
          current_team_id?: string | null
          decided_by?: string | null
          decision: string
          evidence?: string | null
          id?: string
          justification?: string | null
          metadata?: Json | null
          notes?: string | null
          player_id: string
          review_date?: string
          risks?: string | null
          season?: string | null
          season_id?: string | null
          staff_involved?: string[] | null
          target_age_group_id?: string | null
          target_team_id?: string | null
          transition_plan?: string | null
          updated_at?: string
        }
        Update: {
          assessment_cycle_id?: string | null
          club_id?: string
          created_at?: string
          current_age_group_id?: string | null
          current_team_id?: string | null
          decided_by?: string | null
          decision?: string
          evidence?: string | null
          id?: string
          justification?: string | null
          metadata?: Json | null
          notes?: string | null
          player_id?: string
          review_date?: string
          risks?: string | null
          season?: string | null
          season_id?: string | null
          staff_involved?: string[] | null
          target_age_group_id?: string | null
          target_team_id?: string | null
          transition_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_promotion_reviews_assessment_cycle_id_fkey"
            columns: ["assessment_cycle_id"]
            isOneToOne: false
            referencedRelation: "academy_assessment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_current_age_group_id_fkey"
            columns: ["current_age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_target_age_group_id_fkey"
            columns: ["target_age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_promotion_reviews_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_staff_assignments: {
        Row: {
          age_group_id: string | null
          club_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          license_number: string | null
          license_valid_until: string | null
          notes: string | null
          qualification: string | null
          role: string
          season: string | null
          season_id: string | null
          start_date: string | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group_id?: string | null
          club_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          license_valid_until?: string | null
          notes?: string | null
          qualification?: string | null
          role: string
          season?: string | null
          season_id?: string | null
          start_date?: string | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group_id?: string | null
          club_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          license_valid_until?: string | null
          notes?: string | null
          qualification?: string | null
          role?: string
          season?: string | null
          season_id?: string | null
          start_date?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_staff_assignments_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_staff_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_staff_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_staff_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_staff_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "academy_staff_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      access_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          club_id: string | null
          created_at: string
          created_by: string
          delivery_channels: string[] | null
          delivery_method: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string | null
          invite_token_hash: string
          invite_type: string
          metadata: Json | null
          owner_coach_id: string | null
          phone: string | null
          player_id: string | null
          recipient_name: string
          scope_type: string
          sent_at: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by: string
          delivery_channels?: string[] | null
          delivery_method?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          invite_token_hash: string
          invite_type: string
          metadata?: Json | null
          owner_coach_id?: string | null
          phone?: string | null
          player_id?: string | null
          recipient_name: string
          scope_type?: string
          sent_at?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string
          delivery_channels?: string[] | null
          delivery_method?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          invite_token_hash?: string
          invite_type?: string
          metadata?: Json | null
          owner_coach_id?: string | null
          phone?: string | null
          player_id?: string | null
          recipient_name?: string
          scope_type?: string
          sent_at?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          action_type: string
          actor_user_id: string
          approval_instance_id: string
          comment: string | null
          created_at: string
          id: string
          step_id: string | null
        }
        Insert: {
          action_type?: string
          actor_user_id: string
          approval_instance_id: string
          comment?: string | null
          created_at?: string
          id?: string
          step_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          approval_instance_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_approval_instance_id_fkey"
            columns: ["approval_instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "approval_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_instances: {
        Row: {
          club_id: string
          current_step: number | null
          entity_id: string
          entity_type: string
          final_decision_at: string | null
          final_decision_by: string | null
          id: string
          status: string
          submitted_at: string | null
          submitted_by: string
          workflow_id: string | null
        }
        Insert: {
          club_id: string
          current_step?: number | null
          entity_id: string
          entity_type: string
          final_decision_at?: string | null
          final_decision_by?: string | null
          id?: string
          status?: string
          submitted_at?: string | null
          submitted_by: string
          workflow_id?: string | null
        }
        Update: {
          club_id?: string
          current_step?: number | null
          entity_id?: string
          entity_type?: string
          final_decision_at?: string | null
          final_decision_by?: string | null
          id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_instances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          amount_max: number | null
          amount_min: number | null
          approver_role: string | null
          approver_user_id: string | null
          escalation_days: number | null
          id: string
          is_active: boolean | null
          requires_all: boolean | null
          step_order: number
          workflow_id: string
        }
        Insert: {
          amount_max?: number | null
          amount_min?: number | null
          approver_role?: string | null
          approver_user_id?: string | null
          escalation_days?: number | null
          id?: string
          is_active?: boolean | null
          requires_all?: boolean | null
          step_order?: number
          workflow_id: string
        }
        Update: {
          amount_max?: number | null
          amount_min?: number | null
          approver_role?: string | null
          approver_user_id?: string | null
          escalation_days?: number | null
          id?: string
          is_active?: boolean | null
          requires_all?: boolean | null
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_active: boolean | null
          rules_json: Json | null
          updated_at: string
          workflow_name: string
          workflow_scope: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          rules_json?: Json | null
          updated_at?: string
          workflow_name: string
          workflow_scope?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          rules_json?: Json | null
          updated_at?: string
          workflow_name?: string
          workflow_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          asset_type: string
          club_id: string | null
          code: string
          created_at: string | null
          depreciable: boolean | null
          id: string
          is_active: boolean | null
          name: string
          requires_assignment: boolean | null
          requires_maintenance: boolean | null
          requires_serial: boolean | null
          requires_validity_control: boolean | null
          updated_at: string | null
        }
        Insert: {
          asset_type?: string
          club_id?: string | null
          code: string
          created_at?: string | null
          depreciable?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_assignment?: boolean | null
          requires_maintenance?: boolean | null
          requires_serial?: boolean | null
          requires_validity_control?: boolean | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string
          club_id?: string | null
          code?: string
          created_at?: string | null
          depreciable?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_assignment?: boolean | null
          requires_maintenance?: boolean | null
          requires_serial?: boolean | null
          requires_validity_control?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          approved_by: string | null
          asset_item_id: string
          club_id: string
          created_at: string | null
          disposal_date: string | null
          disposal_type: string
          id: string
          notes: string | null
          proceeds_amount: number | null
          reason: string | null
        }
        Insert: {
          approved_by?: string | null
          asset_item_id: string
          club_id: string
          created_at?: string | null
          disposal_date?: string | null
          disposal_type: string
          id?: string
          notes?: string | null
          proceeds_amount?: number | null
          reason?: string | null
        }
        Update: {
          approved_by?: string | null
          asset_item_id?: string
          club_id?: string
          created_at?: string | null
          disposal_date?: string | null
          disposal_type?: string
          id?: string
          notes?: string | null
          proceeds_amount?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_documents: {
        Row: {
          asset_item_id: string
          created_at: string | null
          document_type: string
          file_url: string | null
          id: string
          notes: string | null
          season_id: string | null
          status: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          asset_item_id: string
          created_at?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          notes?: string | null
          season_id?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          asset_item_id?: string
          created_at?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          season_id?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "asset_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      asset_items: {
        Row: {
          acquisition_cost: number | null
          acquisition_date: string | null
          asset_code: string
          asset_status: string
          barcode_qr: string | null
          brand: string | null
          category_id: string | null
          club_id: string
          cost_center_id: string | null
          created_at: string | null
          current_location_id: string | null
          current_responsible_person_id: string | null
          depreciation_method: string | null
          description: string | null
          id: string
          linked_team_id: string | null
          model: string | null
          name: string
          notes: string | null
          ownership_type: string | null
          residual_value: number | null
          season: string | null
          season_id: string | null
          serial_number: string | null
          supplier_id: string | null
          updated_at: string | null
          useful_life_months: number | null
          warranty_until: string | null
        }
        Insert: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          asset_code: string
          asset_status?: string
          barcode_qr?: string | null
          brand?: string | null
          category_id?: string | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string | null
          current_location_id?: string | null
          current_responsible_person_id?: string | null
          depreciation_method?: string | null
          description?: string | null
          id?: string
          linked_team_id?: string | null
          model?: string | null
          name: string
          notes?: string | null
          ownership_type?: string | null
          residual_value?: number | null
          season?: string | null
          season_id?: string | null
          serial_number?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          useful_life_months?: number | null
          warranty_until?: string | null
        }
        Update: {
          acquisition_cost?: number | null
          acquisition_date?: string | null
          asset_code?: string
          asset_status?: string
          barcode_qr?: string | null
          brand?: string | null
          category_id?: string | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          current_location_id?: string | null
          current_responsible_person_id?: string | null
          depreciation_method?: string | null
          description?: string | null
          id?: string
          linked_team_id?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          ownership_type?: string | null
          residual_value?: number | null
          season?: string | null
          season_id?: string | null
          serial_number?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          useful_life_months?: number | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_linked_team_id_fkey"
            columns: ["linked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "asset_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "asset_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_logs: {
        Row: {
          asset_item_id: string
          club_id: string
          cost: number | null
          created_at: string | null
          findings: string | null
          id: string
          maintenance_plan_id: string | null
          maintenance_type: string
          next_due_date: string | null
          notes: string | null
          performed_by: string | null
          performed_date: string | null
          scheduled_date: string | null
          season_id: string | null
          status: string | null
          vendor_id: string | null
        }
        Insert: {
          asset_item_id: string
          club_id: string
          cost?: number | null
          created_at?: string | null
          findings?: string | null
          id?: string
          maintenance_plan_id?: string | null
          maintenance_type: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_date?: string | null
          scheduled_date?: string | null
          season_id?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Update: {
          asset_item_id?: string
          club_id?: string
          cost?: number | null
          created_at?: string | null
          findings?: string | null
          id?: string
          maintenance_plan_id?: string | null
          maintenance_type?: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_date?: string | null
          scheduled_date?: string | null
          season_id?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_logs_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "asset_maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_plans: {
        Row: {
          asset_item_id: string | null
          category_id: string | null
          checklist_json: Json | null
          club_id: string
          created_at: string | null
          frequency_type: string | null
          frequency_value: number | null
          id: string
          is_active: boolean | null
          maintenance_type: string
          responsible_role: string | null
        }
        Insert: {
          asset_item_id?: string | null
          category_id?: string | null
          checklist_json?: Json | null
          club_id: string
          created_at?: string | null
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          is_active?: boolean | null
          maintenance_type?: string
          responsible_role?: string | null
        }
        Update: {
          asset_item_id?: string | null
          category_id?: string | null
          checklist_json?: Json | null
          club_id?: string
          created_at?: string | null
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          is_active?: boolean | null
          maintenance_type?: string
          responsible_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_plans_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_kit_assignments: {
        Row: {
          athlete_id: string
          club_id: string
          created_at: string | null
          id: string
          issue_date: string | null
          item_description: string
          notes: string | null
          quantity: number | null
          return_date: string | null
          return_expected: string | null
          season: string | null
          season_id: string | null
          size: string | null
          status: string | null
        }
        Insert: {
          athlete_id: string
          club_id: string
          created_at?: string | null
          id?: string
          issue_date?: string | null
          item_description: string
          notes?: string | null
          quantity?: number | null
          return_date?: string | null
          return_expected?: string | null
          season?: string | null
          season_id?: string | null
          size?: string | null
          status?: string | null
        }
        Update: {
          athlete_id?: string
          club_id?: string
          created_at?: string | null
          id?: string
          issue_date?: string | null
          item_description?: string
          notes?: string | null
          quantity?: number | null
          return_date?: string | null
          return_expected?: string | null
          season?: string | null
          season_id?: string | null
          size?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_kit_assignments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_kit_assignments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_kit_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_kit_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_kit_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "athlete_kit_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      attendance_requests: {
        Row: {
          channel_id: string | null
          club_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          event_date: string | null
          event_title: string
          event_type: string
          id: string
          notes: string | null
          related_match_id: string | null
          related_training_id: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          event_date?: string | null
          event_title: string
          event_type?: string
          id?: string
          notes?: string | null
          related_match_id?: string | null
          related_training_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          club_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          event_date?: string | null
          event_title?: string
          event_type?: string
          id?: string
          notes?: string | null
          related_match_id?: string | null
          related_training_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_requests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_related_training_id_fkey"
            columns: ["related_training_id"]
            isOneToOne: false
            referencedRelation: "coach_trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          player_id: string | null
          request_id: string
          responded_at: string | null
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          request_id: string
          responded_at?: string | null
          response?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          player_id?: string | null
          request_id?: string
          responded_at?: string | null
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "attendance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_label: string
          bank_name: string
          bic: string | null
          club_id: string
          created_at: string
          iban_masked: string | null
          id: string
          is_active: boolean
          is_default: boolean
          updated_at: string
        }
        Insert: {
          account_label: string
          bank_name: string
          bic?: string | null
          club_id: string
          created_at?: string
          iban_masked?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          account_label?: string
          bank_name?: string
          bic?: string | null
          club_id?: string
          created_at?: string
          iban_masked?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_statement_line_id: string
          charge_id: string | null
          club_id: string
          confidence_score: number | null
          created_at: string
          id: string
          match_type: string
          notes: string | null
          payment_transaction_id: string | null
          reconciled_amount: number
          reconciled_at: string | null
          reconciled_by: string | null
          updated_at: string
        }
        Insert: {
          bank_statement_line_id: string
          charge_id?: string | null
          club_id: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_type?: string
          notes?: string | null
          payment_transaction_id?: string | null
          reconciled_amount: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          updated_at?: string
        }
        Update: {
          bank_statement_line_id?: string
          charge_id?: string | null
          club_id?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_type?: string
          notes?: string | null
          payment_transaction_id?: string | null
          reconciled_amount?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_statement_line_id_fkey"
            columns: ["bank_statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          bank_account_id: string | null
          club_id: string
          created_at: string
          file_format: string
          file_name: string | null
          id: string
          import_status: string
          imported_at: string | null
          imported_by: string | null
          matched_count: number | null
          metadata: Json | null
          period_end: string | null
          period_start: string | null
          row_count: number | null
          source_type: string
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          club_id: string
          created_at?: string
          file_format?: string
          file_name?: string | null
          id?: string
          import_status?: string
          imported_at?: string | null
          imported_by?: string | null
          matched_count?: number | null
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          row_count?: number | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          club_id?: string
          created_at?: string
          file_format?: string
          file_name?: string | null
          id?: string
          import_status?: string
          imported_at?: string | null
          imported_by?: string | null
          matched_count?: number | null
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          row_count?: number | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string | null
          bank_reference: string | null
          booking_date: string
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          debit_credit: string
          end_to_end_reference: string | null
          id: string
          import_id: string
          raw_line_payload: Json | null
          reconciliation_status: string
          remittance_info: string | null
          transaction_code: string | null
          value_date: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id?: string | null
          bank_reference?: string | null
          booking_date: string
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          debit_credit?: string
          end_to_end_reference?: string | null
          id?: string
          import_id: string
          raw_line_payload?: Json | null
          reconciliation_status?: string
          remittance_info?: string | null
          transaction_code?: string | null
          value_date?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string | null
          bank_reference?: string | null
          booking_date?: string
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          debit_credit?: string
          end_to_end_reference?: string | null
          id?: string
          import_id?: string
          raw_line_payload?: Json | null
          reconciliation_status?: string
          remittance_info?: string | null
          transaction_code?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_alerts: {
        Row: {
          alert_type: string
          channel: string
          charge_id: string | null
          club_id: string
          created_at: string
          guardian_id: string | null
          id: string
          metadata: Json | null
          player_id: string | null
          recipient_user_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_type: string
          channel?: string
          charge_id?: string | null
          club_id: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          metadata?: Json | null
          player_id?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_type?: string
          channel?: string
          charge_id?: string | null
          club_id?: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          metadata?: Json | null
          player_id?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_alerts_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_alerts_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_alerts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_alerts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_profiles: {
        Row: {
          billing_address: string | null
          created_at: string
          id: string
          nif: string | null
          notes: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: string | null
          created_at?: string
          id?: string
          nif?: string | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: string | null
          created_at?: string
          id?: string
          nif?: string | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          budget_cycle_id: string | null
          club_id: string
          created_at: string | null
          current_value: number | null
          id: string
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          threshold_value: number | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          budget_cycle_id?: string | null
          club_id: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          threshold_value?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          budget_cycle_id?: string | null
          club_id?: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          threshold_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_budget_cycle_id_fkey"
            columns: ["budget_cycle_id"]
            isOneToOne: false
            referencedRelation: "budget_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_audit_logs: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          club_id: string | null
          code: string
          created_at: string | null
          default_cost_center_id: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          code: string
          created_at?: string | null
          default_cost_center_id?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          code?: string
          created_at?: string | null
          default_cost_center_id?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_cost_centers: {
        Row: {
          club_id: string
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          linked_team_id: string | null
          name: string
          parent_cost_center_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linked_team_id?: string | null
          name: string
          parent_cost_center_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linked_team_id?: string | null
          name?: string
          parent_cost_center_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_cost_centers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cost_centers_linked_team_id_fkey"
            columns: ["linked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cost_centers_parent_cost_center_id_fkey"
            columns: ["parent_cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_cycles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_scope: string | null
          club_id: string
          created_at: string | null
          created_by: string
          end_date: string
          fiscal_year: number | null
          id: string
          name: string
          parent_budget_cycle_id: string | null
          season: string
          season_id: string | null
          start_date: string
          status: string
          updated_at: string | null
          version_number: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_scope?: string | null
          club_id: string
          created_at?: string | null
          created_by: string
          end_date: string
          fiscal_year?: number | null
          id?: string
          name: string
          parent_budget_cycle_id?: string | null
          season?: string
          season_id?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          version_number?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_scope?: string | null
          club_id?: string
          created_at?: string | null
          created_by?: string
          end_date?: string
          fiscal_year?: number | null
          id?: string
          name?: string
          parent_budget_cycle_id?: string | null
          season?: string
          season_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_cycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cycles_parent_budget_cycle_id_fkey"
            columns: ["parent_budget_cycle_id"]
            isOneToOne: false
            referencedRelation: "budget_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "budget_cycles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          actual_amount: number | null
          budget_amount: number | null
          budget_version_id: string
          category_id: string | null
          club_id: string
          cost_center_id: string | null
          created_at: string | null
          currency: string | null
          forecast_amount: number | null
          id: string
          line_nature: string | null
          line_type: string
          metadata: Json | null
          month: number | null
          notes: string | null
          owner_user_id: string | null
          period_end: string | null
          period_start: string | null
          season: string | null
          season_id: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number | null
          budget_amount?: number | null
          budget_version_id: string
          category_id?: string | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string | null
          currency?: string | null
          forecast_amount?: number | null
          id?: string
          line_nature?: string | null
          line_type?: string
          metadata?: Json | null
          month?: number | null
          notes?: string | null
          owner_user_id?: string | null
          period_end?: string | null
          period_start?: string | null
          season?: string | null
          season_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number | null
          budget_amount?: number | null
          budget_version_id?: string
          category_id?: string | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          currency?: string | null
          forecast_amount?: number | null
          id?: string
          line_nature?: string | null
          line_type?: string
          metadata?: Json | null
          month?: number | null
          notes?: string | null
          owner_user_id?: string | null
          period_end?: string | null
          period_start?: string | null
          season?: string | null
          season_id?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "budget_lines_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "budget_lines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_snapshots: {
        Row: {
          budget_cycle_id: string
          budget_version_id: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          snapshot_date: string
          summary_payload: Json
        }
        Insert: {
          budget_cycle_id: string
          budget_version_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          snapshot_date: string
          summary_payload?: Json
        }
        Update: {
          budget_cycle_id?: string
          budget_version_id?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          snapshot_date?: string
          summary_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "budget_snapshots_budget_cycle_id_fkey"
            columns: ["budget_cycle_id"]
            isOneToOne: false
            referencedRelation: "budget_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_snapshots_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_cycle_id: string
          created_at: string | null
          created_by: string
          effective_from: string | null
          id: string
          notes: string | null
          season_id: string | null
          status: string | null
          updated_at: string | null
          version_code: string
          version_label: string
          version_type: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_cycle_id: string
          created_at?: string | null
          created_by: string
          effective_from?: string | null
          id?: string
          notes?: string | null
          season_id?: string | null
          status?: string | null
          updated_at?: string | null
          version_code: string
          version_label: string
          version_type?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_cycle_id?: string
          created_at?: string | null
          created_by?: string
          effective_from?: string | null
          id?: string
          notes?: string | null
          season_id?: string | null
          status?: string | null
          updated_at?: string | null
          version_code?: string
          version_label?: string
          version_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_budget_cycle_id_fkey"
            columns: ["budget_cycle_id"]
            isOneToOne: false
            referencedRelation: "budget_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_versions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_versions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "budget_versions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      callup_confirmations: {
        Row: {
          comment: string | null
          confirmation_deadline: string | null
          confirmed_by: string
          created_at: string
          id: string
          match_id: string
          player_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          confirmation_deadline?: string | null
          confirmed_by: string
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          confirmation_deadline?: string | null
          confirmed_by?: string
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callup_confirmations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callup_confirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callup_confirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      callup_notifications: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          match_id: string
          message: string | null
          notification_type: string
          sent_at: string | null
          target_audience: string
          team_id: string
          template_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          match_id: string
          message?: string | null
          notification_type?: string
          sent_at?: string | null
          target_audience?: string
          team_id: string
          template_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          match_id?: string
          message?: string | null
          notification_type?: string
          sent_at?: string | null
          target_audience?: string
          team_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callup_notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callup_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callup_notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callup_notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advances: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          created_by: string
          due_settlement_date: string | null
          id: string
          issue_date: string
          notes: string | null
          outstanding_amount: number
          purpose: string
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          created_by: string
          due_settlement_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          outstanding_amount: number
          purpose: string
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          created_by?: string
          due_settlement_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          outstanding_amount?: number
          purpose?: string
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_advances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_results: {
        Row: {
          away_goals: number | null
          away_team_id: string
          championship_id: string
          created_at: string
          home_goals: number | null
          home_team_id: string
          id: string
          is_played: boolean | null
          match_date: string | null
          matchday: number | null
          owner_id: string
          season_id: string | null
          updated_at: string
        }
        Insert: {
          away_goals?: number | null
          away_team_id: string
          championship_id: string
          created_at?: string
          home_goals?: number | null
          home_team_id: string
          id?: string
          is_played?: boolean | null
          match_date?: string | null
          matchday?: number | null
          owner_id: string
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          away_goals?: number | null
          away_team_id?: string
          championship_id?: string
          created_at?: string
          home_goals?: number | null
          home_team_id?: string
          id?: string
          is_played?: boolean | null
          match_date?: string | null
          matchday?: number | null
          owner_id?: string
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_results_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "championship_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_results_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_results_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "championship_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "championship_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      championship_teams: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          is_own_team: boolean | null
          owner_id: string
          season_id: string | null
          team_name: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          is_own_team?: boolean | null
          owner_id: string
          season_id?: string | null
          team_name: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          is_own_team?: boolean | null
          owner_id?: string
          season_id?: string | null
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_teams_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "championship_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      championships: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          season: string
          season_id: string | null
          series: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          season?: string
          season_id?: string | null
          series?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          season?: string
          season_id?: string | null
          series?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "championships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "championships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          balance_due: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          charge_type: string
          club_id: string
          created_at: string
          description: string
          discount_amount: number
          due_date: string
          fee_assignment_id: string | null
          fee_plan_id: string | null
          final_amount: number
          guardian_id: string | null
          id: string
          issue_date: string
          late_fee_amount: number
          metadata: Json | null
          original_amount: number
          player_id: string | null
          reference_month: number | null
          reference_year: number | null
          season: string | null
          season_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          balance_due: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charge_type?: string
          club_id: string
          created_at?: string
          description: string
          discount_amount?: number
          due_date: string
          fee_assignment_id?: string | null
          fee_plan_id?: string | null
          final_amount: number
          guardian_id?: string | null
          id?: string
          issue_date?: string
          late_fee_amount?: number
          metadata?: Json | null
          original_amount: number
          player_id?: string | null
          reference_month?: number | null
          reference_year?: number | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          balance_due?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charge_type?: string
          club_id?: string
          created_at?: string
          description?: string
          discount_amount?: number
          due_date?: string
          fee_assignment_id?: string | null
          fee_plan_id?: string | null
          final_amount?: number
          guardian_id?: string | null
          id?: string
          issue_date?: string
          late_fee_amount?: number
          metadata?: Json | null
          original_amount?: number
          player_id?: string | null
          reference_month?: number | null
          reference_year?: number | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_fee_assignment_id_fkey"
            columns: ["fee_assignment_id"]
            isOneToOne: false
            referencedRelation: "fee_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_fee_plan_id_fkey"
            columns: ["fee_plan_id"]
            isOneToOne: false
            referencedRelation: "fee_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "charges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      club_accounts: {
        Row: {
          account_type: string
          balance: number
          club_id: string
          created_at: string
          iban: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          balance?: number
          club_id: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          balance?: number
          club_id?: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coach_invitations: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string | null
          status: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          status?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coach_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coaches: {
        Row: {
          club_id: string
          coach_id: string
          id: string
          is_active: boolean
          joined_at: string
        }
        Insert: {
          club_id: string
          coach_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
        }
        Update: {
          club_id?: string
          coach_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coaches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_documents: {
        Row: {
          alert_days: number | null
          club_id: string
          created_at: string
          description: string | null
          document_type: string
          expiry_date: string | null
          file_url: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          alert_days?: number | null
          club_id: string
          created_at?: string
          description?: string | null
          document_type: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          alert_days?: number | null
          club_id?: string
          created_at?: string
          description?: string | null
          document_type?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          address: string | null
          birth_date: string | null
          club_id: string
          created_at: string
          email: string | null
          fee_amount: number | null
          id: string
          is_active: boolean
          joined_at: string | null
          membership_number: string | null
          name: string
          nif: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          plan_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          club_id: string
          created_at?: string
          email?: string | null
          fee_amount?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          membership_number?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          plan_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          club_id?: string
          created_at?: string
          email?: string | null
          fee_amount?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          membership_number?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payment_accounts: {
        Row: {
          account_type: string | null
          capabilities_status: Json | null
          charges_enabled: boolean
          club_id: string
          connected_at: string | null
          country: string | null
          created_at: string
          default_currency: string | null
          details_submitted: boolean
          disconnected_at: string | null
          external_account_id: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          mode: string
          onboarding_status: string
          payouts_enabled: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          capabilities_status?: Json | null
          charges_enabled?: boolean
          club_id: string
          connected_at?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          mode?: string
          onboarding_status?: string
          payouts_enabled?: boolean
          provider?: string
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          capabilities_status?: Json | null
          charges_enabled?: boolean
          club_id?: string
          connected_at?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          mode?: string
          onboarding_status?: string
          payouts_enabled?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_payment_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payment_settings: {
        Row: {
          allow_manual_payments: boolean
          allow_online_payments: boolean
          club_id: string
          configuration_status: string
          created_at: string
          created_by: string | null
          default_currency: string
          enabled: boolean
          id: string
          live_mode_enabled: boolean
          payment_mode: string
          provider: string | null
          test_mode_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_manual_payments?: boolean
          allow_online_payments?: boolean
          club_id: string
          configuration_status?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          enabled?: boolean
          id?: string
          live_mode_enabled?: boolean
          payment_mode?: string
          provider?: string | null
          test_mode_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_manual_payments?: boolean
          allow_online_payments?: boolean
          club_id?: string
          configuration_status?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          enabled?: boolean
          id?: string
          live_mode_enabled?: boolean
          payment_mode?: string
          provider?: string | null
          test_mode_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_payment_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_settings: {
        Row: {
          allow_coach_multi_team: boolean | null
          club_id: string
          created_at: string
          id: string
          max_admins: number | null
          max_coaches: number | null
          max_staff: number | null
          updated_at: string
        }
        Insert: {
          allow_coach_multi_team?: boolean | null
          club_id: string
          created_at?: string
          id?: string
          max_admins?: number | null
          max_coaches?: number | null
          max_staff?: number | null
          updated_at?: string
        }
        Update: {
          allow_coach_multi_team?: boolean | null
          club_id?: string
          created_at?: string
          id?: string
          max_admins?: number | null
          max_coaches?: number | null
          max_staff?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_staff: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["club_staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["club_staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["club_staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_staff_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          founded_year: number | null
          history: string | null
          iban: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          modalities: string[] | null
          name: string
          nif: string | null
          objectives: string | null
          owner_id: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          founded_year?: number | null
          history?: string | null
          iban?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          modalities?: string[] | null
          name: string
          nif?: string | null
          objectives?: string | null
          owner_id: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          founded_year?: number | null
          history?: string | null
          iban?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          modalities?: string[] | null
          name?: string
          nif?: string | null
          objectives?: string | null
          owner_id?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      coach_details: {
        Row: {
          address: string | null
          bio: string | null
          birth_date: string | null
          coaching_philosophy: string | null
          created_at: string
          id: string
          nationality: string | null
          phone: string | null
          photo_url: string | null
          preferred_formations: string[] | null
          specializations: string[] | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          birth_date?: string | null
          coaching_philosophy?: string | null
          created_at?: string
          id?: string
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_formations?: string[] | null
          specializations?: string[] | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          birth_date?: string | null
          coaching_philosophy?: string | null
          created_at?: string
          id?: string
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_formations?: string[] | null
          specializations?: string[] | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      coach_diplomas: {
        Row: {
          coach_id: string
          created_at: string
          diploma_level: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          name: string
          notes: string | null
          owner_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          diploma_level?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          name: string
          notes?: string | null
          owner_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          diploma_level?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      coach_history: {
        Row: {
          achievements: string | null
          age_groups: string[] | null
          club_name: string
          coach_id: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          role: string | null
          season_id: string | null
          start_date: string | null
        }
        Insert: {
          achievements?: string | null
          age_groups?: string[] | null
          club_name: string
          coach_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          role?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Update: {
          achievements?: string | null
          age_groups?: string[] | null
          club_name?: string
          coach_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          role?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "coach_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      coach_trainings: {
        Row: {
          age_group: string | null
          coach_id: string
          created_at: string
          description: string | null
          diagram_url: string | null
          duration_minutes: number | null
          exercises: Json | null
          id: string
          name: string
          objectives: string | null
          owner_id: string
          season_id: string | null
          status: string | null
          tactical_notes: string | null
          team_id: string | null
          training_date: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          coach_id: string
          created_at?: string
          description?: string | null
          diagram_url?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          id?: string
          name: string
          objectives?: string | null
          owner_id: string
          season_id?: string | null
          status?: string | null
          tactical_notes?: string | null
          team_id?: string | null
          training_date?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          coach_id?: string
          created_at?: string
          description?: string | null
          diagram_url?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          id?: string
          name?: string
          objectives?: string | null
          owner_id?: string
          season_id?: string | null
          status?: string | null
          tactical_notes?: string | null
          team_id?: string | null
          training_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_trainings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_trainings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "coach_trainings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      communication_announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "communication_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_announcements: {
        Row: {
          channel_id: string | null
          club_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          priority: string
          season_id: string | null
          target_type: string
          target_value: string | null
          title: string
        }
        Insert: {
          channel_id?: string | null
          club_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          priority?: string
          season_id?: string | null
          target_type?: string
          target_value?: string | null
          title: string
        }
        Update: {
          channel_id?: string | null
          club_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          priority?: string
          season_id?: string | null
          target_type?: string
          target_value?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_announcements_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_announcements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_announcements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "communication_announcements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      communication_attachments: {
        Row: {
          announcement_id: string | null
          club_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          uploaded_by: string
        }
        Insert: {
          announcement_id?: string | null
          club_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          uploaded_by: string
        }
        Update: {
          announcement_id?: string | null
          club_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "communication_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_automation_logs: {
        Row: {
          details: Json | null
          id: string
          rule_id: string
          status: string | null
          target_count: number | null
          triggered_at: string
        }
        Insert: {
          details?: Json | null
          id?: string
          rule_id: string
          status?: string | null
          target_count?: number | null
          triggered_at?: string
        }
        Update: {
          details?: Json | null
          id?: string
          rule_id?: string
          status?: string | null
          target_count?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "communication_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_automation_rules: {
        Row: {
          club_id: string | null
          created_at: string
          created_by: string
          id: string
          is_enabled: boolean | null
          last_triggered_at: string | null
          name: string
          target_audience: string
          target_channel_id: string | null
          team_id: string | null
          template_id: string | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name: string
          target_audience?: string
          target_channel_id?: string | null
          team_id?: string | null
          template_id?: string | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_enabled?: boolean | null
          last_triggered_at?: string | null
          name?: string
          target_audience?: string
          target_channel_id?: string | null
          team_id?: string | null
          template_id?: string | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_automation_rules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_automation_rules_target_channel_id_fkey"
            columns: ["target_channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_automation_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_channel_members: {
        Row: {
          channel_id: string
          id: string
          is_active: boolean
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          membership_origin: string
          notification_level: string
          profile_type: string | null
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_active?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          membership_origin?: string
          notification_level?: string
          profile_type?: string | null
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_active?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          membership_origin?: string
          notification_level?: string
          profile_type?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_channels: {
        Row: {
          age_group: string | null
          allow_coaches: boolean
          allow_coordinators: boolean
          allow_guardians: boolean
          allow_players: boolean
          allow_staff: boolean
          can_members_post: boolean
          channel_type: string
          club_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          is_official: boolean
          last_message_at: string | null
          last_message_preview: string | null
          name: string
          owner_id: string | null
          priority_level: string
          season_id: string | null
          target_role: string | null
          team_id: string | null
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          age_group?: string | null
          allow_coaches?: boolean
          allow_coordinators?: boolean
          allow_guardians?: boolean
          allow_players?: boolean
          allow_staff?: boolean
          can_members_post?: boolean
          channel_type?: string
          club_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_official?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          name: string
          owner_id?: string | null
          priority_level?: string
          season_id?: string | null
          target_role?: string | null
          team_id?: string | null
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          age_group?: string | null
          allow_coaches?: boolean
          allow_coordinators?: boolean
          allow_guardians?: boolean
          allow_players?: boolean
          allow_staff?: boolean
          can_members_post?: boolean
          channel_type?: string
          club_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_official?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string
          owner_id?: string | null
          priority_level?: string
          season_id?: string | null
          target_role?: string | null
          team_id?: string | null
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_channels_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_channels_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "communication_channels_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "communication_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_engagement_snapshots: {
        Row: {
          club_id: string
          created_at: string
          details: Json | null
          id: string
          metric_type: string
          metric_value: number
          period_end: string
          period_start: string
          team_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          details?: Json | null
          id?: string
          metric_type: string
          metric_value?: number
          period_end: string
          period_start: string
          team_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          metric_type?: string
          metric_value?: number
          period_end?: string
          period_start?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_engagement_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_engagement_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_member_states: {
        Row: {
          channel_id: string
          id: string
          is_archived: boolean
          is_muted: boolean
          last_read_at: string | null
          last_read_message_id: string | null
          last_seen_at: string | null
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          last_read_at?: string | null
          last_read_message_id?: string | null
          last_seen_at?: string | null
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          last_read_at?: string | null
          last_read_message_id?: string | null
          last_seen_at?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_member_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_member_states_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          message_type: string
          parent_message_id: string | null
          priority_level: string
          season_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          message_type?: string
          parent_message_id?: string | null
          priority_level?: string
          season_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          message_type?: string
          parent_message_id?: string | null
          priority_level?: string
          season_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "communication_messages_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      communication_notifications: {
        Row: {
          action_url: string | null
          body: string | null
          channel_id: string | null
          club_id: string | null
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_dismissed: boolean
          is_read: boolean
          notification_type: string
          priority_level: string
          read_at: string | null
          team_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          channel_id?: string | null
          club_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          notification_type: string
          priority_level?: string
          read_at?: string | null
          team_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          channel_id?: string | null
          club_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          notification_type?: string
          priority_level?: string
          read_at?: string | null
          team_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_pins: {
        Row: {
          channel_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          channel_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          channel_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_pins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_reminders: {
        Row: {
          channel_id: string | null
          club_id: string | null
          content: string | null
          created_at: string
          created_by: string
          id: string
          is_sent: boolean
          related_match_id: string | null
          related_training_id: string | null
          reminder_type: string
          scheduled_for: string | null
          sent_at: string | null
          title: string
        }
        Insert: {
          channel_id?: string | null
          club_id?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_sent?: boolean
          related_match_id?: string | null
          related_training_id?: string | null
          reminder_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
        }
        Update: {
          channel_id?: string | null
          club_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_sent?: boolean
          related_match_id?: string | null
          related_training_id?: string | null
          reminder_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_reminders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "communication_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reminders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reminders_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_reminders_related_training_id_fkey"
            columns: ["related_training_id"]
            isOneToOne: false
            referencedRelation: "coach_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          category: string
          club_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          placeholders: Json | null
          scope: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          club_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          placeholders?: Json | null
          scope?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          club_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          placeholders?: Json | null
          scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_components: {
        Row: {
          affects_budget: boolean | null
          club_id: string
          component_code: string
          component_name: string
          component_type: string
          contributory: boolean | null
          created_at: string
          id: string
          is_active: boolean | null
          recurring: boolean | null
          taxable: boolean | null
        }
        Insert: {
          affects_budget?: boolean | null
          club_id: string
          component_code: string
          component_name: string
          component_type: string
          contributory?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          recurring?: boolean | null
          taxable?: boolean | null
        }
        Update: {
          affects_budget?: boolean | null
          club_id?: string
          component_code?: string
          component_name?: string
          component_type?: string
          contributory?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          recurring?: boolean | null
          taxable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "compensation_components_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_package_lines: {
        Row: {
          amount: number | null
          calculation_method: string | null
          component_id: string
          created_at: string
          frequency: string | null
          id: string
          notes: string | null
          package_id: string
          percentage: number | null
        }
        Insert: {
          amount?: number | null
          calculation_method?: string | null
          component_id: string
          created_at?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          package_id: string
          percentage?: number | null
        }
        Update: {
          amount?: number | null
          calculation_method?: string | null
          component_id?: string
          created_at?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compensation_package_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "compensation_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_package_lines_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "compensation_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_packages: {
        Row: {
          club_id: string
          contract_id: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          package_name: string
          person_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          contract_id?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          package_name: string
          person_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          contract_id?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          package_name?: string
          person_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compensation_packages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_packages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_packages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_assets: {
        Row: {
          asset_item_id: string
          club_id: string
          compliance_type: string
          created_at: string | null
          file_url: string | null
          id: string
          notes: string | null
          status: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          asset_item_id: string
          club_id: string
          compliance_type: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          asset_item_id?: string
          club_id?: string
          compliance_type?: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assets_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assets_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_addenda: {
        Row: {
          addendum_type: string
          approved_at: string | null
          approved_by: string | null
          contract_id: string
          created_at: string
          description: string | null
          effective_date: string
          file_url: string | null
          id: string
          impact_type: string | null
          new_value: string | null
          previous_value: string | null
        }
        Insert: {
          addendum_type: string
          approved_at?: string | null
          approved_by?: string | null
          contract_id: string
          created_at?: string
          description?: string | null
          effective_date: string
          file_url?: string | null
          id?: string
          impact_type?: string | null
          new_value?: string | null
          previous_value?: string | null
        }
        Update: {
          addendum_type?: string
          approved_at?: string | null
          approved_by?: string | null
          contract_id?: string
          created_at?: string
          description?: string | null
          effective_date?: string
          file_url?: string | null
          id?: string
          impact_type?: string | null
          new_value?: string | null
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_addenda_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          club_id: string
          contract_id: string | null
          created_at: string
          due_date: string | null
          id: string
          message: string | null
          person_id: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          club_id: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          person_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          club_id?: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          person_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_alerts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_alerts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_fee_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_name: string
          club_id: string
          created_at: string
          id: string
          period_reference: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_name: string
          club_id: string
          created_at?: string
          id?: string
          period_reference?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_name?: string
          club_id?: string
          created_at?: string
          id?: string
          period_reference?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_fee_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_fee_entries: {
        Row: {
          created_at: string
          fee_batch_id: string
          gross_fee: number
          id: string
          net_fee: number
          notes: string | null
          payable_amount: number
          person_id: string
          quantity: number | null
          service_date: string | null
          service_reference: string | null
          status: string | null
          unit_rate: number | null
          withholding_amount: number | null
        }
        Insert: {
          created_at?: string
          fee_batch_id: string
          gross_fee?: number
          id?: string
          net_fee?: number
          notes?: string | null
          payable_amount?: number
          person_id: string
          quantity?: number | null
          service_date?: string | null
          service_reference?: string | null
          status?: string | null
          unit_rate?: number | null
          withholding_amount?: number | null
        }
        Update: {
          created_at?: string
          fee_batch_id?: string
          gross_fee?: number
          id?: string
          net_fee?: number
          notes?: string | null
          payable_amount?: number
          person_id?: string
          quantity?: number | null
          service_date?: string | null
          service_reference?: string | null
          status?: string | null
          unit_rate?: number | null
          withholding_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_fee_entries_fee_batch_id_fkey"
            columns: ["fee_batch_id"]
            isOneToOne: false
            referencedRelation: "contractor_fee_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_fee_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      coordination_change_history: {
        Row: {
          action: string
          changes: Json | null
          club_id: string
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
        }
        Insert: {
          action: string
          changes?: Json | null
          club_id: string
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
        }
        Update: {
          action?: string
          changes?: Json | null
          club_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordination_change_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_renew: boolean | null
          base_salary: number | null
          club_id: string
          contract_number: string | null
          contract_status: string
          contract_type: string
          created_at: string
          currency: string | null
          end_date: string | null
          file_url: string | null
          id: string
          notice_period_days: number | null
          payment_day: number | null
          payment_frequency: string | null
          person_id: string
          probation_period: number | null
          signed_at: string | null
          staff_profile_id: string | null
          start_date: string
          updated_at: string
          weekly_hours: number | null
          working_time_type: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_renew?: boolean | null
          base_salary?: number | null
          club_id: string
          contract_number?: string | null
          contract_status?: string
          contract_type?: string
          created_at?: string
          currency?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          notice_period_days?: number | null
          payment_day?: number | null
          payment_frequency?: string | null
          person_id: string
          probation_period?: number | null
          signed_at?: string | null
          staff_profile_id?: string | null
          start_date: string
          updated_at?: string
          weekly_hours?: number | null
          working_time_type?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_renew?: boolean | null
          base_salary?: number | null
          club_id?: string
          contract_number?: string | null
          contract_status?: string
          contract_type?: string
          created_at?: string
          currency?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          notice_period_days?: number | null
          payment_day?: number | null
          payment_frequency?: string | null
          person_id?: string
          probation_period?: number | null
          signed_at?: string | null
          staff_profile_id?: string | null
          start_date?: string
          updated_at?: string
          weekly_hours?: number | null
          working_time_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          event_date: string
          id: string
          is_active: boolean
          location: string | null
          match_id: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          event_date: string
          id?: string
          is_active?: boolean
          location?: string | null
          match_id?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          is_active?: boolean
          location?: string | null
          match_id?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_claim_lines: {
        Row: {
          amount: number
          category_id: string | null
          description: string
          expense_claim_id: string
          expense_date: string
          id: string
          merchant_name: string | null
          notes: string | null
          payment_method_used: string | null
          receipt_url: string | null
          reimbursable: boolean | null
          tax_amount: number | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          description: string
          expense_claim_id: string
          expense_date: string
          id?: string
          merchant_name?: string | null
          notes?: string | null
          payment_method_used?: string | null
          receipt_url?: string | null
          reimbursable?: boolean | null
          tax_amount?: number | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          description?: string
          expense_claim_id?: string
          expense_date?: string
          id?: string
          merchant_name?: string | null
          notes?: string | null
          payment_method_used?: string | null
          receipt_url?: string | null
          reimbursable?: boolean | null
          tax_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_claim_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claim_lines_expense_claim_id_fkey"
            columns: ["expense_claim_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_claims: {
        Row: {
          claimant_user_id: string
          club_id: string
          cost_center_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          expense_type: string | null
          id: string
          incurred_from: string | null
          incurred_to: string | null
          report_number: string | null
          season: string | null
          season_id: string | null
          status: string
          team_id: string | null
          title: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          claimant_user_id: string
          club_id: string
          cost_center_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          incurred_from?: string | null
          incurred_to?: string | null
          report_number?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          claimant_user_id?: string
          club_id?: string
          cost_center_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          incurred_from?: string | null
          incurred_to?: string | null
          report_number?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_claims_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "expense_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "expense_claims_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          club_id: string
          country: string | null
          created_at: string
          facility_code: string
          facility_type: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          ownership_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          club_id: string
          country?: string | null
          created_at?: string
          facility_code: string
          facility_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          ownership_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          club_id?: string
          country?: string | null
          created_at?: string
          facility_code?: string
          facility_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          ownership_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_audit_logs: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_availability_rules: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[] | null
          ends_at: string | null
          facility_space_id: string
          id: string
          notes: string | null
          priority: number | null
          rule_type: string
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: number[] | null
          ends_at?: string | null
          facility_space_id: string
          id?: string
          notes?: string | null
          priority?: number | null
          rule_type?: string
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[] | null
          ends_at?: string | null
          facility_space_id?: string
          id?: string
          notes?: string | null
          priority?: number | null
          rule_type?: string
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_availability_rules_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_compliance_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          club_id: string
          created_at: string
          due_date: string | null
          facility_id: string
          facility_space_id: string | null
          id: string
          resolved_at: string | null
          severity: string | null
          status: string
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          club_id: string
          created_at?: string
          due_date?: string | null
          facility_id: string
          facility_space_id?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string | null
          status?: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          club_id?: string
          created_at?: string
          due_date?: string | null
          facility_id?: string
          facility_space_id?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_compliance_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_compliance_alerts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_compliance_alerts_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_documents: {
        Row: {
          created_at: string
          document_type: string
          facility_id: string
          file_url: string | null
          id: string
          issue_date: string | null
          mandatory: boolean
          notes: string | null
          status: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          facility_id: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          mandatory?: boolean
          notes?: string | null
          status?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          facility_id?: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          mandatory?: boolean
          notes?: string | null
          status?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_documents_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_incidents: {
        Row: {
          club_id: string
          created_at: string
          facility_id: string
          facility_space_id: string | null
          id: string
          incident_type: string
          reported_at: string
          reported_by: string | null
          resolution_notes: string | null
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          facility_id: string
          facility_space_id?: string | null
          id?: string
          incident_type?: string
          reported_at?: string
          reported_by?: string | null
          resolution_notes?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          facility_id?: string
          facility_space_id?: string | null
          id?: string
          incident_type?: string
          reported_at?: string
          reported_by?: string | null
          resolution_notes?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_incidents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_incidents_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_incidents_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_maintenance_logs: {
        Row: {
          action_type: string
          actor_user_id: string | null
          attachment_url: string | null
          created_at: string
          id: string
          log_date: string
          notes: string | null
          work_order_id: string
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          work_order_id: string
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_maintenance_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "facility_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_maintenance_plans: {
        Row: {
          active: boolean
          checklist_json: Json | null
          club_id: string
          created_at: string
          facility_id: string
          facility_space_id: string | null
          frequency_type: string | null
          frequency_value: number | null
          id: string
          plan_type: string
          responsible_role: string | null
        }
        Insert: {
          active?: boolean
          checklist_json?: Json | null
          club_id: string
          created_at?: string
          facility_id: string
          facility_space_id?: string | null
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          plan_type?: string
          responsible_role?: string | null
        }
        Update: {
          active?: boolean
          checklist_json?: Json | null
          club_id?: string
          created_at?: string
          facility_id?: string
          facility_space_id?: string | null
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          plan_type?: string
          responsible_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_maintenance_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_maintenance_plans_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_maintenance_plans_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_operational_costs: {
        Row: {
          amount: number
          club_id: string
          cost_center_id: string | null
          cost_type: string
          created_at: string
          currency: string | null
          facility_id: string
          facility_space_id: string | null
          id: string
          notes: string | null
          period_reference: string
          source_entity_id: string | null
          source_entity_type: string | null
          team_id: string | null
        }
        Insert: {
          amount?: number
          club_id: string
          cost_center_id?: string | null
          cost_type?: string
          created_at?: string
          currency?: string | null
          facility_id: string
          facility_space_id?: string | null
          id?: string
          notes?: string | null
          period_reference: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          team_id?: string | null
        }
        Update: {
          amount?: number
          club_id?: string
          cost_center_id?: string | null
          cost_type?: string
          created_at?: string
          currency?: string | null
          facility_id?: string
          facility_space_id?: string | null
          id?: string
          notes?: string | null
          period_reference?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_operational_costs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_operational_costs_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_operational_costs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_operational_costs_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_operational_costs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_reservations: {
        Row: {
          club_id: string
          created_at: string
          ends_at: string
          facility_id: string
          facility_space_id: string
          id: string
          notes: string | null
          priority_level: number | null
          recurrence_rule: string | null
          requester_user_id: string
          reservation_status: string
          reservation_type: string
          responsible_user_id: string | null
          season_id: string | null
          starts_at: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_at: string
          facility_id: string
          facility_space_id: string
          id?: string
          notes?: string | null
          priority_level?: number | null
          recurrence_rule?: string | null
          requester_user_id: string
          reservation_status?: string
          reservation_type?: string
          responsible_user_id?: string | null
          season_id?: string | null
          starts_at: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_at?: string
          facility_id?: string
          facility_space_id?: string
          id?: string
          notes?: string | null
          priority_level?: number | null
          recurrence_rule?: string | null
          requester_user_id?: string
          reservation_status?: string
          reservation_type?: string
          responsible_user_id?: string | null
          season_id?: string | null
          starts_at?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_reservations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_resources: {
        Row: {
          asset_item_id: string | null
          created_at: string
          facility_space_id: string
          id: string
          notes: string | null
          quantity: number | null
          resource_type: string
          status: string | null
        }
        Insert: {
          asset_item_id?: string | null
          created_at?: string
          facility_space_id: string
          id?: string
          notes?: string | null
          quantity?: number | null
          resource_type: string
          status?: string | null
        }
        Update: {
          asset_item_id?: string | null
          created_at?: string
          facility_space_id?: string
          id?: string
          notes?: string | null
          quantity?: number | null
          resource_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_resources_asset_item_id_fkey"
            columns: ["asset_item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_resources_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_spaces: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          dimensions: string | null
          facility_id: string
          floodlights: boolean | null
          id: string
          indoor_outdoor: string | null
          maintenance_critical: boolean | null
          medical_support_required: boolean | null
          name: string
          notes: string | null
          reservable: boolean
          space_code: string
          space_type: string
          surface_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          dimensions?: string | null
          facility_id: string
          floodlights?: boolean | null
          id?: string
          indoor_outdoor?: string | null
          maintenance_critical?: boolean | null
          medical_support_required?: boolean | null
          name: string
          notes?: string | null
          reservable?: boolean
          space_code: string
          space_type?: string
          surface_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          dimensions?: string | null
          facility_id?: string
          floodlights?: boolean | null
          id?: string
          indoor_outdoor?: string | null
          maintenance_critical?: boolean | null
          medical_support_required?: boolean | null
          name?: string
          notes?: string | null
          reservable?: boolean
          space_code?: string
          space_type?: string
          surface_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_spaces_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_usage_logs: {
        Row: {
          actual_duration_minutes: number | null
          club_id: string
          created_at: string
          ends_at: string
          facility_id: string
          facility_space_id: string
          id: string
          notes: string | null
          reservation_id: string | null
          responsible_user_id: string | null
          starts_at: string
          team_id: string | null
          usage_type: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          club_id: string
          created_at?: string
          ends_at: string
          facility_id: string
          facility_space_id: string
          id?: string
          notes?: string | null
          reservation_id?: string | null
          responsible_user_id?: string | null
          starts_at: string
          team_id?: string | null
          usage_type?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          club_id?: string
          created_at?: string
          ends_at?: string
          facility_id?: string
          facility_space_id?: string
          id?: string
          notes?: string | null
          reservation_id?: string | null
          responsible_user_id?: string | null
          starts_at?: string
          team_id?: string | null
          usage_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_usage_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_usage_logs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_usage_logs_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_usage_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "facility_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_usage_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_work_orders: {
        Row: {
          actual_cost: number | null
          assigned_to_user_id: string | null
          club_id: string
          completed_date: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          facility_id: string
          facility_space_id: string | null
          id: string
          maintenance_plan_id: string | null
          notes: string | null
          priority: string | null
          requested_by: string | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          work_order_type: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to_user_id?: string | null
          club_id: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          facility_id: string
          facility_space_id?: string | null
          id?: string
          maintenance_plan_id?: string | null
          notes?: string | null
          priority?: string | null
          requested_by?: string | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id?: string | null
          work_order_type?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to_user_id?: string | null
          club_id?: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          facility_id?: string
          facility_space_id?: string | null
          id?: string
          maintenance_plan_id?: string | null
          notes?: string | null
          priority?: string | null
          requested_by?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string | null
          work_order_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_work_orders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_work_orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_work_orders_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_work_orders_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "facility_maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_assignments: {
        Row: {
          age_group: string | null
          club_id: string
          created_at: string
          created_by: string
          custom_amount: number | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          end_date: string | null
          fee_plan_id: string
          guardian_id: string | null
          id: string
          is_exempt: boolean
          is_scholarship: boolean
          notes: string | null
          player_id: string | null
          season: string | null
          season_id: string | null
          start_date: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          club_id: string
          created_at?: string
          created_by: string
          custom_amount?: number | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          fee_plan_id: string
          guardian_id?: string | null
          id?: string
          is_exempt?: boolean
          is_scholarship?: boolean
          notes?: string | null
          player_id?: string | null
          season?: string | null
          season_id?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          custom_amount?: number | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          fee_plan_id?: string
          guardian_id?: string | null
          id?: string
          is_exempt?: boolean
          is_scholarship?: boolean
          notes?: string | null
          player_id?: string | null
          season?: string | null
          season_id?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_fee_plan_id_fkey"
            columns: ["fee_plan_id"]
            isOneToOne: false
            referencedRelation: "fee_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fee_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fee_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_plans: {
        Row: {
          allows_override: boolean
          amount: number
          applies_to_scope: string
          auto_generate: boolean
          billing_frequency: string
          club_id: string
          created_at: string
          created_by: string
          currency: string
          description: string | null
          due_day: number
          end_date: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
          plan_type: string
          season: string | null
          season_id: string | null
          send_alerts: boolean
          start_date: string | null
          target_age_group: string | null
          target_team_id: string | null
          updated_at: string
        }
        Insert: {
          allows_override?: boolean
          amount?: number
          applies_to_scope?: string
          auto_generate?: boolean
          billing_frequency?: string
          club_id: string
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          due_day?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
          plan_type?: string
          season?: string | null
          season_id?: string | null
          send_alerts?: boolean
          start_date?: string | null
          target_age_group?: string | null
          target_team_id?: string | null
          updated_at?: string
        }
        Update: {
          allows_override?: boolean
          amount?: number
          applies_to_scope?: string
          auto_generate?: boolean
          billing_frequency?: string
          club_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          due_day?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
          plan_type?: string
          season?: string | null
          season_id?: string | null
          send_alerts?: boolean
          start_date?: string | null
          target_age_group?: string | null
          target_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fee_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fee_plans_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      field_profiles: {
        Row: {
          created_at: string
          drainage_available: boolean | null
          facility_space_id: string
          field_format: string | null
          id: string
          irrigation_available: boolean | null
          lighting_available: boolean | null
          match_eligible: boolean | null
          safety_notes: string | null
          size_category: string | null
          sport_type: string | null
          training_eligible: boolean | null
          turf_type: string | null
        }
        Insert: {
          created_at?: string
          drainage_available?: boolean | null
          facility_space_id: string
          field_format?: string | null
          id?: string
          irrigation_available?: boolean | null
          lighting_available?: boolean | null
          match_eligible?: boolean | null
          safety_notes?: string | null
          size_category?: string | null
          sport_type?: string | null
          training_eligible?: boolean | null
          turf_type?: string | null
        }
        Update: {
          created_at?: string
          drainage_available?: boolean | null
          facility_space_id?: string
          field_format?: string | null
          id?: string
          irrigation_available?: boolean | null
          lighting_available?: boolean | null
          match_eligible?: boolean | null
          safety_notes?: string | null
          size_category?: string | null
          sport_type?: string | null
          training_eligible?: boolean | null
          turf_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_profiles_facility_space_id_fkey"
            columns: ["facility_space_id"]
            isOneToOne: false
            referencedRelation: "facility_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_readiness_snapshots: {
        Row: {
          active_injuries: number
          active_restrictions: number
          availability_status: string
          clearance_status: string | null
          club_id: string
          created_at: string
          id: string
          person_id: string
          readiness_score: number | null
          risk_level: string
          snapshot_date: string
          summary: string | null
          team_id: string | null
        }
        Insert: {
          active_injuries?: number
          active_restrictions?: number
          availability_status?: string
          clearance_status?: string | null
          club_id: string
          created_at?: string
          id?: string
          person_id: string
          readiness_score?: number | null
          risk_level?: string
          snapshot_date: string
          summary?: string | null
          team_id?: string | null
        }
        Update: {
          active_injuries?: number
          active_restrictions?: number
          availability_status?: string
          clearance_status?: string | null
          club_id?: string
          created_at?: string
          id?: string
          person_id?: string
          readiness_score?: number | null
          risk_level?: string
          snapshot_date?: string
          summary?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_readiness_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_readiness_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          club_id: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string | null
          receipt_type: string | null
          received_at: string | null
          received_by: string
          status: string | null
          vendor_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string | null
          receipt_type?: string | null
          received_at?: string | null
          received_by: string
          status?: string | null
          vendor_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string | null
          receipt_type?: string | null
          received_at?: string | null
          received_by?: string
          status?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_notification_preferences: {
        Row: {
          announcement_alerts: boolean
          callup_alerts: boolean
          created_at: string
          guardian_id: string
          id: string
          match_reminders: boolean
          training_reminders: boolean
          unread_followup: boolean
          updated_at: string
        }
        Insert: {
          announcement_alerts?: boolean
          callup_alerts?: boolean
          created_at?: string
          guardian_id: string
          id?: string
          match_reminders?: boolean
          training_reminders?: boolean
          unread_followup?: boolean
          updated_at?: string
        }
        Update: {
          announcement_alerts?: boolean
          callup_alerts?: boolean
          created_at?: string
          guardian_id?: string
          id?: string
          match_reminders?: boolean
          training_reminders?: boolean
          unread_followup?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_notification_preferences_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: true
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      injury_assessments: {
        Row: {
          assessed_by: string | null
          assessment_date: string
          attachments: Json | null
          clinical_observation: string | null
          created_at: string
          functional_limitation: string | null
          id: string
          injury_case_id: string
          mobility_score: number | null
          next_review_date: string | null
          pain_level: number | null
          progress_vs_baseline: string | null
          recommended_action: string | null
          risk_indicators: string | null
          strength_score: number | null
        }
        Insert: {
          assessed_by?: string | null
          assessment_date: string
          attachments?: Json | null
          clinical_observation?: string | null
          created_at?: string
          functional_limitation?: string | null
          id?: string
          injury_case_id: string
          mobility_score?: number | null
          next_review_date?: string | null
          pain_level?: number | null
          progress_vs_baseline?: string | null
          recommended_action?: string | null
          risk_indicators?: string | null
          strength_score?: number | null
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string
          attachments?: Json | null
          clinical_observation?: string | null
          created_at?: string
          functional_limitation?: string | null
          id?: string
          injury_case_id?: string
          mobility_score?: number | null
          next_review_date?: string | null
          pain_level?: number | null
          progress_vs_baseline?: string | null
          recommended_action?: string | null
          risk_indicators?: string | null
          strength_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "injury_assessments_injury_case_id_fkey"
            columns: ["injury_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      injury_cases: {
        Row: {
          actual_days_out: number | null
          actual_return_date: string | null
          body_area: string
          body_side: string | null
          case_number: string | null
          case_status: string
          closed_at: string | null
          closed_by: string | null
          club_id: string
          context: string
          created_at: string
          created_by: string | null
          diagnosis_date: string | null
          diagnosis_notes: string | null
          event_date: string
          expected_days_out: number | null
          expected_return_date: string | null
          file_urls: Json | null
          id: string
          injury_type: string
          is_fit_match: boolean
          is_fit_training: boolean
          is_recurrence: boolean
          mechanism: string | null
          person_id: string
          previous_case_id: string | null
          related_match_id: string | null
          related_training_id: string | null
          restrictions: string | null
          season_id: string | null
          severity: string
          team_id: string | null
          unavailable_from: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_days_out?: number | null
          actual_return_date?: string | null
          body_area: string
          body_side?: string | null
          case_number?: string | null
          case_status?: string
          closed_at?: string | null
          closed_by?: string | null
          club_id: string
          context?: string
          created_at?: string
          created_by?: string | null
          diagnosis_date?: string | null
          diagnosis_notes?: string | null
          event_date: string
          expected_days_out?: number | null
          expected_return_date?: string | null
          file_urls?: Json | null
          id?: string
          injury_type: string
          is_fit_match?: boolean
          is_fit_training?: boolean
          is_recurrence?: boolean
          mechanism?: string | null
          person_id: string
          previous_case_id?: string | null
          related_match_id?: string | null
          related_training_id?: string | null
          restrictions?: string | null
          season_id?: string | null
          severity?: string
          team_id?: string | null
          unavailable_from?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_days_out?: number | null
          actual_return_date?: string | null
          body_area?: string
          body_side?: string | null
          case_number?: string | null
          case_status?: string
          closed_at?: string | null
          closed_by?: string | null
          club_id?: string
          context?: string
          created_at?: string
          created_by?: string | null
          diagnosis_date?: string | null
          diagnosis_notes?: string | null
          event_date?: string
          expected_days_out?: number | null
          expected_return_date?: string | null
          file_urls?: Json | null
          id?: string
          injury_type?: string
          is_fit_match?: boolean
          is_fit_training?: boolean
          is_recurrence?: boolean
          mechanism?: string | null
          person_id?: string
          previous_case_id?: string | null
          related_match_id?: string | null
          related_training_id?: string | null
          restrictions?: string | null
          season_id?: string | null
          severity?: string
          team_id?: string | null
          unavailable_from?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injury_cases_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_cases_previous_case_id_fkey"
            columns: ["previous_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injury_cases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          club_id: string
          created_at: string | null
          due_date: string | null
          id: string
          message: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          club_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          club_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_logs: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          club_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          location_code: string
          location_type: string
          name: string
          notes: string | null
          parent_location_id: string | null
          updated_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_code: string
          location_type?: string
          name: string
          notes?: string | null
          parent_location_id?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_code?: string
          location_type?: string
          name?: string
          notes?: string | null
          parent_location_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          owner_id: string
          quantity: number
          reason: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          owner_id: string
          quantity: number
          reason?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          owner_id?: string
          quantity?: number
          reason?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_deliveries: {
        Row: {
          accepted_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_channel: string
          failure_reason: string | null
          id: string
          invite_id: string
          last_attempt_at: string | null
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          opened_at: string | null
          provider_message_id: string | null
          provider_name: string | null
          recipient_email: string | null
          recipient_phone: string | null
          rendered_message: string
          rendered_subject: string | null
          retry_count: number
          send_status: string
          sent_at: string | null
          sent_by_user_id: string | null
          template_id: string | null
          template_key: string | null
          updated_at: string
          version_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel: string
          failure_reason?: string | null
          id?: string
          invite_id: string
          last_attempt_at?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          rendered_message: string
          rendered_subject?: string | null
          retry_count?: number
          send_status?: string
          sent_at?: string | null
          sent_by_user_id?: string | null
          template_id?: string | null
          template_key?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          failure_reason?: string | null
          id?: string
          invite_id?: string
          last_attempt_at?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          rendered_message?: string
          rendered_subject?: string | null
          retry_count?: number
          send_status?: string
          sent_at?: string | null
          sent_by_user_id?: string | null
          template_id?: string | null
          template_key?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_deliveries_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "access_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delivery_id: string | null
          event_source: string
          event_type: string
          id: string
          invite_id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delivery_id?: string | null
          event_source?: string
          event_type: string
          id?: string
          invite_id: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delivery_id?: string | null
          event_source?: string
          event_type?: string
          id?: string
          invite_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "invite_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_events_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "access_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_template_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          template_id: string
          version_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          template_id: string
          version_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          template_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invite_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_template_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "invite_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_template_versions: {
        Row: {
          body_template: string
          change_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          subject_template: string | null
          template_id: string
          version_number: number
        }
        Insert: {
          body_template: string
          change_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          subject_template?: string | null
          template_id: string
          version_number?: number
        }
        Update: {
          body_template?: string
          change_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          subject_template?: string | null
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invite_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_templates: {
        Row: {
          body_template: string
          club_id: string | null
          created_at: string
          created_by: string | null
          delivery_channel: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          language: string
          name: string | null
          owner_coach_id: string | null
          profile_type: string
          status: string
          subject_template: string | null
          template_key: string
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          body_template: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_channel: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name?: string | null
          owner_coach_id?: string | null
          profile_type: string
          status?: string
          subject_template?: string | null
          template_key: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Update: {
          body_template?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_channel?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name?: string | null
          owner_coach_id?: string | null
          profile_type?: string
          status?: string
          subject_template?: string | null
          template_key?: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          category_id: string | null
          cost_center_id: string | null
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          quantity: number | null
          team_id: string | null
          unit_price: number | null
        }
        Insert: {
          category_id?: string | null
          cost_center_id?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          quantity?: number | null
          team_id?: string | null
          unit_price?: number | null
        }
        Update: {
          category_id?: string | null
          cost_center_id?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          quantity?: number | null
          team_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_payable: {
        Row: {
          category_id: string | null
          club_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          document_url: string | null
          due_date: string
          duplicate_check_hash: string | null
          gross_total: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string | null
          notes: string | null
          outstanding_amount: number
          payment_status: string
          received_date: string | null
          source_po_id: string | null
          subtotal: number
          tax_total: number | null
          team_id: string | null
          updated_at: string
          validation_status: string | null
          vendor_id: string
        }
        Insert: {
          category_id?: string | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          document_url?: string | null
          due_date: string
          duplicate_check_hash?: string | null
          gross_total?: number
          id?: string
          invoice_date: string
          invoice_number: string
          invoice_type?: string | null
          notes?: string | null
          outstanding_amount?: number
          payment_status?: string
          received_date?: string | null
          source_po_id?: string | null
          subtotal?: number
          tax_total?: number | null
          team_id?: string | null
          updated_at?: string
          validation_status?: string | null
          vendor_id: string
        }
        Update: {
          category_id?: string | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          document_url?: string | null
          due_date?: string
          duplicate_check_hash?: string | null
          gross_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string | null
          notes?: string | null
          outstanding_amount?: number
          payment_status?: string
          received_date?: string | null
          source_po_id?: string | null
          subtotal?: number
          tax_total?: number | null
          team_id?: string | null
          updated_at?: string
          validation_status?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_source_po_id_fkey"
            columns: ["source_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_assignments: {
        Row: {
          amount: number
          created_at: string
          delivered_at: string | null
          id: string
          kit_id: string
          notes: string | null
          owner_id: string
          paid_at: string | null
          player_id: string
          size: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          kit_id: string
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          player_id: string
          size?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          kit_id?: string
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          player_id?: string
          size?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_assignments_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          owner_id: string
          price: number
          season: string
          season_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          price?: number
          season?: string
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          price?: number
          season?: string
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kits_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "kits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_conflict_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          match_id: string
          message: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          season_id: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          match_id: string
          message: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          season_id?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          match_id?: string
          message?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          season_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_conflict_alerts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_conflict_alerts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_conflict_alerts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_conflict_alerts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_events: {
        Row: {
          assist_player_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["match_event_type"]
          id: string
          is_opponent: boolean
          match_id: string
          minute: number
          notes: string | null
          owner_id: string
          player_id: string | null
          season_id: string | null
          second: number | null
        }
        Insert: {
          assist_player_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["match_event_type"]
          id?: string
          is_opponent?: boolean
          match_id: string
          minute: number
          notes?: string | null
          owner_id: string
          player_id?: string | null
          season_id?: string | null
          second?: number | null
        }
        Update: {
          assist_player_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["match_event_type"]
          id?: string
          is_opponent?: boolean
          match_id?: string
          minute?: number
          notes?: string | null
          owner_id?: string
          player_id?: string | null
          season_id?: string | null
          second?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_formations: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at_minute_abs: number | null
          formation_code: string
          formation_name: string | null
          id: string
          match_id: string
          owner_id: string | null
          part_index: number
          season_id: string | null
          slots: Json
          sport_type: string
          starts_at_minute_abs: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at_minute_abs?: number | null
          formation_code: string
          formation_name?: string | null
          id?: string
          match_id: string
          owner_id?: string | null
          part_index?: number
          season_id?: string | null
          slots: Json
          sport_type: string
          starts_at_minute_abs?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at_minute_abs?: number | null
          formation_code?: string
          formation_name?: string | null
          id?: string
          match_id?: string
          owner_id?: string | null
          part_index?: number
          season_id?: string | null
          slots?: Json
          sport_type?: string
          starts_at_minute_abs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_formations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_formations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_formations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_formations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          id: string
          is_starter: boolean
          match_id: string
          minutes_played: number | null
          owner_id: string
          player_id: string
          position_played: string | null
          rating: number | null
          season_id: string | null
        }
        Insert: {
          id?: string
          is_starter?: boolean
          match_id: string
          minutes_played?: number | null
          owner_id: string
          player_id: string
          position_played?: string | null
          rating?: number | null
          season_id?: string | null
        }
        Update: {
          id?: string
          is_starter?: boolean
          match_id?: string
          minutes_played?: number | null
          owner_id?: string
          player_id?: string
          position_played?: string | null
          rating?: number | null
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_lineups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_player_positions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at_minute_abs: number | null
          formation_id: string | null
          id: string
          match_id: string
          owner_id: string | null
          part_index: number
          player_id: string
          role: string | null
          season_id: string | null
          slot_id: string
          source: string
          starts_at_minute_abs: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at_minute_abs?: number | null
          formation_id?: string | null
          id?: string
          match_id: string
          owner_id?: string | null
          part_index?: number
          player_id: string
          role?: string | null
          season_id?: string | null
          slot_id: string
          source: string
          starts_at_minute_abs: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at_minute_abs?: number | null
          formation_id?: string | null
          id?: string
          match_id?: string
          owner_id?: string | null
          part_index?: number
          player_id?: string
          role?: string | null
          season_id?: string | null
          slot_id?: string
          source?: string
          starts_at_minute_abs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_player_positions_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "match_formations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_positions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_positions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_positions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_player_positions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_report_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          club_id: string | null
          created_at: string
          id: string
          match_id: string | null
          match_report_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          club_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          match_report_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          club_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          match_report_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_report_audit_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_report_audit_logs_match_report_id_fkey"
            columns: ["match_report_id"]
            isOneToOne: false
            referencedRelation: "match_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      match_report_edits: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          diff_json: Json
          id: string
          match_report_id: string
          version_from: number | null
          version_to: number | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          diff_json?: Json
          id?: string
          match_report_id: string
          version_from?: number | null
          version_to?: number | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          diff_json?: Json
          id?: string
          match_report_id?: string
          version_from?: number | null
          version_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_report_edits_match_report_id_fkey"
            columns: ["match_report_id"]
            isOneToOne: false
            referencedRelation: "match_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      match_report_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          match_report_id: string
          snapshot_json: Json
          version_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_report_id: string
          snapshot_json?: Json
          version_no: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_report_id?: string
          snapshot_json?: Json
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_report_versions_match_report_id_fkey"
            columns: ["match_report_id"]
            isOneToOne: false
            referencedRelation: "match_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reports: {
        Row: {
          club_id: string | null
          created_at: string
          created_by: string | null
          current_version_no: number
          ended_at: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          match_id: string
          notes: string | null
          reopened_at: string | null
          reopened_by: string | null
          report_entry_mode: string
          report_status: string
          started_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_no?: number
          ended_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          match_id: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          report_entry_mode?: string
          report_status?: string
          started_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_no?: number
          ended_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          match_id?: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          report_entry_mode?: string
          report_status?: string
          started_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_reports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rule_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rule_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rule_profiles: {
        Row: {
          age_group_code: string | null
          club_id: string | null
          competition_name: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          halftime_minutes: number
          id: string
          is_active: boolean
          is_system_default: boolean
          max_players_on_field: number
          modality_code: string
          name: string
          notes: string | null
          period_1_minutes: number
          period_2_minutes: number
          period_3_minutes: number | null
          period_4_minutes: number | null
          period_count: number
          reentry_allowed: boolean
          rolling_substitutions: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          age_group_code?: string | null
          club_id?: string | null
          competition_name?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          halftime_minutes?: number
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          max_players_on_field: number
          modality_code: string
          name: string
          notes?: string | null
          period_1_minutes?: number
          period_2_minutes?: number
          period_3_minutes?: number | null
          period_4_minutes?: number | null
          period_count?: number
          reentry_allowed?: boolean
          rolling_substitutions?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          age_group_code?: string | null
          club_id?: string | null
          competition_name?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          halftime_minutes?: number
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          max_players_on_field?: number
          modality_code?: string
          name?: string
          notes?: string | null
          period_1_minutes?: number
          period_2_minutes?: number
          period_3_minutes?: number | null
          period_4_minutes?: number | null
          period_count?: number
          reentry_allowed?: boolean
          rolling_substitutions?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rule_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rule_snapshots: {
        Row: {
          age_group_code: string | null
          created_at: string
          id: string
          match_id: string
          modality_code: string
          rule_profile_id: string | null
          season_id: string | null
          snapshot_data: Json
          substitution_mode: string | null
        }
        Insert: {
          age_group_code?: string | null
          created_at?: string
          id?: string
          match_id: string
          modality_code: string
          rule_profile_id?: string | null
          season_id?: string | null
          snapshot_data?: Json
          substitution_mode?: string | null
        }
        Update: {
          age_group_code?: string | null
          created_at?: string
          id?: string
          match_id?: string
          modality_code?: string
          rule_profile_id?: string | null
          season_id?: string | null
          snapshot_data?: Json
          substitution_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rule_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rule_snapshots_rule_profile_id_fkey"
            columns: ["rule_profile_id"]
            isOneToOne: false
            referencedRelation: "match_rule_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rule_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rule_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_rule_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      match_tactical_changes: {
        Row: {
          change_type: string
          created_at: string
          created_by: string | null
          id: string
          match_id: string
          minute_abs: number
          owner_id: string | null
          part_index: number | null
          payload: Json
          season_id: string | null
        }
        Insert: {
          change_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_id: string
          minute_abs: number
          owner_id?: string | null
          part_index?: number | null
          payload?: Json
          season_id?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_id?: string
          minute_abs?: number
          owner_id?: string | null
          part_index?: number | null
          payload?: Json
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_tactical_changes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tactical_changes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_tactical_changes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "match_tactical_changes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      matches: {
        Row: {
          bench_ids: string[] | null
          competition: string | null
          created_at: string
          current_part: number | null
          deleted_at: string | null
          deleted_by: string | null
          goals_against: number | null
          goals_for: number | null
          id: string
          is_deleted: boolean
          is_home: boolean
          is_test: boolean
          last_paused_seconds: number | null
          last_timer_start: string | null
          location: string | null
          match_date: string
          match_phase: string | null
          match_type: string | null
          notes: string | null
          on_field_ids: string[] | null
          opponent_name: string
          owner_id: string
          part_duration_minutes: number | null
          part_elapsed_seconds: Json | null
          part_real_seconds: number[] | null
          part_regulation_minutes: number[] | null
          part_started_at_ms: number | null
          part_starter_ids: Json | null
          parts_count: number | null
          report_entry_mode: string
          report_status: string
          season_id: string | null
          second_half_starter_ids: string[] | null
          second_half_starter_set_at: string | null
          second_half_starter_set_by: string | null
          starter_ids: string[] | null
          status: string
          substitution_mode: string | null
          team_id: string
          tournament_locked: boolean | null
          updated_at: string
        }
        Insert: {
          bench_ids?: string[] | null
          competition?: string | null
          created_at?: string
          current_part?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          is_deleted?: boolean
          is_home?: boolean
          is_test?: boolean
          last_paused_seconds?: number | null
          last_timer_start?: string | null
          location?: string | null
          match_date: string
          match_phase?: string | null
          match_type?: string | null
          notes?: string | null
          on_field_ids?: string[] | null
          opponent_name: string
          owner_id: string
          part_duration_minutes?: number | null
          part_elapsed_seconds?: Json | null
          part_real_seconds?: number[] | null
          part_regulation_minutes?: number[] | null
          part_started_at_ms?: number | null
          part_starter_ids?: Json | null
          parts_count?: number | null
          report_entry_mode?: string
          report_status?: string
          season_id?: string | null
          second_half_starter_ids?: string[] | null
          second_half_starter_set_at?: string | null
          second_half_starter_set_by?: string | null
          starter_ids?: string[] | null
          status?: string
          substitution_mode?: string | null
          team_id: string
          tournament_locked?: boolean | null
          updated_at?: string
        }
        Update: {
          bench_ids?: string[] | null
          competition?: string | null
          created_at?: string
          current_part?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          is_deleted?: boolean
          is_home?: boolean
          is_test?: boolean
          last_paused_seconds?: number | null
          last_timer_start?: string | null
          location?: string | null
          match_date?: string
          match_phase?: string | null
          match_type?: string | null
          notes?: string | null
          on_field_ids?: string[] | null
          opponent_name?: string
          owner_id?: string
          part_duration_minutes?: number | null
          part_elapsed_seconds?: Json | null
          part_real_seconds?: number[] | null
          part_regulation_minutes?: number[] | null
          part_started_at_ms?: number | null
          part_starter_ids?: Json | null
          parts_count?: number | null
          report_entry_mode?: string
          report_status?: string
          season_id?: string | null
          second_half_starter_ids?: string[] | null
          second_half_starter_set_at?: string | null
          second_half_starter_set_by?: string | null
          starter_ids?: string[] | null
          status?: string
          substitution_mode?: string | null
          team_id?: string
          tournament_locked?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          club_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          person_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          club_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          person_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          club_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          person_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_allergies: {
        Row: {
          allergen: string
          created_at: string
          id: string
          medical_profile_id: string
          notes: string | null
          reaction_type: string | null
          severity: string
        }
        Insert: {
          allergen: string
          created_at?: string
          id?: string
          medical_profile_id: string
          notes?: string | null
          reaction_type?: string | null
          severity?: string
        }
        Update: {
          allergen?: string
          created_at?: string
          id?: string
          medical_profile_id?: string
          notes?: string | null
          reaction_type?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_allergies_medical_profile_id_fkey"
            columns: ["medical_profile_id"]
            isOneToOne: false
            referencedRelation: "medical_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_audit_logs: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          club_id: string
          context: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id: string
          context?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id?: string
          context?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_clearances: {
        Row: {
          clearance_status: string
          clearance_type: string
          clinical_notes: string | null
          club_id: string
          created_at: string
          granted_at: string | null
          granted_by: string | null
          id: string
          person_id: string
          related_exam_id: string | null
          related_injury_id: string | null
          restrictions: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          season_id: string | null
          supporting_documents: Json | null
          team_id: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          clearance_status?: string
          clearance_type?: string
          clinical_notes?: string | null
          club_id: string
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          person_id: string
          related_exam_id?: string | null
          related_injury_id?: string | null
          restrictions?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          season_id?: string | null
          supporting_documents?: Json | null
          team_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          clearance_status?: string
          clearance_type?: string
          clinical_notes?: string | null
          club_id?: string
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          person_id?: string
          related_exam_id?: string | null
          related_injury_id?: string | null
          restrictions?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          season_id?: string | null
          supporting_documents?: Json | null
          team_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_clearances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_clearances_related_exam_id_fkey"
            columns: ["related_exam_id"]
            isOneToOne: false
            referencedRelation: "medical_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_clearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_compliance_items: {
        Row: {
          club_id: string
          completed_date: string | null
          compliance_type: string
          created_at: string
          description: string | null
          evidence_url: string | null
          id: string
          notes: string | null
          person_id: string | null
          required_by_date: string | null
          responsible_user_id: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          completed_date?: string | null
          compliance_type: string
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          required_by_date?: string | null
          responsible_user_id?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          completed_date?: string | null
          compliance_type?: string
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          required_by_date?: string | null
          responsible_user_id?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_compliance_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_compliance_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_conditions: {
        Row: {
          condition_name: string
          condition_type: string
          created_at: string
          diagnosed_date: string | null
          id: string
          medical_profile_id: string
          notes: string | null
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condition_name: string
          condition_type: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          medical_profile_id: string
          notes?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condition_name?: string
          condition_type?: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          medical_profile_id?: string
          notes?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_conditions_medical_profile_id_fkey"
            columns: ["medical_profile_id"]
            isOneToOne: false
            referencedRelation: "medical_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_documents: {
        Row: {
          club_id: string
          created_at: string
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          mandatory: boolean
          notes: string | null
          person_id: string
          status: string
          updated_at: string
          uploaded_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          mandatory?: boolean
          notes?: string | null
          person_id: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          mandatory?: boolean
          notes?: string | null
          person_id?: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_equipment_checks: {
        Row: {
          asset_item_id: string | null
          check_date: string
          check_result: string
          check_type: string
          checked_by: string | null
          club_id: string
          corrective_action: string | null
          created_at: string
          equipment_name: string
          equipment_type: string
          facility_id: string | null
          findings: string | null
          id: string
          next_check_date: string | null
          photo_urls: Json | null
          status: string
        }
        Insert: {
          asset_item_id?: string | null
          check_date: string
          check_result?: string
          check_type?: string
          checked_by?: string | null
          club_id: string
          corrective_action?: string | null
          created_at?: string
          equipment_name: string
          equipment_type: string
          facility_id?: string | null
          findings?: string | null
          id?: string
          next_check_date?: string | null
          photo_urls?: Json | null
          status?: string
        }
        Update: {
          asset_item_id?: string | null
          check_date?: string
          check_result?: string
          check_type?: string
          checked_by?: string | null
          club_id?: string
          corrective_action?: string | null
          created_at?: string
          equipment_name?: string
          equipment_type?: string
          facility_id?: string | null
          findings?: string | null
          id?: string
          next_check_date?: string | null
          photo_urls?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_equipment_checks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_exam_types: {
        Row: {
          category: string
          club_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          max_age: number | null
          min_age: number | null
          name: string
          protocol_notes: string | null
          required_for_competition: boolean
          validity_months: number | null
        }
        Insert: {
          category?: string
          club_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_age?: number | null
          min_age?: number | null
          name: string
          protocol_notes?: string | null
          required_for_competition?: boolean
          validity_months?: number | null
        }
        Update: {
          category?: string
          club_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_age?: number | null
          min_age?: number | null
          name?: string
          protocol_notes?: string | null
          required_for_competition?: boolean
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_exam_types_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_exams: {
        Row: {
          club_id: string
          cost: number | null
          cost_center_id: string | null
          created_at: string
          exam_type_code: string
          exam_type_id: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          notes: string | null
          performed_by_staff_id: string | null
          performed_date: string | null
          person_id: string
          provider_location: string | null
          provider_name: string | null
          requested_by: string | null
          result_status: string | null
          result_summary: string | null
          scheduled_date: string | null
          season_id: string | null
          status: string
          team_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          club_id: string
          cost?: number | null
          cost_center_id?: string | null
          created_at?: string
          exam_type_code: string
          exam_type_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by_staff_id?: string | null
          performed_date?: string | null
          person_id: string
          provider_location?: string | null
          provider_name?: string | null
          requested_by?: string | null
          result_status?: string | null
          result_summary?: string | null
          scheduled_date?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          club_id?: string
          cost?: number | null
          cost_center_id?: string | null
          created_at?: string
          exam_type_code?: string
          exam_type_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by_staff_id?: string | null
          performed_date?: string | null
          person_id?: string
          provider_location?: string | null
          provider_name?: string | null
          requested_by?: string | null
          result_status?: string | null
          result_summary?: string | null
          scheduled_date?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_exams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_exams_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "medical_exam_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_exams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_medications: {
        Row: {
          created_at: string
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          medical_profile_id: string
          medication_name: string
          notes: string | null
          prescribed_by: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medical_profile_id: string
          medication_name: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medical_profile_id?: string
          medication_name?: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_medications_medical_profile_id_fkey"
            columns: ["medical_profile_id"]
            isOneToOne: false
            referencedRelation: "medical_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_profiles: {
        Row: {
          blood_type: string | null
          chronic_conditions: string | null
          club_id: string
          created_at: string
          created_by: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          family_medical_history: string | null
          general_notes: string | null
          id: string
          metadata: Json | null
          person_id: string
          person_type: string
          profile_status: string
          surgical_history: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blood_type?: string | null
          chronic_conditions?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          family_medical_history?: string | null
          general_notes?: string | null
          id?: string
          metadata?: Json | null
          person_id: string
          person_type?: string
          profile_status?: string
          surgical_history?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blood_type?: string | null
          chronic_conditions?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          family_medical_history?: string | null
          general_notes?: string | null
          id?: string
          metadata?: Json | null
          person_id?: string
          person_type?: string
          profile_status?: string
          surgical_history?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_restrictions: {
        Row: {
          activities_allowed: string[] | null
          activities_blocked: string[] | null
          club_id: string
          created_at: string
          description: string
          end_date: string | null
          id: string
          issued_by: string | null
          notes: string | null
          origin_id: string | null
          origin_type: string | null
          person_id: string
          reassessment_date: string | null
          requires_reassessment: boolean
          restriction_type: string
          severity: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          activities_allowed?: string[] | null
          activities_blocked?: string[] | null
          club_id: string
          created_at?: string
          description: string
          end_date?: string | null
          id?: string
          issued_by?: string | null
          notes?: string | null
          origin_id?: string | null
          origin_type?: string | null
          person_id: string
          reassessment_date?: string | null
          requires_reassessment?: boolean
          restriction_type: string
          severity?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          activities_allowed?: string[] | null
          activities_blocked?: string[] | null
          club_id?: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          issued_by?: string | null
          notes?: string | null
          origin_id?: string | null
          origin_type?: string | null
          person_id?: string
          reassessment_date?: string | null
          requires_reassessment?: boolean
          restriction_type?: string
          severity?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_restrictions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_staff_registry: {
        Row: {
          club_id: string
          contract_type: string | null
          created_at: string
          documents: Json | null
          id: string
          is_active: boolean
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          person_name: string
          qualification_details: string | null
          specialty: string | null
          staff_role: string
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          club_id: string
          contract_type?: string | null
          created_at?: string
          documents?: Json | null
          id?: string
          is_active?: boolean
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          person_name: string
          qualification_details?: string | null
          specialty?: string | null
          staff_role: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          club_id?: string
          contract_type?: string | null
          created_at?: string
          documents?: Json | null
          id?: string
          is_active?: boolean
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          person_name?: string
          qualification_details?: string | null
          specialty?: string | null
          staff_role?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_staff_registry_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_staff_registry_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_paid: boolean
          member_id: string
          month: number
          owner_id: string
          paid_at: string | null
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id: string
          month: number
          owner_id: string
          paid_at?: string | null
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_paid?: boolean
          member_id?: string
          month?: number
          owner_id?: string
          paid_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          annual_fee: number
          benefits: string | null
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          monthly_fee: number
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          annual_fee?: number
          benefits?: string | null
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          annual_fee?: number
          benefits?: string | null
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          charge_id: string
          created_at: string
          id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          charge_id: string
          created_at?: string
          id?: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          charge_id?: string
          created_at?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_config: {
        Row: {
          beneficiary_name: string | null
          club_id: string
          created_at: string
          iban: string | null
          id: string
          instructions: string | null
          mbway_number: string | null
          updated_at: string
        }
        Insert: {
          beneficiary_name?: string | null
          club_id: string
          created_at?: string
          iban?: string | null
          id?: string
          instructions?: string | null
          mbway_number?: string | null
          updated_at?: string
        }
        Update: {
          beneficiary_name?: string | null
          club_id?: string
          created_at?: string
          iban?: string | null
          id?: string
          instructions?: string | null
          mbway_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_config_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_config_audit: {
        Row: {
          action: string
          changed_by: string
          club_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          changed_by: string
          club_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string
          club_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_config_audit_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          event_source: string
          event_type: string
          id: string
          payload: Json | null
          payment_intent_id: string | null
          payment_transaction_id: string | null
          provider_event_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          event_source?: string
          event_type: string
          id?: string
          payload?: Json | null
          payment_intent_id?: string | null
          payment_transaction_id?: string | null
          provider_event_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          event_source?: string
          event_type?: string
          id?: string
          payload?: Json | null
          payment_intent_id?: string | null
          payment_transaction_id?: string | null
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          cancel_url: string | null
          charge_id: string | null
          checkout_url: string | null
          client_reference: string | null
          club_id: string
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string | null
          guardian_id: string | null
          id: string
          metadata: Json | null
          payment_method_code: string
          payment_mode: string | null
          player_id: string | null
          provider_intent_id: string | null
          provider_session_id: string | null
          provider_type: string
          season_id: string | null
          status: string
          success_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_url?: string | null
          charge_id?: string | null
          checkout_url?: string | null
          client_reference?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          guardian_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method_code?: string
          payment_mode?: string | null
          player_id?: string | null
          provider_intent_id?: string | null
          provider_session_id?: string | null
          provider_type?: string
          season_id?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_url?: string | null
          charge_id?: string | null
          checkout_url?: string | null
          client_reference?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          guardian_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method_code?: string
          payment_mode?: string | null
          player_id?: string | null
          provider_intent_id?: string | null
          provider_session_id?: string | null
          provider_type?: string
          season_id?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "payment_intents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          available_on: string | null
          charge_id: string | null
          club_id: string
          created_at: string
          currency: string
          dispute_status: string | null
          fee_amount: number
          gross_amount: number
          id: string
          is_manual: boolean | null
          manual_method: string | null
          manual_reference: string | null
          net_amount: number
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_intent_id: string | null
          payment_method_code: string
          proof_url: string | null
          provider_charge_id: string | null
          provider_customer_id: string | null
          provider_invoice_id: string | null
          provider_payment_id: string | null
          provider_type: string
          raw_provider_payload: Json | null
          refund_status: string | null
          registered_by: string | null
          settlement_reference: string | null
          transaction_date: string
          transaction_reference: string | null
          transaction_status: string
          updated_at: string
        }
        Insert: {
          available_on?: string | null
          charge_id?: string | null
          club_id: string
          created_at?: string
          currency?: string
          dispute_status?: string | null
          fee_amount?: number
          gross_amount: number
          id?: string
          is_manual?: boolean | null
          manual_method?: string | null
          manual_reference?: string | null
          net_amount: number
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_intent_id?: string | null
          payment_method_code?: string
          proof_url?: string | null
          provider_charge_id?: string | null
          provider_customer_id?: string | null
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          provider_type?: string
          raw_provider_payload?: Json | null
          refund_status?: string | null
          registered_by?: string | null
          settlement_reference?: string | null
          transaction_date?: string
          transaction_reference?: string | null
          transaction_status?: string
          updated_at?: string
        }
        Update: {
          available_on?: string | null
          charge_id?: string | null
          club_id?: string
          created_at?: string
          currency?: string
          dispute_status?: string | null
          fee_amount?: number
          gross_amount?: number
          id?: string
          is_manual?: boolean | null
          manual_method?: string | null
          manual_reference?: string | null
          net_amount?: number
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_intent_id?: string | null
          payment_method_code?: string
          proof_url?: string | null
          provider_charge_id?: string | null
          provider_customer_id?: string | null
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          provider_type?: string
          raw_provider_payload?: Json | null
          refund_status?: string | null
          registered_by?: string | null
          settlement_reference?: string | null
          transaction_date?: string
          transaction_reference?: string | null
          transaction_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          club_id: string
          created_at: string
          guardian_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          player_id: string | null
          received_by_user_id: string
          season_id: string | null
          status: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount_paid: number
          club_id: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          player_id?: string | null
          received_by_user_id: string
          season_id?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          club_id?: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          player_id?: string | null
          received_by_user_id?: string
          season_id?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "payments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      payroll_cycles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          club_id: string
          created_at: string
          end_date: string
          fiscal_year: number
          id: string
          payroll_type: string | null
          period_month: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          club_id: string
          created_at?: string
          end_date: string
          fiscal_year: number
          id?: string
          payroll_type?: string | null
          period_month: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          club_id?: string
          created_at?: string
          end_date?: string
          fiscal_year?: number
          id?: string
          payroll_type?: string | null
          period_month?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_cycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          contract_id: string | null
          created_at: string
          deductions_amount: number
          employer_charges_amount: number
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          payable_amount: number
          payment_due_date: string | null
          payroll_cycle_id: string
          person_id: string
          staff_profile_id: string | null
          status: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          deductions_amount?: number
          employer_charges_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payable_amount?: number
          payment_due_date?: string | null
          payroll_cycle_id: string
          person_id: string
          staff_profile_id?: string | null
          status?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          deductions_amount?: number
          employer_charges_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          payable_amount?: number
          payment_due_date?: string | null
          payroll_cycle_id?: string
          person_id?: string
          staff_profile_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_cycle_id_fkey"
            columns: ["payroll_cycle_id"]
            isOneToOne: false
            referencedRelation: "payroll_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entry_lines: {
        Row: {
          amount: number
          component_id: string | null
          contributory: boolean | null
          created_at: string
          id: string
          line_type: string
          notes: string | null
          payroll_entry_id: string
          quantity: number | null
          rate: number | null
          taxable: boolean | null
        }
        Insert: {
          amount?: number
          component_id?: string | null
          contributory?: boolean | null
          created_at?: string
          id?: string
          line_type: string
          notes?: string | null
          payroll_entry_id: string
          quantity?: number | null
          rate?: number | null
          taxable?: boolean | null
        }
        Update: {
          amount?: number
          component_id?: string | null
          contributory?: boolean | null
          created_at?: string
          id?: string
          line_type?: string
          notes?: string | null
          payroll_entry_id?: string
          quantity?: number | null
          rate?: number | null
          taxable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entry_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "compensation_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entry_lines_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payments: {
        Row: {
          bank_reference: string | null
          club_id: string
          contractor_fee_entry_id: string | null
          created_at: string
          deductions_amount: number | null
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          obligation_id: string | null
          payment_date: string
          payment_method: string | null
          payroll_entry_id: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          status: string | null
        }
        Insert: {
          bank_reference?: string | null
          club_id: string
          contractor_fee_entry_id?: string | null
          created_at?: string
          deductions_amount?: number | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          obligation_id?: string | null
          payment_date: string
          payment_method?: string | null
          payroll_entry_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          status?: string | null
        }
        Update: {
          bank_reference?: string | null
          club_id?: string
          contractor_fee_entry_id?: string | null
          created_at?: string
          deductions_amount?: number | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          obligation_id?: string | null
          payment_date?: string
          payment_method?: string | null
          payroll_entry_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_contractor_fee_entry_id_fkey"
            columns: ["contractor_fee_entry_id"]
            isOneToOne: false
            referencedRelation: "contractor_fee_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "statutory_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      people_registry: {
        Row: {
          address: string | null
          birth_date: string | null
          club_id: string
          created_at: string
          email: string | null
          emergency_contact: Json | null
          full_name: string
          id: string
          national_id: string | null
          nationality: string | null
          person_type: string
          phone: string | null
          status: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          club_id: string
          created_at?: string
          email?: string | null
          emergency_contact?: Json | null
          full_name: string
          id?: string
          national_id?: string | null
          nationality?: string | null
          person_type?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          club_id?: string
          created_at?: string
          email?: string | null
          emergency_contact?: Json | null
          full_name?: string
          id?: string
          national_id?: string | null
          nationality?: string | null
          person_type?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_registry_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_assessments: {
        Row: {
          assessment_date: string
          club_id: string
          created_at: string
          created_by: string
          findings: string | null
          id: string
          injury_id: string | null
          next_review_date: string | null
          pain_level: number | null
          player_id: string
          recommendation: string | null
          season_id: string | null
          updated_at: string
        }
        Insert: {
          assessment_date?: string
          club_id: string
          created_at?: string
          created_by: string
          findings?: string | null
          id?: string
          injury_id?: string | null
          next_review_date?: string | null
          pain_level?: number | null
          player_id: string
          recommendation?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          club_id?: string
          created_at?: string
          created_by?: string
          findings?: string | null
          id?: string
          injury_id?: string | null
          next_review_date?: string | null
          pain_level?: number | null
          player_id?: string
          recommendation?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_assessments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_assessments_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "physio_injuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_assessments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_assessments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_assessments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      physio_daily_logs: {
        Row: {
          adherence: boolean | null
          club_id: string
          created_at: string
          created_by: string
          fatigue_level: number | null
          id: string
          log_date: string
          notes: string | null
          pain_level: number | null
          player_id: string
          season_id: string | null
          sleep_quality: number | null
        }
        Insert: {
          adherence?: boolean | null
          club_id: string
          created_at?: string
          created_by: string
          fatigue_level?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          pain_level?: number | null
          player_id: string
          season_id?: string | null
          sleep_quality?: number | null
        }
        Update: {
          adherence?: boolean | null
          club_id?: string
          created_at?: string
          created_by?: string
          fatigue_level?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          pain_level?: number | null
          player_id?: string
          season_id?: string | null
          sleep_quality?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physio_daily_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_daily_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_daily_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_daily_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_daily_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_daily_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      physio_injuries: {
        Row: {
          body_area: string
          club_id: string
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          injury_type: string
          is_fit: boolean | null
          notes: string | null
          player_id: string
          restrictions: string | null
          season_id: string | null
          severity: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          body_area: string
          club_id: string
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          injury_type: string
          is_fit?: boolean | null
          notes?: string | null
          player_id: string
          restrictions?: string | null
          season_id?: string | null
          severity?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          body_area?: string
          club_id?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          injury_type?: string
          is_fit?: boolean | null
          notes?: string | null
          player_id?: string
          restrictions?: string | null
          season_id?: string | null
          severity?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_injuries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      physio_medical_documents: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          file_url: string
          id: string
          player_id: string
          related_id: string | null
          related_type: string | null
          season_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          file_url: string
          id?: string
          player_id: string
          related_id?: string | null
          related_type?: string | null
          season_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          file_url?: string
          id?: string
          player_id?: string
          related_id?: string | null
          related_type?: string | null
          season_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_medical_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_medical_documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_medical_documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_medical_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_medical_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_medical_documents_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      physio_sessions: {
        Row: {
          athlete_response: string | null
          attachments: Json | null
          attendance_status: string
          club_id: string
          cost: number | null
          cost_center_id: string | null
          created_at: string
          duration_minutes: number | null
          evolution_notes: string | null
          id: string
          injury_case_id: string | null
          location: string | null
          modality: string
          pain_after: number | null
          pain_before: number | null
          person_id: string
          season_id: string | null
          session_date: string
          session_time: string | null
          therapist_id: string | null
          treatment_plan_id: string | null
          updated_at: string
        }
        Insert: {
          athlete_response?: string | null
          attachments?: Json | null
          attendance_status?: string
          club_id: string
          cost?: number | null
          cost_center_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evolution_notes?: string | null
          id?: string
          injury_case_id?: string | null
          location?: string | null
          modality: string
          pain_after?: number | null
          pain_before?: number | null
          person_id: string
          season_id?: string | null
          session_date: string
          session_time?: string | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          athlete_response?: string | null
          attachments?: Json | null
          attendance_status?: string
          club_id?: string
          cost?: number | null
          cost_center_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          evolution_notes?: string | null
          id?: string
          injury_case_id?: string | null
          location?: string | null
          modality?: string
          pain_after?: number | null
          pain_before?: number | null
          person_id?: string
          season_id?: string | null
          session_date?: string
          session_time?: string | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_injury_case_id_fkey"
            columns: ["injury_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "physio_sessions_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      player_accounts: {
        Row: {
          created_at: string
          id: string
          player_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_content_reads: {
        Row: {
          content_id: string
          id: string
          player_id: string
          read_at: string
        }
        Insert: {
          content_id: string
          id?: string
          player_id: string
          read_at?: string
        }
        Update: {
          content_id?: string
          id?: string
          player_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_content_reads_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "player_technical_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_content_reads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_content_reads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_evaluations: {
        Row: {
          attributes: Json
          context: string | null
          created_at: string
          evaluation_date: string
          evaluator_id: string | null
          id: string
          improvement_text: string | null
          mental_rating: number | null
          notes: string | null
          overall_rating: number | null
          owner_id: string
          period_label: string | null
          physical_rating: number | null
          player_id: string
          recommendation: string | null
          season_id: string | null
          season_label: string | null
          strengths: string | null
          strengths_text: string | null
          tactical_rating: number | null
          technical_rating: number | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          attributes?: Json
          context?: string | null
          created_at?: string
          evaluation_date?: string
          evaluator_id?: string | null
          id?: string
          improvement_text?: string | null
          mental_rating?: number | null
          notes?: string | null
          overall_rating?: number | null
          owner_id: string
          period_label?: string | null
          physical_rating?: number | null
          player_id: string
          recommendation?: string | null
          season_id?: string | null
          season_label?: string | null
          strengths?: string | null
          strengths_text?: string | null
          tactical_rating?: number | null
          technical_rating?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          attributes?: Json
          context?: string | null
          created_at?: string
          evaluation_date?: string
          evaluator_id?: string | null
          id?: string
          improvement_text?: string | null
          mental_rating?: number | null
          notes?: string | null
          overall_rating?: number | null
          owner_id?: string
          period_label?: string | null
          physical_rating?: number | null
          player_id?: string
          recommendation?: string | null
          season_id?: string | null
          season_label?: string | null
          strengths?: string | null
          strengths_text?: string | null
          tactical_rating?: number | null
          technical_rating?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_evaluations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "player_evaluations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      player_fees: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          due_date: string | null
          id: string
          is_paid: boolean
          month: number
          notes: string | null
          owner_id: string
          paid_at: string | null
          player_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          club_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_paid?: boolean
          month: number
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          player_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_paid?: boolean
          month?: number
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          player_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_fees_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_fees_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_fees_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          is_primary: boolean | null
          player_id: string
          relationship: string | null
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          is_primary?: boolean | null
          player_id: string
          relationship?: string | null
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary?: boolean | null
          player_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_history: {
        Row: {
          club_name: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          player_id: string
          position: string | null
          start_date: string | null
        }
        Insert: {
          club_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          player_id: string
          position?: string | null
          start_date?: string | null
        }
        Update: {
          club_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          player_id?: string
          position?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_injuries: {
        Row: {
          body_part: string | null
          body_side: string | null
          can_play: boolean
          clinical_notes: string | null
          clinical_status: string
          context: string | null
          created_at: string
          description: string | null
          diagnosis: string | null
          expected_return_date: string | null
          id: string
          injury_date: string
          injury_type: string
          is_recurrence: boolean
          matches_missed: number
          owner_id: string
          player_id: string
          responsible_professional: string | null
          restrictions: string | null
          return_date: string | null
          season_id: string | null
          severity: string
          trainings_missed: number
          treatment: string | null
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          body_part?: string | null
          body_side?: string | null
          can_play?: boolean
          clinical_notes?: string | null
          clinical_status?: string
          context?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          expected_return_date?: string | null
          id?: string
          injury_date: string
          injury_type: string
          is_recurrence?: boolean
          matches_missed?: number
          owner_id: string
          player_id: string
          responsible_professional?: string | null
          restrictions?: string | null
          return_date?: string | null
          season_id?: string | null
          severity?: string
          trainings_missed?: number
          treatment?: string | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          body_part?: string | null
          body_side?: string | null
          can_play?: boolean
          clinical_notes?: string | null
          clinical_status?: string
          context?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          expected_return_date?: string | null
          id?: string
          injury_date?: string
          injury_type?: string
          is_recurrence?: boolean
          matches_missed?: number
          owner_id?: string
          player_id?: string
          responsible_professional?: string | null
          restrictions?: string | null
          return_date?: string | null
          season_id?: string | null
          severity?: string
          trainings_missed?: number
          treatment?: string | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "player_injuries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      player_season_snapshots: {
        Row: {
          age_group: string | null
          assists: number
          attendance_rate: number | null
          avg_overall: number | null
          created_at: string
          created_by: string | null
          evaluations_count: number
          games_count: number | null
          goals: number
          id: string
          improvements_summary: string | null
          minutes_by_role: Json
          minutes_total: number | null
          player_id: string
          predominant_role: string | null
          red_cards: number
          season_id: string | null
          season_label: string
          starts_count: number
          strengths_summary: string | null
          summary_notes: string | null
          team_id: string | null
          trainings_count: number | null
          trainings_present: number
          trainings_total: number
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          age_group?: string | null
          assists?: number
          attendance_rate?: number | null
          avg_overall?: number | null
          created_at?: string
          created_by?: string | null
          evaluations_count?: number
          games_count?: number | null
          goals?: number
          id?: string
          improvements_summary?: string | null
          minutes_by_role?: Json
          minutes_total?: number | null
          player_id: string
          predominant_role?: string | null
          red_cards?: number
          season_id?: string | null
          season_label: string
          starts_count?: number
          strengths_summary?: string | null
          summary_notes?: string | null
          team_id?: string | null
          trainings_count?: number | null
          trainings_present?: number
          trainings_total?: number
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          age_group?: string | null
          assists?: number
          attendance_rate?: number | null
          avg_overall?: number | null
          created_at?: string
          created_by?: string | null
          evaluations_count?: number
          games_count?: number | null
          goals?: number
          id?: string
          improvements_summary?: string | null
          minutes_by_role?: Json
          minutes_total?: number | null
          player_id?: string
          predominant_role?: string | null
          red_cards?: number
          season_id?: string | null
          season_label?: string
          starts_count?: number
          strengths_summary?: string | null
          summary_notes?: string | null
          team_id?: string | null
          trainings_count?: number | null
          trainings_present?: number
          trainings_total?: number
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_season_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "player_season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "player_season_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_strengths_focus: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          player_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          player_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          player_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_strengths_focus_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_strengths_focus_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_technical_content: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string | null
          club_id: string | null
          content_type: string
          created_at: string
          created_by: string
          id: string
          is_mandatory_read: boolean | null
          related_match_id: string | null
          related_training_id: string | null
          target_group: string | null
          target_player_id: string | null
          target_position: string | null
          target_type: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          club_id?: string | null
          content_type?: string
          created_at?: string
          created_by: string
          id?: string
          is_mandatory_read?: boolean | null
          related_match_id?: string | null
          related_training_id?: string | null
          target_group?: string | null
          target_player_id?: string | null
          target_position?: string | null
          target_type?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          club_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_mandatory_read?: boolean | null
          related_match_id?: string | null
          related_training_id?: string | null
          target_group?: string | null
          target_player_id?: string | null
          target_position?: string | null
          target_type?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_technical_content_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_technical_content_related_match_id_fkey"
            columns: ["related_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_technical_content_related_training_id_fkey"
            columns: ["related_training_id"]
            isOneToOne: false
            referencedRelation: "coach_trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_technical_content_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_technical_content_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_technical_content_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          created_at: string
          email: string | null
          federation_id: string | null
          foot: string | null
          gender: string
          height_cm: number | null
          id: string
          id_document_expiry: string | null
          id_document_number: string | null
          id_document_type: string | null
          id_document_url: string | null
          is_active: boolean
          medical_certificate_expiry: string | null
          medical_certificate_url: string | null
          name: string
          nationality: string | null
          notes: string | null
          number: number | null
          owner_id: string
          parent_email: string | null
          parent_email_2: string | null
          parent_name: string | null
          parent_name_2: string | null
          parent_phone: string | null
          parent_phone_2: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          secondary_positions: string[] | null
          status: Database["public"]["Enums"]["player_status"]
          tax_id: string | null
          team_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          email?: string | null
          federation_id?: string | null
          foot?: string | null
          gender?: string
          height_cm?: number | null
          id?: string
          id_document_expiry?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          id_document_url?: string | null
          is_active?: boolean
          medical_certificate_expiry?: string | null
          medical_certificate_url?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          number?: number | null
          owner_id: string
          parent_email?: string | null
          parent_email_2?: string | null
          parent_name?: string | null
          parent_name_2?: string | null
          parent_phone?: string | null
          parent_phone_2?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          secondary_positions?: string[] | null
          status?: Database["public"]["Enums"]["player_status"]
          tax_id?: string | null
          team_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          created_at?: string
          email?: string | null
          federation_id?: string | null
          foot?: string | null
          gender?: string
          height_cm?: number | null
          id?: string
          id_document_expiry?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          id_document_url?: string | null
          is_active?: boolean
          medical_certificate_expiry?: string | null
          medical_certificate_url?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          number?: number | null
          owner_id?: string
          parent_email?: string | null
          parent_email_2?: string | null
          parent_name?: string | null
          parent_name_2?: string | null
          parent_phone?: string | null
          parent_phone_2?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          secondary_positions?: string[] | null
          status?: Database["public"]["Enums"]["player_status"]
          tax_id?: string | null
          team_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_audit_logs: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          owner_id: string
          price_adjustment: number | null
          product_id: string
          size: string | null
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          owner_id: string
          price_adjustment?: number | null
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          price_adjustment?: number | null
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string | null
          club_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string | null
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string | null
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active_match_id: string | null
          created_at: string
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          language: string | null
          preferred_sport: string
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active_match_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          language?: string | null
          preferred_sport?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active_match_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          language?: string | null
          preferred_sport?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      prospect_profiles: {
        Row: {
          birth_quarter: number | null
          club_id: string
          confidence_score: number | null
          created_at: string
          created_by: string | null
          current_club_name: string | null
          current_team_level: string | null
          date_of_birth: string | null
          deleted_at: string | null
          dominant_foot: string | null
          full_name: string
          guardian_contact: string | null
          guardian_name: string | null
          height_cm: number | null
          id: string
          is_late_developer: boolean | null
          linked_player_id: string | null
          locality: string | null
          maturity_context: string | null
          metadata: Json | null
          nationality: string | null
          notes: string | null
          pipeline_status: string
          primary_position: string | null
          priority: string | null
          safeguarding_notes: string | null
          school_info: string | null
          season: string | null
          season_id: string | null
          secondary_position: string | null
          source: string | null
          source_detail: string | null
          status: string
          tags: string[] | null
          updated_at: string
          updated_by: string | null
          video_links: string[] | null
          weight_kg: number | null
        }
        Insert: {
          birth_quarter?: number | null
          club_id: string
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          current_club_name?: string | null
          current_team_level?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          dominant_foot?: string | null
          full_name: string
          guardian_contact?: string | null
          guardian_name?: string | null
          height_cm?: number | null
          id?: string
          is_late_developer?: boolean | null
          linked_player_id?: string | null
          locality?: string | null
          maturity_context?: string | null
          metadata?: Json | null
          nationality?: string | null
          notes?: string | null
          pipeline_status?: string
          primary_position?: string | null
          priority?: string | null
          safeguarding_notes?: string | null
          school_info?: string | null
          season?: string | null
          season_id?: string | null
          secondary_position?: string | null
          source?: string | null
          source_detail?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
          video_links?: string[] | null
          weight_kg?: number | null
        }
        Update: {
          birth_quarter?: number | null
          club_id?: string
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          current_club_name?: string | null
          current_team_level?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          dominant_foot?: string | null
          full_name?: string
          guardian_contact?: string | null
          guardian_name?: string | null
          height_cm?: number | null
          id?: string
          is_late_developer?: boolean | null
          linked_player_id?: string | null
          locality?: string | null
          maturity_context?: string | null
          metadata?: Json | null
          nationality?: string | null
          notes?: string | null
          pipeline_status?: string
          primary_position?: string | null
          priority?: string | null
          safeguarding_notes?: string | null
          school_info?: string | null
          season?: string | null
          season_id?: string | null
          secondary_position?: string | null
          source?: string | null
          source_detail?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
          video_links?: string[] | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_profiles_linked_player_id_fkey"
            columns: ["linked_player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_profiles_linked_player_id_fkey"
            columns: ["linked_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "prospect_profiles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      prospect_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          club_id: string
          id: string
          new_pipeline_stage: string | null
          new_status: string
          notes: string | null
          previous_pipeline_stage: string | null
          previous_status: string | null
          prospect_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          club_id: string
          id?: string
          new_pipeline_stage?: string | null
          new_status: string
          notes?: string | null
          previous_pipeline_stage?: string | null
          previous_status?: string | null
          prospect_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          club_id?: string
          id?: string
          new_pipeline_stage?: string | null
          new_status?: string
          notes?: string | null
          previous_pipeline_stage?: string | null
          previous_status?: string | null
          prospect_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_status_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_status_history_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_trials: {
        Row: {
          club_id: string
          consent_obtained: boolean | null
          created_at: string
          created_by: string | null
          decided_by: string | null
          feedback: string | null
          id: string
          notes: string | null
          observers: string[] | null
          outcome: string | null
          prospect_id: string
          status: string
          team_id: string | null
          trial_date: string
          trial_type: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          club_id: string
          consent_obtained?: boolean | null
          created_at?: string
          created_by?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          notes?: string | null
          observers?: string[] | null
          outcome?: string | null
          prospect_id: string
          status?: string
          team_id?: string | null
          trial_date: string
          trial_type?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          club_id?: string
          consent_obtained?: boolean | null
          created_at?: string
          created_by?: string | null
          decided_by?: string | null
          feedback?: string | null
          id?: string
          notes?: string | null
          observers?: string[] | null
          outcome?: string | null
          prospect_id?: string
          status?: string
          team_id?: string | null
          trial_date?: string
          trial_type?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_trials_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_trials_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_trials_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          category_id: string | null
          id: string
          invoiced_quantity: number | null
          item_description: string
          line_total: number | null
          purchase_order_id: string
          quantity: number | null
          received_quantity: number | null
          unit_cost: number | null
        }
        Insert: {
          category_id?: string | null
          id?: string
          invoiced_quantity?: number | null
          item_description: string
          line_total?: number | null
          purchase_order_id: string
          quantity?: number | null
          received_quantity?: number | null
          unit_cost?: number | null
        }
        Update: {
          category_id?: string | null
          id?: string
          invoiced_quantity?: number | null
          item_description?: string
          line_total?: number | null
          purchase_order_id?: string
          quantity?: number | null
          received_quantity?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_amount: number | null
          club_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          po_number: string | null
          season: string | null
          season_id: string | null
          source_purchase_request_id: string | null
          status: string
          team_id: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_amount?: number | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number?: string | null
          season?: string | null
          season_id?: string | null
          source_purchase_request_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_amount?: number | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number?: string | null
          season?: string | null
          season_id?: string | null
          source_purchase_request_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "purchase_orders_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "purchase_orders_source_purchase_request_id_fkey"
            columns: ["source_purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_lines: {
        Row: {
          category_id: string | null
          estimated_line_total: number | null
          id: string
          item_description: string
          notes: string | null
          purchase_request_id: string
          quantity: number | null
          unit: string | null
          unit_estimated_cost: number | null
        }
        Insert: {
          category_id?: string | null
          estimated_line_total?: number | null
          id?: string
          item_description: string
          notes?: string | null
          purchase_request_id: string
          quantity?: number | null
          unit?: string | null
          unit_estimated_cost?: number | null
        }
        Update: {
          category_id?: string | null
          estimated_line_total?: number | null
          id?: string
          item_description?: string
          notes?: string | null
          purchase_request_id?: string
          quantity?: number | null
          unit?: string | null
          unit_estimated_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_lines_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          budget_category_id: string | null
          club_id: string
          cost_center_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          estimated_amount: number | null
          id: string
          justification: string | null
          need_by_date: string | null
          request_number: string | null
          request_type: string | null
          requester_user_id: string
          season: string | null
          season_id: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
          urgency: string | null
          vendor_suggested_id: string | null
        }
        Insert: {
          budget_category_id?: string | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          justification?: string | null
          need_by_date?: string | null
          request_number?: string | null
          request_type?: string | null
          requester_user_id: string
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
          urgency?: string | null
          vendor_suggested_id?: string | null
        }
        Update: {
          budget_category_id?: string | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          justification?: string | null
          need_by_date?: string | null
          request_number?: string | null
          request_type?: string | null
          requester_user_id?: string
          season?: string | null
          season_id?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          urgency?: string | null
          vendor_suggested_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_budget_category_id_fkey"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "purchase_requests_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "purchase_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_vendor_suggested_id_fkey"
            columns: ["vendor_suggested_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_lines: {
        Row: {
          condition_status: string | null
          id: string
          notes: string | null
          purchase_order_line_id: string | null
          quantity_received: number | null
          receipt_id: string
        }
        Insert: {
          condition_status?: string | null
          id?: string
          notes?: string | null
          purchase_order_line_id?: string | null
          quantity_received?: number | null
          receipt_id: string
        }
        Update: {
          condition_status?: string | null
          id?: string
          notes?: string | null
          purchase_order_line_id?: string | null
          quantity_received?: number | null
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_needs: {
        Row: {
          age_range_max: number | null
          age_range_min: number | null
          budget_estimate: number | null
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          position: string
          priority: string | null
          profile_description: string | null
          reason: string | null
          season: string | null
          season_id: string | null
          status: string
          target_window: string | null
          team_id: string | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          age_range_max?: number | null
          age_range_min?: number | null
          budget_estimate?: number | null
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          position: string
          priority?: string | null
          profile_description?: string | null
          reason?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          target_window?: string | null
          team_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          age_range_max?: number | null
          age_range_min?: number | null
          budget_estimate?: number | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          position?: string
          priority?: string | null
          profile_description?: string | null
          reason?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          target_window?: string | null
          team_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_needs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_needs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_needs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "recruitment_needs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "recruitment_needs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_pipeline: {
        Row: {
          assigned_scout_id: string | null
          blockers: string | null
          club_id: string
          created_at: string
          created_by: string | null
          current_stage: string
          deadline: string | null
          decision: string | null
          decision_by: string | null
          decision_date: string | null
          decision_justification: string | null
          id: string
          metadata: Json | null
          next_step: string | null
          notes: string | null
          previous_stage: string | null
          prospect_id: string
          recruitment_need_id: string | null
          risk_level: string | null
          stage_entered_at: string
          updated_at: string
        }
        Insert: {
          assigned_scout_id?: string | null
          blockers?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          current_stage?: string
          deadline?: string | null
          decision?: string | null
          decision_by?: string | null
          decision_date?: string | null
          decision_justification?: string | null
          id?: string
          metadata?: Json | null
          next_step?: string | null
          notes?: string | null
          previous_stage?: string | null
          prospect_id: string
          recruitment_need_id?: string | null
          risk_level?: string | null
          stage_entered_at?: string
          updated_at?: string
        }
        Update: {
          assigned_scout_id?: string | null
          blockers?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          current_stage?: string
          deadline?: string | null
          decision?: string | null
          decision_by?: string | null
          decision_date?: string | null
          decision_justification?: string | null
          id?: string
          metadata?: Json | null
          next_step?: string | null
          notes?: string | null
          previous_stage?: string | null
          prospect_id?: string
          recruitment_need_id?: string | null
          risk_level?: string | null
          stage_entered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_pipeline_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_pipeline_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_pipeline_recruitment_need_id_fkey"
            columns: ["recruitment_need_id"]
            isOneToOne: false
            referencedRelation: "recruitment_needs"
            referencedColumns: ["id"]
          },
        ]
      }
      rehab_plan_exercises: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          exercise_name: string
          frequency: string | null
          id: string
          location: string | null
          order_index: number
          rehab_plan_id: string
          reps: number | null
          season_id: string | null
          sets: number | null
          video_url: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exercise_name: string
          frequency?: string | null
          id?: string
          location?: string | null
          order_index?: number
          rehab_plan_id: string
          reps?: number | null
          season_id?: string | null
          sets?: number | null
          video_url?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exercise_name?: string
          frequency?: string | null
          id?: string
          location?: string | null
          order_index?: number
          rehab_plan_id?: string
          reps?: number | null
          season_id?: string | null
          sets?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehab_plan_exercises_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plan_exercises_rehab_plan_id_fkey"
            columns: ["rehab_plan_id"]
            isOneToOne: false
            referencedRelation: "rehab_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plan_exercises_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plan_exercises_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "rehab_plan_exercises_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      rehab_plans: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          end_date: string | null
          goal: string | null
          id: string
          injury_id: string | null
          notes: string | null
          phase: string | null
          player_id: string
          season_id: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          end_date?: string | null
          goal?: string | null
          id?: string
          injury_id?: string | null
          notes?: string | null
          phase?: string | null
          player_id: string
          season_id?: string | null
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          injury_id?: string | null
          notes?: string | null
          phase?: string | null
          player_id?: string
          season_id?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehab_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "physio_injuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "rehab_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      rehab_programs: {
        Row: {
          actual_end_date: string | null
          baseline_notes: string | null
          club_id: string
          created_at: string
          created_by: string | null
          current_phase: string
          estimated_end_date: string | null
          goal: string | null
          id: string
          injury_case_id: string | null
          notes: string | null
          person_id: string
          phase_start_date: string | null
          program_status: string
          season_id: string | null
          start_date: string
          title: string
          treatment_plan_id: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          baseline_notes?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          current_phase?: string
          estimated_end_date?: string | null
          goal?: string | null
          id?: string
          injury_case_id?: string | null
          notes?: string | null
          person_id: string
          phase_start_date?: string | null
          program_status?: string
          season_id?: string | null
          start_date: string
          title: string
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          baseline_notes?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          current_phase?: string
          estimated_end_date?: string | null
          goal?: string | null
          id?: string
          injury_case_id?: string | null
          notes?: string | null
          person_id?: string
          phase_start_date?: string | null
          program_status?: string
          season_id?: string | null
          start_date?: string
          title?: string
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehab_programs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_programs_injury_case_id_fkey"
            columns: ["injury_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "rehab_programs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "rehab_programs_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rehab_progress_logs: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          limitations_observed: string | null
          load_tolerance: string | null
          log_date: string
          logged_by: string | null
          milestones_achieved: string | null
          notes: string | null
          pain_level: number | null
          phase: string | null
          rehab_program_id: string
          season_id: string | null
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id?: string
          limitations_observed?: string | null
          load_tolerance?: string | null
          log_date: string
          logged_by?: string | null
          milestones_achieved?: string | null
          notes?: string | null
          pain_level?: number | null
          phase?: string | null
          rehab_program_id: string
          season_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          limitations_observed?: string | null
          load_tolerance?: string | null
          log_date?: string
          logged_by?: string | null
          milestones_achieved?: string | null
          notes?: string | null
          pain_level?: number | null
          phase?: string | null
          rehab_program_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehab_progress_logs_rehab_program_id_fkey"
            columns: ["rehab_program_id"]
            isOneToOne: false
            referencedRelation: "rehab_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_progress_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_progress_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "rehab_progress_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      reservation_conflicts: {
        Row: {
          conflict_type: string | null
          conflicting_reservation_id: string
          created_at: string
          id: string
          notes: string | null
          reservation_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          conflict_type?: string | null
          conflicting_reservation_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reservation_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          conflict_type?: string | null
          conflicting_reservation_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reservation_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_conflicts_conflicting_reservation_id_fkey"
            columns: ["conflicting_reservation_id"]
            isOneToOne: false
            referencedRelation: "facility_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_conflicts_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "facility_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_to_play_decisions: {
        Row: {
          clearance_id: string | null
          club_id: string
          created_at: string
          decided_by: string | null
          decision_date: string
          decision_type: string
          id: string
          injury_case_id: string | null
          justification: string | null
          next_review_date: string | null
          notes: string | null
          perceived_risk: string | null
          person_id: string
          remaining_restrictions: string | null
          season_id: string | null
          stage: string
          status: string
        }
        Insert: {
          clearance_id?: string | null
          club_id: string
          created_at?: string
          decided_by?: string | null
          decision_date: string
          decision_type: string
          id?: string
          injury_case_id?: string | null
          justification?: string | null
          next_review_date?: string | null
          notes?: string | null
          perceived_risk?: string | null
          person_id: string
          remaining_restrictions?: string | null
          season_id?: string | null
          stage: string
          status?: string
        }
        Update: {
          clearance_id?: string | null
          club_id?: string
          created_at?: string
          decided_by?: string | null
          decision_date?: string
          decision_type?: string
          id?: string
          injury_case_id?: string | null
          justification?: string | null
          next_review_date?: string | null
          notes?: string | null
          perceived_risk?: string | null
          person_id?: string
          remaining_restrictions?: string | null
          season_id?: string | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_to_play_decisions_clearance_id_fkey"
            columns: ["clearance_id"]
            isOneToOne: false
            referencedRelation: "medical_clearances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_play_decisions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_play_decisions_injury_case_id_fkey"
            columns: ["injury_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_play_decisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_play_decisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "return_to_play_decisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          product_name: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          product_name: string
          quantity?: number
          sale_id: string
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          club_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          owner_id: string
          payment_method: string | null
          status: string
          total_amount: number
        }
        Insert: {
          club_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          payment_method?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_audit_logs: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scouting_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_observations: {
        Row: {
          behavioral_notes: string | null
          club_id: string
          competition_level: string | null
          competition_name: string | null
          confidence_level: string | null
          created_at: string
          created_by: string | null
          fit_with_club: string | null
          id: string
          match_context: string | null
          mental_notes: string | null
          metadata: Json | null
          minutes_observed: number | null
          next_action: string | null
          notes: string | null
          observation_date: string
          observation_type: string
          physical_notes: string | null
          position_observed: string | null
          prospect_id: string
          recommendation: string | null
          risks: string | null
          scout_user_id: string | null
          strengths: string | null
          tactical_notes: string | null
          technical_notes: string | null
          updated_at: string
          venue: string | null
          weaknesses: string | null
        }
        Insert: {
          behavioral_notes?: string | null
          club_id: string
          competition_level?: string | null
          competition_name?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          fit_with_club?: string | null
          id?: string
          match_context?: string | null
          mental_notes?: string | null
          metadata?: Json | null
          minutes_observed?: number | null
          next_action?: string | null
          notes?: string | null
          observation_date?: string
          observation_type?: string
          physical_notes?: string | null
          position_observed?: string | null
          prospect_id: string
          recommendation?: string | null
          risks?: string | null
          scout_user_id?: string | null
          strengths?: string | null
          tactical_notes?: string | null
          technical_notes?: string | null
          updated_at?: string
          venue?: string | null
          weaknesses?: string | null
        }
        Update: {
          behavioral_notes?: string | null
          club_id?: string
          competition_level?: string | null
          competition_name?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          fit_with_club?: string | null
          id?: string
          match_context?: string | null
          mental_notes?: string | null
          metadata?: Json | null
          minutes_observed?: number | null
          next_action?: string | null
          notes?: string | null
          observation_date?: string
          observation_type?: string
          physical_notes?: string | null
          position_observed?: string | null
          prospect_id?: string
          recommendation?: string | null
          risks?: string | null
          scout_user_id?: string | null
          strengths?: string | null
          tactical_notes?: string | null
          technical_notes?: string | null
          updated_at?: string
          venue?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scouting_observations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_observations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_report_scores: {
        Row: {
          comments: string | null
          created_at: string
          dimension: string
          id: string
          max_score: number | null
          observation_id: string
          score: number | null
          weight: number | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          dimension: string
          id?: string
          max_score?: number | null
          observation_id: string
          score?: number | null
          weight?: number | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          dimension?: string
          id?: string
          max_score?: number | null
          observation_id?: string
          score?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scouting_report_scores_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "scouting_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_shortlist_entries: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          notes: string | null
          priority: string | null
          prospect_id: string
          ranking: number | null
          reason: string | null
          risk_assessment: string | null
          shortlist_id: string
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string | null
          prospect_id: string
          ranking?: number | null
          reason?: string | null
          risk_assessment?: string | null
          shortlist_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string | null
          prospect_id?: string
          ranking?: number | null
          reason?: string | null
          risk_assessment?: string | null
          shortlist_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scouting_shortlist_entries_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_shortlist_entries_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "scouting_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_shortlists: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          recruitment_need: string | null
          season: string | null
          season_id: string | null
          status: string
          target_age_group: string | null
          target_position: string | null
          target_team_id: string | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          recruitment_need?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          target_age_group?: string | null
          target_position?: string | null
          target_team_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          recruitment_need?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          target_age_group?: string | null
          target_position?: string | null
          target_team_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scouting_shortlists_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_shortlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_shortlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "scouting_shortlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "scouting_shortlists_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_watchlist_entries: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          last_observation_date: string | null
          next_action: string | null
          notes: string | null
          priority: string | null
          prospect_id: string
          reason: string | null
          status: string
          updated_at: string
          watchlist_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          last_observation_date?: string | null
          next_action?: string | null
          notes?: string | null
          priority?: string | null
          prospect_id: string
          reason?: string | null
          status?: string
          updated_at?: string
          watchlist_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          last_observation_date?: string | null
          next_action?: string | null
          notes?: string | null
          priority?: string | null
          prospect_id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scouting_watchlist_entries_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_watchlist_entries_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "scouting_watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_watchlists: {
        Row: {
          age_group_filter: string | null
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position_filter: string | null
          region_filter: string | null
          season: string | null
          season_id: string | null
          status: string
          updated_at: string
          watchlist_type: string | null
        }
        Insert: {
          age_group_filter?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position_filter?: string | null
          region_filter?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          watchlist_type?: string | null
        }
        Update: {
          age_group_filter?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position_filter?: string | null
          region_filter?: string | null
          season?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          watchlist_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scouting_watchlists_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_watchlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_watchlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "scouting_watchlists_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      season_coach_assignments: {
        Row: {
          club_id: string
          coach_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          role: string | null
          season_id: string
          team_plan_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          coach_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          role?: string | null
          season_id: string
          team_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          coach_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          role?: string | null
          season_id?: string
          team_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_coach_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_coach_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_coach_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_coach_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_coach_assignments_team_plan_id_fkey"
            columns: ["team_plan_id"]
            isOneToOne: false
            referencedRelation: "season_team_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      season_player_enrollments: {
        Row: {
          age_group_id: string | null
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          notes: string | null
          player_id: string
          position: string | null
          season_id: string
          shirt_number: number | null
          status: Database["public"]["Enums"]["season_enrollment_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          age_group_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          notes?: string | null
          player_id: string
          position?: string | null
          season_id: string
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["season_enrollment_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          age_group_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          notes?: string | null
          player_id?: string
          position?: string | null
          season_id?: string
          shirt_number?: number | null
          status?: Database["public"]["Enums"]["season_enrollment_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_player_enrollments_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_enrollments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_enrollments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_enrollments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_enrollments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_player_enrollments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_player_enrollments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_player_plans: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          current_category: string | null
          current_team_id: string | null
          id: string
          notes: string | null
          player_id: string
          season_id: string
          status: Database["public"]["Enums"]["season_player_status"]
          target_category: string | null
          target_team_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          current_category?: string | null
          current_team_id?: string | null
          id?: string
          notes?: string | null
          player_id: string
          season_id: string
          status?: Database["public"]["Enums"]["season_player_status"]
          target_category?: string | null
          target_team_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          current_category?: string | null
          current_team_id?: string | null
          id?: string
          notes?: string | null
          player_id?: string
          season_id?: string
          status?: Database["public"]["Enums"]["season_player_status"]
          target_category?: string | null
          target_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_player_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_plans_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_player_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_player_plans_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_team_memberships: {
        Row: {
          age_group_id: string | null
          created_at: string
          id: string
          notes: string | null
          season_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          age_group_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          season_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          age_group_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          season_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_team_memberships_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "academy_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_memberships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_memberships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_team_memberships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_team_plans: {
        Row: {
          category: string | null
          club_id: string
          created_at: string
          created_by: string
          gender: string
          id: string
          notes: string | null
          season_id: string
          sport_type: string
          team_id: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          club_id: string
          created_at?: string
          created_by: string
          gender?: string
          id?: string
          notes?: string | null
          season_id: string
          sport_type?: string
          team_id?: string | null
          team_name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          gender?: string
          id?: string
          notes?: string | null
          season_id?: string
          sport_type?: string
          team_id?: string | null
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_team_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_team_plans_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_team_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_transitions: {
        Row: {
          applied_at: string | null
          created_at: string
          from_season_id: string
          id: string
          mode: Database["public"]["Enums"]["season_transition_mode"]
          payload: Json
          reference_date: string
          rolled_back_at: string | null
          status: Database["public"]["Enums"]["season_transition_status"]
          to_season_id: string
          triggered_at: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          from_season_id: string
          id?: string
          mode: Database["public"]["Enums"]["season_transition_mode"]
          payload?: Json
          reference_date: string
          rolled_back_at?: string | null
          status?: Database["public"]["Enums"]["season_transition_status"]
          to_season_id: string
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          from_season_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["season_transition_mode"]
          payload?: Json
          reference_date?: string
          rolled_back_at?: string | null
          status?: Database["public"]["Enums"]["season_transition_status"]
          to_season_id?: string
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_transitions_from_season_id_fkey"
            columns: ["from_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_transitions_from_season_id_fkey"
            columns: ["from_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_transitions_from_season_id_fkey"
            columns: ["from_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_transitions_to_season_id_fkey"
            columns: ["to_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_transitions_to_season_id_fkey"
            columns: ["to_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_transitions_to_season_id_fkey"
            columns: ["to_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      seasons: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          closed_by: string | null
          club_id: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          is_planning: boolean
          name: string
          notes: string | null
          owner_id: string
          previous_season_id: string | null
          reference_date: string | null
          start_date: string
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          club_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          is_planning?: boolean
          name: string
          notes?: string | null
          owner_id: string
          previous_season_id?: string | null
          reference_date?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          club_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          is_planning?: boolean
          name?: string
          notes?: string | null
          owner_id?: string
          previous_season_id?: string | null
          reference_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_previous_season_id_fkey"
            columns: ["previous_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_previous_season_id_fkey"
            columns: ["previous_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "seasons_previous_season_id_fkey"
            columns: ["previous_season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      security_pins: {
        Row: {
          club_id: string | null
          created_at: string
          id: string
          owner_id: string
          pin_hash: string
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          id?: string
          owner_id: string
          pin_hash: string
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          pin_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_pins_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          club_id: string
          contact_name: string | null
          contract_end: string | null
          contract_start: string | null
          contract_value: number | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          contact_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          contact_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_contracts: {
        Row: {
          contract_file_url: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          owner_id: string
          payment_frequency: string | null
          sponsor_id: string
          start_date: string
          status: string
          title: string
          total_value: number
          updated_at: string
        }
        Insert: {
          contract_file_url?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          owner_id: string
          payment_frequency?: string | null
          sponsor_id: string
          start_date: string
          status?: string
          title: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          contract_file_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          owner_id?: string
          payment_frequency?: string | null
          sponsor_id?: string
          start_date?: string
          status?: string
          title?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_contracts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_installments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          is_paid: boolean
          notes: string | null
          owner_id: string
          paid_at: string | null
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          owner_id: string
          paid_at?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          mandatory: boolean | null
          notes: string | null
          person_id: string
          status: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_url?: string | null
          id?: string
          mandatory?: boolean | null
          notes?: string | null
          person_id: string
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          mandatory?: boolean | null
          notes?: string | null
          person_id?: string
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key: string
          staff_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "club_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          club_id: string
          cost_center_id: string | null
          created_at: string
          department_id: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          internal_code: string | null
          is_active: boolean
          manager_user_id: string | null
          notes: string | null
          person_id: string
          staff_role: string
          start_date: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          internal_code?: string | null
          is_active?: boolean
          manager_user_id?: string | null
          notes?: string | null
          person_id: string
          staff_role: string
          start_date: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          internal_code?: string | null
          is_active?: boolean
          manager_user_id?: string | null
          notes?: string | null
          person_id?: string
          staff_role?: string
          start_date?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_qualifications: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuing_entity: string | null
          notes: string | null
          person_id: string
          qualification_type: string
          title: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_entity?: string | null
          notes?: string | null
          person_id: string
          qualification_type: string
          title: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_entity?: string | null
          notes?: string | null
          person_id?: string
          qualification_type?: string
          title?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_qualifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_obligations: {
        Row: {
          amount_due: number
          amount_paid: number
          authority_name: string | null
          club_id: string
          created_at: string
          due_date: string
          id: string
          obligation_type: string
          paid_at: string | null
          proof_file_url: string | null
          reference_code: string | null
          reference_period: string
          source_batch_id: string | null
          source_cycle_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          authority_name?: string | null
          club_id: string
          created_at?: string
          due_date: string
          id?: string
          obligation_type: string
          paid_at?: string | null
          proof_file_url?: string | null
          reference_code?: string | null
          reference_period: string
          source_batch_id?: string | null
          source_cycle_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          authority_name?: string | null
          club_id?: string
          created_at?: string
          due_date?: string
          id?: string
          obligation_type?: string
          paid_at?: string | null
          proof_file_url?: string | null
          reference_code?: string | null
          reference_period?: string
          source_batch_id?: string | null
          source_cycle_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statutory_obligations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_obligations_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "contractor_fee_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_obligations_source_cycle_id_fkey"
            columns: ["source_cycle_id"]
            isOneToOne: false
            referencedRelation: "payroll_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          location_id: string | null
          purchase_date: string | null
          quantity_available: number | null
          quantity_received: number | null
          stock_item_id: string
          unit_cost: number | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          purchase_date?: string | null
          quantity_available?: number | null
          quantity_received?: number | null
          stock_item_id: string
          unit_cost?: number | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          purchase_date?: string | null
          quantity_available?: number | null
          quantity_received?: number | null
          stock_item_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          counted_quantity: number | null
          id: string
          stock_count_id: string
          stock_item_id: string
          system_quantity: number | null
          variance_quantity: number | null
          variance_reason: string | null
        }
        Insert: {
          counted_quantity?: number | null
          id?: string
          stock_count_id: string
          stock_item_id: string
          system_quantity?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
        }
        Update: {
          counted_quantity?: number | null
          id?: string
          stock_count_id?: string
          stock_item_id?: string
          system_quantity?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          approved_by: string | null
          club_id: string
          count_date: string
          count_type: string | null
          counted_by: string | null
          created_at: string | null
          id: string
          location_id: string | null
          notes: string | null
          status: string | null
        }
        Insert: {
          approved_by?: string | null
          club_id: string
          count_date?: string
          count_type?: string | null
          counted_by?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          approved_by?: string | null
          club_id?: string
          count_date?: string
          count_type?: string | null
          counted_by?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          average_unit_cost: number | null
          category_id: string | null
          club_id: string
          created_at: string | null
          current_stock: number | null
          default_supplier_id: string | null
          id: string
          is_active: boolean | null
          item_name: string
          item_type: string
          minimum_stock: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string
          track_batches: boolean | null
          track_expiry: boolean | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          average_unit_cost?: number | null
          category_id?: string | null
          club_id: string
          created_at?: string | null
          current_stock?: number | null
          default_supplier_id?: string | null
          id?: string
          is_active?: boolean | null
          item_name: string
          item_type?: string
          minimum_stock?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku: string
          track_batches?: boolean | null
          track_expiry?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          average_unit_cost?: number | null
          category_id?: string | null
          club_id?: string
          created_at?: string | null
          current_stock?: number | null
          default_supplier_id?: string | null
          id?: string
          is_active?: boolean | null
          item_name?: string
          item_type?: string
          minimum_stock?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku?: string
          track_batches?: boolean | null
          track_expiry?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          club_id: string
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          from_location_id: string | null
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          related_person_id: string | null
          related_team_id: string | null
          season: string | null
          season_id: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          stock_item_id: string
          to_location_id: string | null
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          batch_id?: string | null
          club_id: string
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          related_person_id?: string | null
          related_team_id?: string | null
          season?: string | null
          season_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          stock_item_id: string
          to_location_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          batch_id?: string | null
          club_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          related_person_id?: string | null
          related_team_id?: string | null
          season?: string | null
          season_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          stock_item_id?: string
          to_location_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_related_team_id_fkey"
            columns: ["related_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "stock_movements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          club_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          proof_url: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount?: number
          club_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          proof_url?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          club_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          proof_url?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          fees_amount: number | null
          gross_amount: number
          id: string
          invoice_id: string | null
          net_amount: number
          notes: string | null
          payment_date: string
          payment_method: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          reference: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          fees_amount?: number | null
          gross_amount: number
          id?: string
          invoice_id?: string | null
          net_amount: number
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reference?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          fees_amount?: number | null
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          net_amount?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reference?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tactical_boards: {
        Row: {
          board_data: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          board_data?: Json
          created_at?: string
          id?: string
          name: string
          owner_id: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          board_data?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tactical_boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_coaches: {
        Row: {
          assigned_at: string
          coach_id: string
          id: string
          is_primary: boolean
          notes: string | null
          role: string | null
          team_id: string
        }
        Insert: {
          assigned_at?: string
          coach_id: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          team_id: string
        }
        Update: {
          assigned_at?: string
          coach_id?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_equipment_allocations: {
        Row: {
          allocation_date: string | null
          allocation_status: string | null
          club_id: string
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          notes: string | null
          quantity: number | null
          responsible_person_id: string | null
          return_due_date: string | null
          season: string | null
          season_id: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          allocation_date?: string | null
          allocation_status?: string | null
          club_id: string
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          notes?: string | null
          quantity?: number | null
          responsible_person_id?: string | null
          return_due_date?: string | null
          season?: string | null
          season_id?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          allocation_date?: string | null
          allocation_status?: string | null
          club_id?: string
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          notes?: string | null
          quantity?: number | null
          responsible_person_id?: string | null
          return_due_date?: string | null
          season?: string | null
          season_id?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_equipment_allocations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_allocations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_allocations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "team_equipment_allocations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "team_equipment_allocations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string | null
          club_id: string | null
          created_at: string
          formation: string | null
          gender: string
          id: string
          name: string
          owner_id: string
          season: string
          season_id: string | null
          sport_type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          club_id?: string | null
          created_at?: string
          formation?: string | null
          gender?: string
          id?: string
          name: string
          owner_id: string
          season?: string
          season_id?: string | null
          sport_type?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          club_id?: string | null
          created_at?: string
          formation?: string | null
          gender?: string
          id?: string
          name?: string
          owner_id?: string
          season?: string
          season_id?: string | null
          sport_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      ticket_sales: {
        Row: {
          club_id: string
          created_at: string
          event_date: string
          event_id: string | null
          event_name: string
          id: string
          match_id: string | null
          notes: string | null
          owner_id: string
          quantity: number | null
          ticket_price: number
          ticket_type_id: string | null
          tickets_sold: number
          total_amount: number
        }
        Insert: {
          club_id: string
          created_at?: string
          event_date: string
          event_id?: string | null
          event_name: string
          id?: string
          match_id?: string | null
          notes?: string | null
          owner_id: string
          quantity?: number | null
          ticket_price?: number
          ticket_type_id?: string | null
          tickets_sold?: number
          total_amount?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          event_date?: string
          event_id?: string | null
          event_name?: string
          id?: string
          match_id?: string | null
          notes?: string | null
          owner_id?: string
          quantity?: number | null
          ticket_price?: number
          ticket_type_id?: string | null
          tickets_sold?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sales_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          owner_id: string
          price: number
          quantity_available: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          owner_id: string
          price?: number
          quantity_available?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          owner_id?: string
          price?: number
          quantity_available?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attendance: {
        Row: {
          id: string
          notes: string | null
          owner_id: string
          player_id: string
          present: boolean
          recorded_at: string | null
          recorded_by: string | null
          season_id: string | null
          session_id: string
          status: string
        }
        Insert: {
          id?: string
          notes?: string | null
          owner_id: string
          player_id: string
          present?: boolean
          recorded_at?: string | null
          recorded_by?: string | null
          season_id?: string | null
          session_id: string
          status?: string
        }
        Update: {
          id?: string
          notes?: string | null
          owner_id?: string
          player_id?: string
          present?: boolean
          recorded_at?: string | null
          recorded_by?: string | null
          season_id?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_attendance_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_load: {
        Row: {
          actual_intensity: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          load_score: number | null
          notes: string | null
          owner_id: string
          planned_intensity: string | null
          player_id: string
          recorded_by: string | null
          rpe: number | null
          season_id: string | null
          session_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          actual_intensity?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          load_score?: number | null
          notes?: string | null
          owner_id: string
          planned_intensity?: string | null
          player_id: string
          recorded_by?: string | null
          rpe?: number | null
          season_id?: string | null
          session_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          actual_intensity?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          load_score?: number | null
          notes?: string | null
          owner_id?: string
          planned_intensity?: string | null
          player_id?: string
          recorded_by?: string | null
          rpe?: number | null
          season_id?: string | null
          session_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_load_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_load_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_load_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_load_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_load_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_load_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_load_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number | null
          exercises: string | null
          id: string
          intensity: string | null
          location: string | null
          notes: string | null
          objectives: string | null
          owner_id: string
          season_id: string | null
          session_type: string | null
          status: string
          team_id: string
          title: string | null
          training_plan_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes?: number | null
          exercises?: string | null
          id?: string
          intensity?: string | null
          location?: string | null
          notes?: string | null
          objectives?: string | null
          owner_id: string
          season_id?: string | null
          session_type?: string | null
          status?: string
          team_id: string
          title?: string | null
          training_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          exercises?: string | null
          id?: string
          intensity?: string | null
          location?: string | null
          notes?: string | null
          objectives?: string | null
          owner_id?: string
          season_id?: string | null
          session_type?: string | null
          status?: string
          team_id?: string
          title?: string | null
          training_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "coach_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_templates: {
        Row: {
          age_group: string | null
          created_at: string
          description: string | null
          diagram_url: string | null
          duration_minutes: number | null
          exercises: Json | null
          focus_area: string | null
          id: string
          is_system_template: boolean | null
          name: string
          owner_id: string | null
          season_id: string | null
          sport_type: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          description?: string | null
          diagram_url?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          focus_area?: string | null
          id?: string
          is_system_template?: boolean | null
          name: string
          owner_id?: string | null
          season_id?: string | null
          sport_type?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          description?: string | null
          diagram_url?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          focus_area?: string | null
          id?: string
          is_system_template?: boolean | null
          name?: string
          owner_id?: string | null
          season_id?: string | null
          sport_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "training_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          category: string
          category_id: string | null
          club_id: string
          created_at: string
          date: string
          description: string | null
          id: string
          owner_id: string
          payment_method: string | null
          player_id: string | null
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          category: string
          category_id?: string | null
          club_id: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          owner_id: string
          payment_method?: string | null
          player_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          category?: string
          category_id?: string | null
          club_id?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          owner_id?: string
          payment_method?: string | null
          player_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "club_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          actual_end_date: string | null
          club_id: string
          created_at: string
          created_by: string | null
          diagnosis: string | null
          discharge_criteria: string | null
          estimated_end_date: string | null
          id: string
          injury_case_id: string | null
          medications: string | null
          milestone_criteria: string | null
          notes: string | null
          objective: string | null
          person_id: string
          plan_status: string
          progression_criteria: string | null
          responsible_staff_id: string | null
          sessions_completed: number
          start_date: string
          techniques: string[] | null
          title: string
          total_sessions_planned: number | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          discharge_criteria?: string | null
          estimated_end_date?: string | null
          id?: string
          injury_case_id?: string | null
          medications?: string | null
          milestone_criteria?: string | null
          notes?: string | null
          objective?: string | null
          person_id: string
          plan_status?: string
          progression_criteria?: string | null
          responsible_staff_id?: string | null
          sessions_completed?: number
          start_date: string
          techniques?: string[] | null
          title: string
          total_sessions_planned?: number | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          discharge_criteria?: string | null
          estimated_end_date?: string | null
          id?: string
          injury_case_id?: string | null
          medications?: string | null
          milestone_criteria?: string | null
          notes?: string | null
          objective?: string | null
          person_id?: string
          plan_status?: string
          progression_criteria?: string | null
          responsible_staff_id?: string | null
          sessions_completed?: number
          start_date?: string
          techniques?: string[] | null
          title?: string
          total_sessions_planned?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_injury_case_id_fkey"
            columns: ["injury_case_id"]
            isOneToOne: false
            referencedRelation: "injury_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_contracts: {
        Row: {
          annual_estimated_value: number | null
          club_id: string
          contract_name: string
          contract_type: string | null
          created_at: string
          created_by: string
          end_date: string | null
          file_url: string | null
          id: string
          linked_cost_center_id: string | null
          linked_team_id: string | null
          notice_period_days: number | null
          renewal_type: string | null
          start_date: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          annual_estimated_value?: number | null
          club_id: string
          contract_name: string
          contract_type?: string | null
          created_at?: string
          created_by: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          linked_cost_center_id?: string | null
          linked_team_id?: string | null
          notice_period_days?: number | null
          renewal_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          annual_estimated_value?: number | null
          club_id?: string
          contract_name?: string
          contract_type?: string | null
          created_at?: string
          created_by?: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          linked_cost_center_id?: string | null
          linked_team_id?: string | null
          notice_period_days?: number | null
          renewal_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contracts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contracts_linked_cost_center_id_fkey"
            columns: ["linked_cost_center_id"]
            isOneToOne: false
            referencedRelation: "budget_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contracts_linked_team_id_fkey"
            columns: ["linked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          created_at: string
          document_type: string
          file_url: string | null
          id: string
          notes: string | null
          status: string | null
          valid_from: string | null
          valid_to: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          valid_from?: string | null
          valid_to?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank_details_masked: string | null
          category: string | null
          club_id: string
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          legal_name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          preferred_payment_method: string | null
          risk_level: string | null
          tax_id: string | null
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          vendor_code: string | null
          vendor_status: string
        }
        Insert: {
          address?: string | null
          bank_details_masked?: string | null
          category?: string | null
          club_id: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          risk_level?: string | null
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_code?: string | null
          vendor_status?: string
        }
        Update: {
          address?: string | null
          bank_details_masked?: string | null
          category?: string | null
          club_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          risk_level?: string | null
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_code?: string | null
          vendor_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_checkins: {
        Row: {
          checkin_date: string
          club_id: string
          created_at: string
          fatigue_level: number | null
          id: string
          muscle_soreness: number | null
          notes: string | null
          overall_mood: string | null
          pain_areas: string[] | null
          perceived_readiness: number | null
          person_id: string
          risk_flags: string[] | null
          season_id: string | null
          sleep_quality: number | null
          stress_level: number | null
          team_id: string | null
        }
        Insert: {
          checkin_date: string
          club_id: string
          created_at?: string
          fatigue_level?: number | null
          id?: string
          muscle_soreness?: number | null
          notes?: string | null
          overall_mood?: string | null
          pain_areas?: string[] | null
          perceived_readiness?: number | null
          person_id: string
          risk_flags?: string[] | null
          season_id?: string | null
          sleep_quality?: number | null
          stress_level?: number | null
          team_id?: string | null
        }
        Update: {
          checkin_date?: string
          club_id?: string
          created_at?: string
          fatigue_level?: number | null
          id?: string
          muscle_soreness?: number | null
          notes?: string | null
          overall_mood?: string | null
          pain_areas?: string[] | null
          perceived_readiness?: number | null
          person_id?: string
          risk_flags?: string[] | null
          season_id?: string | null
          sleep_quality?: number | null
          stress_level?: number | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wellness_checkins_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_checkins_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_checkins_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "wellness_checkins_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "wellness_checkins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_audit_logs: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workforce_audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      youth_age_groups: {
        Row: {
          club_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          max_birth_year: number
          min_birth_year: number
          name: string
          season_id: string | null
          updated_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_birth_year: number
          min_birth_year: number
          name: string
          season_id?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_birth_year?: number
          min_birth_year?: number
          name?: string
          season_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youth_age_groups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_age_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_age_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_age_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      youth_coordination_documents: {
        Row: {
          club_id: string
          created_at: string | null
          created_by: string
          description: string | null
          document_type: string
          file_url: string | null
          id: string
          is_active: boolean | null
          target_audience: string[] | null
          title: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          club_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          target_audience?: string[] | null
          title: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          target_audience?: string[] | null
          title?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youth_coordination_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      youth_team_coaches: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          role: string | null
          season_id: string | null
          youth_team_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          season_id?: string | null
          youth_team_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          season_id?: string | null
          youth_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youth_team_coaches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_team_coaches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_team_coaches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_team_coaches_youth_team_id_fkey"
            columns: ["youth_team_id"]
            isOneToOne: false
            referencedRelation: "youth_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      youth_team_players: {
        Row: {
          blocked_reason: string | null
          created_at: string | null
          id: string
          is_from_lower_age_group: boolean | null
          notes: string | null
          player_id: string
          season_id: string | null
          status: string | null
          updated_at: string | null
          youth_team_id: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string | null
          id?: string
          is_from_lower_age_group?: boolean | null
          notes?: string | null
          player_id: string
          season_id?: string | null
          status?: string | null
          updated_at?: string | null
          youth_team_id: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string | null
          id?: string
          is_from_lower_age_group?: boolean | null
          notes?: string | null
          player_id?: string
          season_id?: string | null
          status?: string | null
          updated_at?: string | null
          youth_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youth_team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_team_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_team_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_team_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_team_players_youth_team_id_fkey"
            columns: ["youth_team_id"]
            isOneToOne: false
            referencedRelation: "youth_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      youth_teams: {
        Row: {
          age_group_id: string
          club_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          season: string
          season_id: string | null
          sport_variant: string
          updated_at: string | null
        }
        Insert: {
          age_group_id: string
          club_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          season?: string
          season_id?: string | null
          sport_variant?: string
          updated_at?: string | null
        }
        Update: {
          age_group_id?: string
          club_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          season?: string
          season_id?: string | null
          sport_variant?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youth_teams_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "youth_age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_club"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "youth_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "v_active_season_by_owner"
            referencedColumns: ["season_id"]
          },
        ]
      }
      youth_training_schedules: {
        Row: {
          club_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          location: string | null
          notes: string | null
          start_time: string
          updated_at: string | null
          youth_team_id: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          notes?: string | null
          start_time: string
          updated_at?: string | null
          youth_team_id: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          notes?: string | null
          start_time?: string
          updated_at?: string | null
          youth_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youth_training_schedules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youth_training_schedules_youth_team_id_fkey"
            columns: ["youth_team_id"]
            isOneToOne: false
            referencedRelation: "youth_teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      player_public_info: {
        Row: {
          created_at: string | null
          foot: string | null
          height_cm: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          number: number | null
          owner_id: string | null
          position: string | null
          team_id: string | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          foot?: string | null
          height_cm?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          number?: number | null
          owner_id?: string | null
          position?: string | null
          team_id?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          foot?: string | null
          height_cm?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          number?: number | null
          owner_id?: string | null
          position?: string | null
          team_id?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_season_by_club: {
        Row: {
          club_id: string | null
          end_date: string | null
          name: string | null
          reference_date: string | null
          season_id: string | null
          start_date: string | null
        }
        Insert: {
          club_id?: string | null
          end_date?: string | null
          name?: string | null
          reference_date?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Update: {
          club_id?: string | null
          end_date?: string | null
          name?: string | null
          reference_date?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_season_by_owner: {
        Row: {
          end_date: string | null
          name: string | null
          owner_id: string | null
          reference_date: string | null
          season_id: string | null
          start_date: string | null
        }
        Insert: {
          end_date?: string | null
          name?: string | null
          owner_id?: string | null
          reference_date?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Update: {
          end_date?: string | null
          name?: string | null
          owner_id?: string | null
          reference_date?: string | null
          season_id?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_season: { Args: { p_season_id: string }; Returns: undefined }
      admin_restore_archived_record: {
        Args: { p_patch?: Json; p_row_id: string; p_table: string }
        Returns: undefined
      }
      apply_season_transition: {
        Args: { p_transition_id: string }
        Returns: Json
      }
      apply_tactical_change: {
        Args: {
          p_change: Json
          p_match_id: string
          p_minute_abs: number
          p_part_index: number
        }
        Returns: Json
      }
      archive_season: { Args: { p_season_id: string }; Returns: undefined }
      build_player_season_snapshots: {
        Args: { p_season_id: string }
        Returns: number
      }
      can_manage_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_invite: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_template: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      can_post_to_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      close_season: { Args: { p_season_id: string }; Returns: undefined }
      club_can_accept_online_payments: {
        Args: { _club_id: string }
        Returns: boolean
      }
      commit_substitution_batch: {
        Args: {
          p_match_id: string
          p_minute: number
          p_owner_id: string
          p_second_base: number
          p_subs: Json
        }
        Returns: Json
      }
      get_active_season_id: {
        Args: { p_club?: string; p_owner: string }
        Returns: string
      }
      get_club_payment_mode: { Args: { _club_id: string }; Returns: string }
      get_coach_club_id: { Args: { _user_id: string }; Returns: string }
      get_guardian_team_ids: { Args: { _user_id: string }; Returns: string[] }
      get_player_account_id: { Args: { _user_id: string }; Returns: string }
      has_club_role: {
        Args: {
          _club_id: string
          _roles: Database["public"]["Enums"]["club_staff_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_physio_access: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_admin: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_coach: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_financial_admin: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_physio: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_staff_admin: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_staff_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_guardian_of_charge: {
        Args: { _charge_id: string; _user_id: string }
        Returns: boolean
      }
      is_guardian_of_player: {
        Args: { _player_id: string; _user_id: string }
        Returns: boolean
      }
      is_guardian_of_team_player: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_season_archived: { Args: { p_season_id: string }; Returns: boolean }
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_youth_coordinator: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      rollback_season_transition: {
        Args: { p_transition_id: string }
        Returns: undefined
      }
      save_initial_formation: {
        Args: {
          p_assignments: Json
          p_formation_code: string
          p_formation_name: string
          p_match_id: string
          p_overwrite?: boolean
          p_slots: Json
          p_sport_type: string
        }
        Returns: Json
      }
      user_can_access_season: {
        Args: { _season_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_manage_season: {
        Args: { _season_id: string; _user_id: string }
        Returns: boolean
      }
      verify_security_pin: {
        Args: { _owner_id: string; _pin: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "individual_coach" | "club" | "guardian" | "player"
      app_role: "coach" | "club_admin"
      club_staff_role:
        | "admin"
        | "staff"
        | "coach"
        | "tesouraria"
        | "secretaria"
        | "physio"
        | "coordenador"
      match_event_type:
        | "goal"
        | "own_goal"
        | "yellow_card"
        | "red_card"
        | "substitution_in"
        | "substitution_out"
      player_status:
        | "active"
        | "injured"
        | "suspended"
        | "loan"
        | "inactive"
        | "away"
      season_enrollment_status:
        | "active"
        | "injured"
        | "loaned_out"
        | "left"
        | "prospect"
      season_player_status: "promotes" | "stays" | "leaves"
      season_status: "planning" | "active" | "closed" | "archived"
      season_transition_mode: "club_auto" | "coach_manual"
      season_transition_status:
        | "draft"
        | "previewed"
        | "applied"
        | "rolled_back"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["individual_coach", "club", "guardian", "player"],
      app_role: ["coach", "club_admin"],
      club_staff_role: [
        "admin",
        "staff",
        "coach",
        "tesouraria",
        "secretaria",
        "physio",
        "coordenador",
      ],
      match_event_type: [
        "goal",
        "own_goal",
        "yellow_card",
        "red_card",
        "substitution_in",
        "substitution_out",
      ],
      player_status: [
        "active",
        "injured",
        "suspended",
        "loan",
        "inactive",
        "away",
      ],
      season_enrollment_status: [
        "active",
        "injured",
        "loaned_out",
        "left",
        "prospect",
      ],
      season_player_status: ["promotes", "stays", "leaves"],
      season_status: ["planning", "active", "closed", "archived"],
      season_transition_mode: ["club_auto", "coach_manual"],
      season_transition_status: [
        "draft",
        "previewed",
        "applied",
        "rolled_back",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
