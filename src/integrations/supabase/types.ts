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
      apartment_type_quantities: {
        Row: {
          apartment_type: string
          delivered_qty: number
          id: string
          notes: string
          ordered_qty: number
          qty_per_package: number
          spare_per_package: number
          standard_item_id: string
          status: string
          updated_at: string
        }
        Insert: {
          apartment_type: string
          delivered_qty?: number
          id: string
          notes?: string
          ordered_qty?: number
          qty_per_package?: number
          spare_per_package?: number
          standard_item_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          apartment_type?: string
          delivered_qty?: number
          id?: string
          notes?: string
          ordered_qty?: number
          qty_per_package?: number
          spare_per_package?: number
          standard_item_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          area: string
          created_at: string
          description: string
          discipline: string
          id: string
          image_url: string | null
          name: string
          sku: string
          supplier_id: string | null
          supplier_name: string
          unit_price_eur: number | null
          updated_at: string
        }
        Insert: {
          area?: string
          created_at?: string
          description?: string
          discipline?: string
          id: string
          image_url?: string | null
          name?: string
          sku?: string
          supplier_id?: string | null
          supplier_name?: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string
          discipline?: string
          id?: string
          image_url?: string | null
          name?: string
          sku?: string
          supplier_id?: string | null
          supplier_name?: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name_en: string
          name_he: string
          order: number
          scope: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id: string
          name_en?: string
          name_he?: string
          order?: number
          scope?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name_en?: string
          name_he?: string
          order?: number
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          quote_currency: string
          rate: number
        }
        Insert: {
          base_currency: string
          fetched_at?: string
          quote_currency?: string
          rate: number
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          quote_currency?: string
          rate?: number
        }
        Relationships: []
      }
      item_offer_history: {
        Row: {
          action: string
          changed_at: string
          history_id: number
          offer_id: string
          snapshot: Json
          standard_item_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          history_id?: number
          offer_id: string
          snapshot: Json
          standard_item_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          history_id?: number
          offer_id?: string
          snapshot?: Json
          standard_item_id?: string
        }
        Relationships: []
      }
      item_offers: {
        Row: {
          created_at: string
          currency: string
          dimensions: string | null
          id: string
          image_url: string | null
          is_selected: boolean
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          price: number
          price_eur: number | null
          product_name: string
          product_sku: string | null
          spec: string | null
          standard_item_id: string
          supplier_id: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          dimensions?: string | null
          id: string
          image_url?: string | null
          is_selected?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          price?: number
          price_eur?: number | null
          product_name?: string
          product_sku?: string | null
          spec?: string | null
          standard_item_id: string
          supplier_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_selected?: boolean
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          price?: number
          price_eur?: number | null
          product_name?: string
          product_sku?: string | null
          spec?: string | null
          standard_item_id?: string
          supplier_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_offers_standard_item_id_fkey"
            columns: ["standard_item_id"]
            isOneToOne: false
            referencedRelation: "standard_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_offers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          block: string
          created_at: string
          description: string
          id: string
          items: Json
          name: string
          room_types: Json
          updated_at: string
        }
        Insert: {
          block: string
          created_at?: string
          description?: string
          id: string
          items?: Json
          name?: string
          room_types?: Json
          updated_at?: string
        }
        Update: {
          block?: string
          created_at?: string
          description?: string
          id?: string
          items?: Json
          name?: string
          room_types?: Json
          updated_at?: string
        }
        Relationships: []
      }
      public_area_items: {
        Row: {
          category_id: string
          created_at: string
          delivered_qty: number
          id: string
          item_name: string
          node_id: string
          notes: string
          ordered_qty: number
          qty: number
          spare: number
          spec: string
          status: string
          supplier_id: string | null
          unit_price_eur: number | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          category_id?: string
          created_at?: string
          delivered_qty?: number
          id: string
          item_name?: string
          node_id: string
          notes?: string
          ordered_qty?: number
          qty?: number
          spare?: number
          spec?: string
          status?: string
          supplier_id?: string | null
          unit_price_eur?: number | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          delivered_qty?: number
          id?: string
          item_name?: string
          node_id?: string
          notes?: string
          ordered_qty?: number
          qty?: number
          spare?: number
          spec?: string
          status?: string
          supplier_id?: string | null
          unit_price_eur?: number | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: []
      }
      public_area_nodes: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          name_he: string | null
          order: number
          parent_id: string | null
          type: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id: string
          name?: string
          name_he?: string | null
          order?: number
          parent_id?: string | null
          type: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          name_he?: string | null
          order?: number
          parent_id?: string | null
          type?: string
        }
        Relationships: []
      }
      public_area_plans: {
        Row: {
          created_at: string
          data: Json
          id: string
          node_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          node_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          node_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      standard_items: {
        Row: {
          archived: boolean
          category_id: string
          created_at: string
          dimensions: string | null
          id: string
          item_name: string
          order: number
          spec: string
          supplier_id: string | null
          unit_price_eur: number | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category_id?: string
          created_at?: string
          dimensions?: string | null
          id: string
          item_name?: string
          order?: number
          spec?: string
          supplier_id?: string | null
          unit_price_eur?: number | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category_id?: string
          created_at?: string
          dimensions?: string | null
          id?: string
          item_name?: string
          order?: number
          spec?: string
          supplier_id?: string | null
          unit_price_eur?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string
          category: string
          contact_person: string
          country: string
          created_at: string
          currency: string
          email: string
          id: string
          items: Json
          name: string
          notes: string
          payment_terms: string
          phone: string
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          category?: string
          contact_person?: string
          country?: string
          created_at?: string
          currency?: string
          email?: string
          id: string
          items?: Json
          name?: string
          notes?: string
          payment_terms?: string
          phone?: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          category?: string
          contact_person?: string
          country?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          items?: Json
          name?: string
          notes?: string
          payment_terms?: string
          phone?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
