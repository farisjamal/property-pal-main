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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin: {
        Row: {
          admin_id: number
          age: number | null
          contact_no: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          gender: string | null
          ic_no: string | null
          name: string
          user_id: string
        }
        Insert: {
          admin_id?: number
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          name: string
          user_id: string
        }
        Update: {
          admin_id?: number
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      appointment: {
        Row: {
          appointment_date: string
          appointment_id: number
          appointment_time: string
          created_at: string | null
          owner_id: number
          property_id: number
          status: string | null
          tenant_id: number
        }
        Insert: {
          appointment_date: string
          appointment_id?: number
          appointment_time: string
          created_at?: string | null
          owner_id: number
          property_id: number
          status?: string | null
          tenant_id: number
        }
        Update: {
          appointment_date?: string
          appointment_id?: number
          appointment_time?: string
          created_at?: string | null
          owner_id?: number
          property_id?: number
          status?: string | null
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owner"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "appointment_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "appointment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          property_id: number
          tenant_id: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_id: number
          tenant_id: number
        }
        Update: {
          created_at?: string | null
          id?: string
          property_id?: number
          tenant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "property"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "favorites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      notifications: {
        Row: {
          notification_id: number
          recipient_email: string
          recipient_type: string
          sent_at: string | null
          status: string | null
          subject: string
          type: string
        }
        Insert: {
          notification_id?: number
          recipient_email: string
          recipient_type: string
          sent_at?: string | null
          status?: string | null
          subject: string
          type: string
        }
        Update: {
          notification_id?: number
          recipient_email?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          type?: string
        }
        Relationships: []
      }
      kyc_submission: {
        Row: {
          created_at: string
          full_name_enc: string
          ic_back_path: string
          ic_front_path: string
          ic_no_enc: string
          id: string
          owner_id: number
          pdpa_consent_at: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: number | null
          selfie_path: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name_enc: string
          ic_back_path: string
          ic_front_path: string
          ic_no_enc: string
          id?: string
          owner_id: number
          pdpa_consent_at: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          selfie_path: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name_enc?: string
          ic_back_path?: string
          ic_front_path?: string
          ic_no_enc?: string
          id?: string
          owner_id?: number
          pdpa_consent_at?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          selfie_path?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_submission_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owner"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "kyc_submission_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin"
            referencedColumns: ["admin_id"]
          },
        ]
      }
      property: {
        Row: {
          availability_status: string | null
          created_at: string | null
          description: string | null
          images: string[] | null
          location: string
          num_bathroom: number
          num_bedroom: number
          owner_id: number
          property_id: number
          property_size: number | null
          property_type: string
          rental_price: number
        }
        Insert: {
          availability_status?: string | null
          created_at?: string | null
          description?: string | null
          images?: string[] | null
          location: string
          num_bathroom: number
          num_bedroom: number
          owner_id: number
          property_id?: number
          property_size?: number | null
          property_type: string
          rental_price: number
        }
        Update: {
          availability_status?: string | null
          created_at?: string | null
          description?: string | null
          images?: string[] | null
          location?: string
          num_bathroom?: number
          num_bedroom?: number
          owner_id?: number
          property_id?: number
          property_size?: number | null
          property_type?: string
          rental_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owner"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      property_owner: {
        Row: {
          age: number | null
          contact_no: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          gender: string | null
          ic_no: string | null
          kyc_status: string
          name: string
          owner_id: number
          security_pin_hash: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          kyc_status?: string
          name: string
          owner_id?: number
          security_pin_hash?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          kyc_status?: string
          name?: string
          owner_id?: number
          security_pin_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owner_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          role: string
          role_id: number
        }
        Insert: {
          created_at?: string | null
          role: string
          role_id?: number
        }
        Update: {
          created_at?: string | null
          role?: string
          role_id?: number
        }
        Relationships: []
      }
      tenant: {
        Row: {
          age: number | null
          contact_no: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          gender: string | null
          ic_no: string | null
          name: string
          tenant_id: number
          user_id: string
        }
        Insert: {
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          name: string
          tenant_id?: number
          user_id: string
        }
        Update: {
          age?: number | null
          contact_no?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          ic_no?: string | null
          name?: string
          tenant_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role_id: number
          user_id: string
        }
        Insert: {
          id?: string
          role_id: number
          user_id: string
        }
        Update: {
          id?: string
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          role_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          role_id: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          role_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_owner_id: { Args: { _user_id: string }; Returns: number }
      get_tenant_id: { Args: { _user_id: string }; Returns: number }
      get_user_role_id: { Args: { _user_id: string }; Returns: number }
      has_role_id: {
        Args: { _role_id: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
