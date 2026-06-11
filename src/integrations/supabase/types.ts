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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking_decorations: {
        Row: {
          booking_id: string
          decoration_id: string
          qty: number
        }
        Insert: {
          booking_id: string
          decoration_id: string
          qty?: number
        }
        Update: {
          booking_id?: string
          decoration_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_decorations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_decorations_decoration_id_fkey"
            columns: ["decoration_id"]
            isOneToOne: false
            referencedRelation: "decorations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_decorations_decoration_id_fkey"
            columns: ["decoration_id"]
            isOneToOne: false
            referencedRelation: "top_decorations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          decorations: Json
          event_date: string
          event_location: string | null
          event_type: string
          id: string
          notes: string | null
          owner_id: string
          status: Database["public"]["Enums"]["booking_request_status"]
          supplies: Json
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          decorations?: Json
          event_date: string
          event_location?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["booking_request_status"]
          supplies?: Json
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          decorations?: Json
          event_date?: string
          event_location?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["booking_request_status"]
          supplies?: Json
          updated_at?: string
        }
        Relationships: []
      }
      booking_supplies: {
        Row: {
          booking_id: string
          qty: number
          supply_id: string
        }
        Insert: {
          booking_id: string
          qty?: number
          supply_id: string
        }
        Update: {
          booking_id?: string
          qty?: number
          supply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_supplies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_supplies_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string | null
          code: string | null
          created_at: string
          customer_name: string
          deposit: number
          end_time: string
          event_date: string
          event_type: string
          expenses: number
          id: string
          location: string | null
          net_profit: number | null
          notes: string | null
          owner_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          remaining: number | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          transport_cost: number
        }
        Insert: {
          client_id?: string | null
          code?: string | null
          created_at?: string
          customer_name: string
          deposit?: number
          end_time: string
          event_date: string
          event_type?: string
          expenses?: number
          id?: string
          location?: string | null
          net_profit?: number | null
          notes?: string | null
          owner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          remaining?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          transport_cost?: number
        }
        Update: {
          client_id?: string | null
          code?: string | null
          created_at?: string
          customer_name?: string
          deposit?: number
          end_time?: string
          event_date?: string
          event_type?: string
          expenses?: number
          id?: string
          location?: string | null
          net_profit?: number | null
          notes?: string | null
          owner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          remaining?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          transport_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          events_count: number
          id: string
          is_vip: boolean
          last_event_date: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          total_paid: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          events_count?: number
          id?: string
          is_vip?: boolean
          last_event_date?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          total_paid?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          events_count?: number
          id?: string
          is_vip?: boolean
          last_event_date?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          total_paid?: number
        }
        Relationships: []
      }
      decorations: {
        Row: {
          booked_qty: number
          bookings_count: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          name: string
          owner_id: string | null
          price: number
          status: Database["public"]["Enums"]["item_status"]
          total_qty: number
          total_revenue: number
        }
        Insert: {
          booked_qty?: number
          bookings_count?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          name: string
          owner_id?: string | null
          price?: number
          status?: Database["public"]["Enums"]["item_status"]
          total_qty?: number
          total_revenue?: number
        }
        Update: {
          booked_qty?: number
          bookings_count?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          name?: string
          owner_id?: string | null
          price?: number
          status?: Database["public"]["Enums"]["item_status"]
          total_qty?: number
          total_revenue?: number
        }
        Relationships: []
      }
      event_types: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          name: string
          owner_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          name: string
          owner_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          date: string
          expense_type: string
          id: string
          notes: string | null
          owner_id: string | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          date?: string
          expense_type: string
          id?: string
          notes?: string | null
          owner_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          date?: string
          expense_type?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          line_total: number
          name: string
          position: number
          qty: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          line_total?: number
          name: string
          position?: number
          qty?: number
          unit_price?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          line_total?: number
          name?: string
          position?: number
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          booking_id: string | null
          client_id: string | null
          code: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          owner_id: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          public_token: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          owner_id?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          owner_id?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          identifier: string
          ip_address: string | null
          method: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          identifier: string
          ip_address?: string | null
          method: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          identifier?: string
          ip_address?: string | null
          method?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string | null
          level: Database["public"]["Enums"]["notif_level"]
          owner_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          level?: Database["public"]["Enums"]["notif_level"]
          owner_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          level?: Database["public"]["Enums"]["notif_level"]
          owner_id?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string | null
          background_color: string | null
          booking_enabled: boolean
          company_name: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          email: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          phone: string | null
          phone_verified: boolean
          primary_color: string | null
          public_slug: string | null
          secondary_color: string | null
          show_prices: boolean
          tagline: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          booking_enabled?: boolean
          company_name?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          phone?: string | null
          phone_verified?: boolean
          primary_color?: string | null
          public_slug?: string | null
          secondary_color?: string | null
          show_prices?: boolean
          tagline?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          booking_enabled?: boolean
          company_name?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          phone_verified?: boolean
          primary_color?: string | null
          public_slug?: string | null
          secondary_color?: string | null
          show_prices?: boolean
          tagline?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          id: string
          images: string[]
          min_alert: number
          name: string
          notes: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["item_status"]
          supplier: string | null
          total_qty: number
          used_qty: number
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          images?: string[]
          min_alert?: number
          name: string
          notes?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          supplier?: string | null
          total_qty?: number
          used_qty?: number
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          images?: string[]
          min_alert?: number
          name?: string
          notes?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          supplier?: string | null
          total_qty?: number
          used_qty?: number
        }
        Relationships: []
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
      monthly_revenue: {
        Row: {
          bookings: number | null
          month: string | null
          profit: number | null
          revenue: number | null
        }
        Relationships: []
      }
      top_decorations: {
        Row: {
          bookings_count: number | null
          id: string | null
          name: string | null
          total_revenue: number | null
        }
        Insert: {
          bookings_count?: number | null
          id?: string | null
          name?: string | null
          total_revenue?: number | null
        }
        Update: {
          bookings_count?: number | null
          id?: string | null
          name?: string | null
          total_revenue?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      decoration_available: {
        Args: { d: Database["public"]["Tables"]["decorations"]["Row"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      recalc_client: { Args: { c_id: string }; Returns: undefined }
      recalc_decoration: { Args: { dec_id: string }; Returns: undefined }
      recalc_supply: { Args: { sup_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_request_status:
        | "new"
        | "reviewing"
        | "accepted"
        | "confirmed"
        | "completed"
        | "cancelled"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      event_type: "wedding" | "engagement" | "birthday" | "other"
      item_status: "available" | "limited" | "unavailable"
      notif_level: "info" | "warning" | "success" | "error"
      payment_status: "unpaid" | "partial" | "paid"
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
      app_role: ["admin", "user"],
      booking_request_status: [
        "new",
        "reviewing",
        "accepted",
        "confirmed",
        "completed",
        "cancelled",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      event_type: ["wedding", "engagement", "birthday", "other"],
      item_status: ["available", "limited", "unavailable"],
      notif_level: ["info", "warning", "success", "error"],
      payment_status: ["unpaid", "partial", "paid"],
    },
  },
} as const
