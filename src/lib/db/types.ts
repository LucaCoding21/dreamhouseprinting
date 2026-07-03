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
      _app_migrations: {
        Row: {
          applied_at: string
          checksum: string
          name: string
        }
        Insert: {
          applied_at?: string
          checksum: string
          name: string
        }
        Update: {
          applied_at?: string
          checksum?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image: string | null
          is_major: boolean
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image?: string | null
          is_major?: boolean
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image?: string | null
          is_major?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      decoration_methods: {
        Row: {
          constraints: Json
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          per_color_cost: number
          per_unit_cost: number
          setup_fee: number
          slug: string
          updated_at: string
        }
        Insert: {
          constraints?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          per_color_cost?: number
          per_unit_cost?: number
          setup_fee?: number
          slug: string
          updated_at?: string
        }
        Update: {
          constraints?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          per_color_cost?: number
          per_unit_cost?: number
          setup_fee?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          colorways: Json
          colour: Json | null
          created_at: string
          customer_id: string | null
          decoration_method_id: string | null
          guest_contact: Json | null
          guest_token: string | null
          id: string
          lead_email: string | null
          mockup_images: Json
          name: string | null
          organization_id: string | null
          price_snapshot: Json | null
          print_area_ids: string[]
          product_id: string | null
          scene_definition: Json | null
          size_quantities: Json
          source_artwork_files: Json
          status: string
          updated_at: string
        }
        Insert: {
          colorways?: Json
          colour?: Json | null
          created_at?: string
          customer_id?: string | null
          decoration_method_id?: string | null
          guest_contact?: Json | null
          guest_token?: string | null
          id?: string
          lead_email?: string | null
          mockup_images?: Json
          name?: string | null
          organization_id?: string | null
          price_snapshot?: Json | null
          print_area_ids?: string[]
          product_id?: string | null
          scene_definition?: Json | null
          size_quantities?: Json
          source_artwork_files?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          colorways?: Json
          colour?: Json | null
          created_at?: string
          customer_id?: string | null
          decoration_method_id?: string | null
          guest_contact?: Json | null
          guest_token?: string | null
          id?: string
          lead_email?: string | null
          mockup_images?: Json
          name?: string | null
          organization_id?: string | null
          price_snapshot?: Json | null
          print_area_ids?: string[]
          product_id?: string | null
          scene_definition?: Json | null
          size_quantities?: Json
          source_artwork_files?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_decoration_method_id_fkey"
            columns: ["decoration_method_id"]
            isOneToOne: false
            referencedRelation: "decoration_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          colour: Json | null
          created_at: string
          decoration_method_id: string | null
          decorations: Json
          design_id: string | null
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string | null
          setup_fee: number
          size_quantities: Json
          unit_price: number
        }
        Insert: {
          colour?: Json | null
          created_at?: string
          decoration_method_id?: string | null
          decorations?: Json
          design_id?: string | null
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name?: string | null
          setup_fee?: number
          size_quantities?: Json
          unit_price?: number
        }
        Update: {
          colour?: Json | null
          created_at?: string
          decoration_method_id?: string | null
          decorations?: Json
          design_id?: string | null
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string | null
          setup_fee?: number
          size_quantities?: Json
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_items_decoration_method_id_fkey"
            columns: ["decoration_method_id"]
            isOneToOne: false
            referencedRelation: "decoration_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_activity: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: Json
          id: string
          order_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          id?: string
          order_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          id?: string
          order_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string
          customer_id: string | null
          customer_notes: Json
          due_date: string | null
          fulfillment_method: string | null
          guest_email: string | null
          hold_note: string | null
          id: string
          internal_notes: Json
          invoice_amount: number | null
          invoice_sent_at: string | null
          official_mockups: Json
          order_number: string | null
          organization_id: string | null
          paid_at: string | null
          payment_status: string
          pricing: Json
          production_notes: Json
          public_token: string
          sales_rep: string | null
          shipping_address: Json | null
          shipping_method: string | null
          shipping_tracking: string | null
          status: string
          stripe_checkout_session_id: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          customer_id?: string | null
          customer_notes?: Json
          due_date?: string | null
          fulfillment_method?: string | null
          guest_email?: string | null
          hold_note?: string | null
          id?: string
          internal_notes?: Json
          invoice_amount?: number | null
          invoice_sent_at?: string | null
          official_mockups?: Json
          order_number?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string
          pricing?: Json
          production_notes?: Json
          public_token?: string
          sales_rep?: string | null
          shipping_address?: Json | null
          shipping_method?: string | null
          shipping_tracking?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          customer_id?: string | null
          customer_notes?: Json
          due_date?: string | null
          fulfillment_method?: string | null
          guest_email?: string | null
          hold_note?: string | null
          id?: string
          internal_notes?: Json
          invoice_amount?: number | null
          invoice_sent_at?: string | null
          official_mockups?: Json
          order_number?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_status?: string
          pricing?: Json
          production_notes?: Json
          public_token?: string
          sales_rep?: string | null
          shipping_address?: Json | null
          shipping_method?: string | null
          shipping_tracking?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_kit: Json
          created_at: string
          id: string
          name: string
          shared_artwork: Json
          updated_at: string
        }
        Insert: {
          brand_kit?: Json
          created_at?: string
          id?: string
          name: string
          shared_artwork?: Json
          updated_at?: string
        }
        Update: {
          brand_kit?: Json
          created_at?: string
          id?: string
          name?: string
          shared_artwork?: Json
          updated_at?: string
        }
        Relationships: []
      }
      print_areas: {
        Row: {
          created_at: string
          display_order: number
          id: string
          max_height_in: number | null
          max_width_in: number | null
          name: string
          position: Json
          product_id: string
          px_per_inch: number | null
          view: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          max_height_in?: number | null
          max_width_in?: number | null
          name: string
          position: Json
          product_id: string
          px_per_inch?: number | null
          view?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          max_height_in?: number | null
          max_width_in?: number | null
          name?: string
          position?: Json
          product_id?: string
          px_per_inch?: number | null
          view?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_areas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allowed_decoration_method_ids: string[]
          base_price: number | null
          brand: string | null
          category_id: string | null
          colours: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          lead_time_days: number
          markup_type: string
          markup_value: number
          name: string
          photos: Json
          pricing_rules: Json
          sizes: Json
          ss_last_synced_at: string | null
          ss_part_number: string | null
          ss_style_id: string | null
          stock_status: string
          subcategory_id: string | null
          updated_at: string
          wholesale_cost: number | null
        }
        Insert: {
          allowed_decoration_method_ids?: string[]
          base_price?: number | null
          brand?: string | null
          category_id?: string | null
          colours?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lead_time_days?: number
          markup_type?: string
          markup_value?: number
          name: string
          photos?: Json
          pricing_rules?: Json
          sizes?: Json
          ss_last_synced_at?: string | null
          ss_part_number?: string | null
          ss_style_id?: string | null
          stock_status?: string
          subcategory_id?: string | null
          updated_at?: string
          wholesale_cost?: number | null
        }
        Update: {
          allowed_decoration_method_ids?: string[]
          base_price?: number | null
          brand?: string | null
          category_id?: string | null
          colours?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lead_time_days?: number
          markup_type?: string
          markup_value?: number
          name?: string
          photos?: Json
          pricing_rules?: Json
          sizes?: Json
          ss_last_synced_at?: string | null
          ss_part_number?: string | null
          ss_style_id?: string | null
          stock_status?: string
          subcategory_id?: string | null
          updated_at?: string
          wholesale_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          addresses: Json
          created_at: string
          email: string | null
          id: string
          internal_notes: Json
          name: string | null
          notification_preferences: Json
          org_role: string | null
          organization_id: string | null
          payment_methods: Json
          phone: string | null
          role: string
          saved_artwork: Json
          staff_permissions: string[]
          updated_at: string
        }
        Insert: {
          addresses?: Json
          created_at?: string
          email?: string | null
          id: string
          internal_notes?: Json
          name?: string | null
          notification_preferences?: Json
          org_role?: string | null
          organization_id?: string | null
          payment_methods?: Json
          phone?: string | null
          role?: string
          saved_artwork?: Json
          staff_permissions?: string[]
          updated_at?: string
        }
        Update: {
          addresses?: Json
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: Json
          name?: string | null
          notification_preferences?: Json
          org_role?: string | null
          organization_id?: string | null
          payment_methods?: Json
          phone?: string | null
          role?: string
          saved_artwork?: Json
          staff_permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proofs: {
        Row: {
          change_request_comment: string | null
          created_at: string
          created_by: string | null
          decoration_files: Json
          id: string
          image: string
          line_item_id: string | null
          order_id: string
          status: string
        }
        Insert: {
          change_request_comment?: string | null
          created_at?: string
          created_by?: string | null
          decoration_files?: Json
          id?: string
          image: string
          line_item_id?: string | null
          order_id: string
          status?: string
        }
        Update: {
          change_request_comment?: string | null
          created_at?: string
          created_by?: string | null
          decoration_files?: Json
          id?: string
          image?: string
          line_item_id?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofs_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          contact: Json
          converted_order_id: string | null
          created_at: string
          customer_id: string | null
          design_ids: string[]
          id: string
          line_items: Json
          message: string | null
          organization_id: string | null
          pricing: Json
          quote_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact?: Json
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          design_ids?: string[]
          id?: string
          line_items?: Json
          message?: string | null
          organization_id?: string | null
          pricing?: Json
          quote_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact?: Json
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          design_ids?: string[]
          id?: string
          line_items?: Json
          message?: string | null
          organization_id?: string | null
          pricing?: Json
          quote_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      submissions: {
        Row: {
          artwork_files: Json
          created_at: string
          design_description: string | null
          email: string
          estimated_per_unit: number | null
          estimated_total: number | null
          garment_brand: string | null
          garment_color: string
          heard_about: string | null
          id: string
          name: string
          needed_by: string | null
          notes: string | null
          phone: string
          price_match_files: Json
          price_match_link: string | null
          print_colors: string
          print_locations: string[]
          print_method: string
          product_type: string
          quantity: number | null
          quote_estimate: Json | null
          referral_code: string | null
          sizes: Json | null
        }
        Insert: {
          artwork_files?: Json
          created_at?: string
          design_description?: string | null
          email: string
          estimated_per_unit?: number | null
          estimated_total?: number | null
          garment_brand?: string | null
          garment_color: string
          heard_about?: string | null
          id?: string
          name: string
          needed_by?: string | null
          notes?: string | null
          phone: string
          price_match_files?: Json
          price_match_link?: string | null
          print_colors: string
          print_locations?: string[]
          print_method: string
          product_type: string
          quantity?: number | null
          quote_estimate?: Json | null
          referral_code?: string | null
          sizes?: Json | null
        }
        Update: {
          artwork_files?: Json
          created_at?: string
          design_description?: string | null
          email?: string
          estimated_per_unit?: number | null
          estimated_total?: number | null
          garment_brand?: string | null
          garment_color?: string
          heard_about?: string | null
          id?: string
          name?: string
          needed_by?: string | null
          notes?: string | null
          phone?: string
          price_match_files?: Json
          price_match_link?: string | null
          print_colors?: string
          print_locations?: string[]
          print_method?: string
          product_type?: string
          quantity?: number | null
          quote_estimate?: Json | null
          referral_code?: string | null
          sizes?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_order: { Args: { oid: string }; Returns: boolean }
      has_perm: { Args: { flag: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_staff_admin: { Args: never; Returns: boolean }
      my_org: { Args: never; Returns: string }
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
