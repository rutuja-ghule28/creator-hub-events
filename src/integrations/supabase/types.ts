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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_applications: {
        Row: {
          created_at: string
          creator_id: string
          event_id: string
          id: string
          pitch: string
          status: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          event_id: string
          id?: string
          pitch: string
          status?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          event_id?: string
          id?: string
          pitch?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_reports: {
        Row: {
          application_id: string
          deliverable_status: string
          engagement: number
          id: string
          notes: string | null
          reach: number
          updated_at: string
        }
        Insert: {
          application_id: string
          deliverable_status?: string
          engagement?: number
          id?: string
          notes?: string | null
          reach?: number
          updated_at?: string
        }
        Update: {
          application_id?: string
          deliverable_status?: string
          engagement?: number
          id?: string
          notes?: string | null
          reach?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_reports_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          audience_size: number
          avatar_url: string | null
          bio: string
          category: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string
          id: string
          location: string
          page_views: number
          portfolio_links: string[]
          user_id: string | null
          verification_docs: string[]
          verification_status: string
          verified: boolean
        }
        Insert: {
          audience_size?: number
          avatar_url?: string | null
          bio?: string
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name: string
          id?: string
          location?: string
          page_views?: number
          portfolio_links?: string[]
          user_id?: string | null
          verification_docs?: string[]
          verification_status?: string
          verified?: boolean
        }
        Update: {
          audience_size?: number
          avatar_url?: string | null
          bio?: string
          category?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          id?: string
          location?: string
          page_views?: number
          portfolio_links?: string[]
          user_id?: string | null
          verification_docs?: string[]
          verification_status?: string
          verified?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          application_deadline: string | null
          area: string
          capacity: number
          cover_url: string | null
          created_at: string
          creator_id: string
          description: string
          id: string
          promotion_brief: string | null
          seats_taken: number
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          target_niche: string | null
          title: string
          type: string
          venue: string
        }
        Insert: {
          application_deadline?: string | null
          area?: string
          capacity: number
          cover_url?: string | null
          created_at?: string
          creator_id: string
          description?: string
          id?: string
          promotion_brief?: string | null
          seats_taken?: number
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          target_niche?: string | null
          title: string
          type?: string
          venue: string
        }
        Update: {
          application_deadline?: string | null
          area?: string
          capacity?: number
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          promotion_brief?: string | null
          seats_taken?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          target_niche?: string | null
          title?: string
          type?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          creator_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_id: string | null
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notify_enabled: boolean
          phone: string | null
          suspended: boolean
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          notify_enabled?: boolean
          phone?: string | null
          suspended?: boolean
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notify_enabled?: boolean
          phone?: string | null
          suspended?: boolean
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attendee_count: number
          checked_in: boolean
          created_at: string
          email: string
          event_id: string
          full_name: string
          id: string
          phone: string
          ticket_code: string
          user_id: string
        }
        Insert: {
          attendee_count?: number
          checked_in?: boolean
          created_at?: string
          email: string
          event_id: string
          full_name: string
          id?: string
          phone: string
          ticket_code?: string
          user_id: string
        }
        Update: {
          attendee_count?: number
          checked_in?: boolean
          created_at?: string
          email?: string
          event_id?: string
          full_name?: string
          id?: string
          phone?: string
          ticket_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_events: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_stats: { Args: never; Returns: Json }
      can_access_application: { Args: { _app_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_deadlines: { Args: never; Returns: undefined }
      owns_creator: { Args: { _creator_id: string }; Returns: boolean }
      owns_event: { Args: { _event_id: string }; Returns: boolean }
      record_view: { Args: { _creator_id: string }; Returns: undefined }
      review_creator: {
        Args: { _approve: boolean; _creator_id: string }
        Returns: undefined
      }
      set_suspended: {
        Args: { _suspended: boolean; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "attendee" | "creator" | "admin"
      event_status: "pending" | "live" | "rejected" | "removed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["attendee", "creator", "admin"],
      event_status: ["pending", "live", "rejected", "removed"],
    },
  },
} as const
