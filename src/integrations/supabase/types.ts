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
          cakto_customer_id: string | null
          cakto_subscription_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          generations_count: number
          id: string
          plan: string
          role: string | null
          single_credits: number
          subscription_period_start: string | null
          subscription_renews_at: string | null
          subscription_status: string | null
          total_views: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          generations_count?: number
          id: string
          plan?: string
          role?: string | null
          single_credits?: number
          subscription_period_start?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          total_views?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cakto_customer_id?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          generations_count?: number
          id?: string
          plan?: string
          role?: string | null
          single_credits?: number
          subscription_period_start?: string | null
          subscription_renews_at?: string | null
          subscription_status?: string | null
          total_views?: number
          updated_at?: string
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
    },
  },
} as const
