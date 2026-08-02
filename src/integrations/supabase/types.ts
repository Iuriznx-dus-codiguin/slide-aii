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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          metadata: Json
          presentation_id: string | null
          query: string | null
          source: string
          url: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          metadata?: Json
          presentation_id?: string | null
          query?: string | null
          source: string
          url: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          metadata?: Json
          presentation_id?: string | null
          query?: string | null
          source?: string
          url?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          fn_name: string
          request_count: number
          rl_key: string
          window_start: string
        }
        Insert: {
          fn_name: string
          request_count?: number
          rl_key: string
          window_start: string
        }
        Update: {
          fn_name?: string
          request_count?: number
          rl_key?: string
          window_start?: string
        }
        Relationships: []
      }
      error_catalog: {
        Row: {
          ai_can_resolve: boolean
          code: string
          created_at: string
          flow: string | null
          module: string
          probable_causes: string[]
          related_articles: string[]
          related_codes: string[]
          resolution_steps: string[]
          severity: Database["public"]["Enums"]["error_severity"]
          tech_description: string
          title: string
          updated_at: string
          user_description: string
          version: number
        }
        Insert: {
          ai_can_resolve?: boolean
          code: string
          created_at?: string
          flow?: string | null
          module: string
          probable_causes?: string[]
          related_articles?: string[]
          related_codes?: string[]
          resolution_steps?: string[]
          severity?: Database["public"]["Enums"]["error_severity"]
          tech_description: string
          title: string
          updated_at?: string
          user_description: string
          version?: number
        }
        Update: {
          ai_can_resolve?: boolean
          code?: string
          created_at?: string
          flow?: string | null
          module?: string
          probable_causes?: string[]
          related_articles?: string[]
          related_codes?: string[]
          resolution_steps?: string[]
          severity?: Database["public"]["Enums"]["error_severity"]
          tech_description?: string
          title?: string
          updated_at?: string
          user_description?: string
          version?: number
        }
        Relationships: []
      }
      error_catalog_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          code: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          code: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          code?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      error_occurrences: {
        Row: {
          context: Json
          created_at: string
          error_code: string | null
          id: string
          request_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          session_id: string | null
          stack_summary: string | null
          status: Database["public"]["Enums"]["occurrence_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          request_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          session_id?: string | null
          stack_summary?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          request_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          session_id?: string | null
          stack_summary?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_occurrences_error_code_fkey"
            columns: ["error_code"]
            isOneToOne: false
            referencedRelation: "error_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      generation_logs: {
        Row: {
          actual_cost_usd: number
          created_at: string
          duration_ms: number
          estimated_cost_usd: number
          id: string
          images_ai: number
          images_pexels: number
          metadata: Json
          mode: string | null
          model: string | null
          presentation_id: string | null
          reason: string | null
          slides_count: number
          status: string
          user_id: string
        }
        Insert: {
          actual_cost_usd?: number
          created_at?: string
          duration_ms?: number
          estimated_cost_usd?: number
          id?: string
          images_ai?: number
          images_pexels?: number
          metadata?: Json
          mode?: string | null
          model?: string | null
          presentation_id?: string | null
          reason?: string | null
          slides_count?: number
          status?: string
          user_id: string
        }
        Update: {
          actual_cost_usd?: number
          created_at?: string
          duration_ms?: number
          estimated_cost_usd?: number
          id?: string
          images_ai?: number
          images_pexels?: number
          metadata?: Json
          mode?: string | null
          model?: string | null
          presentation_id?: string | null
          reason?: string | null
          slides_count?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          category: string
          content_md: string
          created_at: string
          id: string
          is_published: boolean
          keywords: string[]
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content_md: string
          created_at?: string
          id?: string
          is_published?: boolean
          keywords?: string[]
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content_md?: string
          created_at?: string
          id?: string
          is_published?: boolean
          keywords?: string[]
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          cakto_id: string | null
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          provider: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          cakto_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          cakto_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      presentations: {
        Row: {
          created_at: string
          deleted_at: string | null
          depth_level: string | null
          description: string | null
          dynamic_theme: Json | null
          brand_identity: Json | null
          creative_brief: Json | null
          font_style: string | null
          id: string
          include_speeches: boolean
          is_paid: boolean
          is_password_protected: boolean
          is_published: boolean
          language: string | null
          password_hash: string | null
          persona: string | null
          presenters_count: number
          presenters_names: Json | null
          slides_count: number
          slug: string
          theme: string | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          depth_level?: string | null
          description?: string | null
          dynamic_theme?: Json | null
          brand_identity?: Json | null
          creative_brief?: Json | null
          font_style?: string | null
          id?: string
          include_speeches?: boolean
          is_paid?: boolean
          is_password_protected?: boolean
          is_published?: boolean
          language?: string | null
          password_hash?: string | null
          persona?: string | null
          presenters_count?: number
          presenters_names?: Json | null
          slides_count?: number
          slug: string
          theme?: string | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          depth_level?: string | null
          description?: string | null
          dynamic_theme?: Json | null
          brand_identity?: Json | null
          creative_brief?: Json | null
          font_style?: string | null
          id?: string
          include_speeches?: boolean
          is_paid?: boolean
          is_password_protected?: boolean
          is_published?: boolean
          language?: string | null
          password_hash?: string | null
          persona?: string | null
          presenters_count?: number
          presenters_names?: Json | null
          slides_count?: number
          slug?: string
          theme?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cakto_customer_id: string | null
          cakto_subscription_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          generations_count: number
          id: string
          is_public: boolean
          location: string | null
          plan: string
          role: string | null
          single_credits: number
          social_links: Json
          subscription_period_start: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          total_views: number
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          generations_count?: number
          id: string
          is_public?: boolean
          location?: string | null
          plan?: string
          role?: string | null
          single_credits?: number
          social_links?: Json
          subscription_period_start?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          total_views?: number
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          generations_count?: number
          id?: string
          is_public?: boolean
          location?: string | null
          plan?: string
          role?: string | null
          single_credits?: number
          social_links?: Json
          subscription_period_start?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          total_views?: number
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      slide_views: {
        Row: {
          created_at: string
          id: string
          presentation_id: string
          user_agent: string | null
          viewer_ip_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          presentation_id: string
          user_agent?: string | null
          viewer_ip_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          presentation_id?: string
          user_agent?: string | null
          viewer_ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slide_views_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          animation_transition: string | null
          background_color: string | null
          background_image_url: string | null
          content: Json
          created_at: string
          id: string
          layout_template: string | null
          position: number
          presentation_id: string
          presenters_data: Json | null
          slide_type: string
          speaker_notes: string | null
          updated_at: string
        }
        Insert: {
          animation_transition?: string | null
          background_color?: string | null
          background_image_url?: string | null
          content?: Json
          created_at?: string
          id?: string
          layout_template?: string | null
          position: number
          presentation_id: string
          presenters_data?: Json | null
          slide_type?: string
          speaker_notes?: string | null
          updated_at?: string
        }
        Update: {
          animation_transition?: string | null
          background_color?: string | null
          background_image_url?: string | null
          content?: Json
          created_at?: string
          id?: string
          layout_template?: string | null
          position?: number
          presentation_id?: string
          presenters_data?: Json | null
          slide_type?: string
          speaker_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          auto_closed: boolean
          awaiting_confirmation_at: string | null
          closed_at: string | null
          created_at: string
          escalated_at: string | null
          escalation_reason: string | null
          id: string
          rating: number | null
          related_error_code: string | null
          related_occurrence_id: string | null
          reopen_count: number
          resolved_by_ai: boolean | null
          resolved_by_human: boolean | null
          state: Database["public"]["Enums"]["conversation_state"]
          subject: string | null
          ticket_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_closed?: boolean
          awaiting_confirmation_at?: string | null
          closed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          rating?: number | null
          related_error_code?: string | null
          related_occurrence_id?: string | null
          reopen_count?: number
          resolved_by_ai?: boolean | null
          resolved_by_human?: boolean | null
          state?: Database["public"]["Enums"]["conversation_state"]
          subject?: string | null
          ticket_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_closed?: boolean
          awaiting_confirmation_at?: string | null
          closed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          rating?: number | null
          related_error_code?: string | null
          related_occurrence_id?: string | null
          reopen_count?: number
          resolved_by_ai?: boolean | null
          resolved_by_human?: boolean | null
          state?: Database["public"]["Enums"]["conversation_state"]
          subject?: string | null
          ticket_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_related_error_code_fkey"
            columns: ["related_error_code"]
            isOneToOne: false
            referencedRelation: "error_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "support_conversations_related_occurrence_id_fkey"
            columns: ["related_occurrence_id"]
            isOneToOne: false
            referencedRelation: "error_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          code_ref: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["message_role"]
        }
        Insert: {
          code_ref?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["message_role"]
        }
        Update: {
          code_ref?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_code_ref_fkey"
            columns: ["code_ref"]
            isOneToOne: false
            referencedRelation: "error_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_generate: { Args: { _uid: string }; Returns: Json }
      check_rate_limit: {
        Args: { _fn: string; _key: string; _max_per_hour: number }
        Returns: boolean
      }
      consume_single_credit: { Args: { _uid: string }; Returns: boolean }
      generate_ticket_id: { Args: never; Returns: string }
      grant_single_credit: { Args: { _uid: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_own_generations_count: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "developer" | "user"
      conversation_state:
        | "open"
        | "diagnosing"
        | "awaiting_user"
        | "resolved"
        | "escalated"
        | "closed"
        | "awaiting_confirmation"
      error_severity: "critical" | "high" | "medium" | "low" | "info"
      message_role: "user" | "assistant" | "system"
      occurrence_status: "open" | "investigating" | "resolved" | "reopened"
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
      app_role: ["admin", "developer", "user"],
      conversation_state: [
        "open",
        "diagnosing",
        "awaiting_user",
        "resolved",
        "escalated",
        "closed",
        "awaiting_confirmation",
      ],
      error_severity: ["critical", "high", "medium", "low", "info"],
      message_role: ["user", "assistant", "system"],
      occurrence_status: ["open", "investigating", "resolved", "reopened"],
    },
  },
} as const
