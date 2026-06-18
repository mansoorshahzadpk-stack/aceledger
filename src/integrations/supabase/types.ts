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
      app_settings: {
        Row: {
          active_business_id: string | null
          business_address: string | null
          business_logo_url: string | null
          business_name: string | null
          business_phone: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          default_doc_template: Database["public"]["Enums"]["doc_template"]
          master_password_failed_attempts: number
          master_password_hash: string | null
          master_password_lockout_until: string | null
          master_password_reset_expires_at: string | null
          master_password_reset_token: string | null
          theme: Database["public"]["Enums"]["ui_theme"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_business_id?: string | null
          business_address?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          default_doc_template?: Database["public"]["Enums"]["doc_template"]
          master_password_failed_attempts?: number
          master_password_hash?: string | null
          master_password_lockout_until?: string | null
          master_password_reset_expires_at?: string | null
          master_password_reset_token?: string | null
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_business_id?: string | null
          business_address?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          default_doc_template?: Database["public"]["Enums"]["doc_template"]
          master_password_failed_attempts?: number
          master_password_hash?: string | null
          master_password_lockout_until?: string | null
          master_password_reset_expires_at?: string | null
          master_password_reset_token?: string | null
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_active_business_id_fkey"
            columns: ["active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      businesses: {
        Row: {
          address: string | null
          business_code: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          logo_url: string | null
          name: string
          owner_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_code?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          logo_url?: string | null
          name: string
          owner_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_code?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          logo_url?: string | null
          name?: string
          owner_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          user_id: string
          business_id: string
          name: string
          type: "bank_account" | "petty_cash" | "property_equipment"
          initial_balance: number
          current_valuation: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          name: string
          type: "bank_account" | "petty_cash" | "property_equipment"
          initial_balance?: number
          current_valuation?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_id?: string
          name?: string
          type?: "bank_account" | "petty_cash" | "property_equipment"
          initial_balance?: number
          current_valuation?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      client_payments: {
        Row: {
          amount: number
          asset_id: string | null
          business_id: string
          client_id: string
          created_at: string
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          reconciled: boolean
          reference: string | null
          status: "draft" | "posted"
          posted_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asset_id?: string | null
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reconciled?: boolean
          reference?: string | null
          status?: "draft" | "posted"
          posted_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reconciled?: boolean
          reference?: string | null
          status?: "draft" | "posted"
          posted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          business_id: string
          code_prefix: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          next_invoice_sequence: number
          notes: string | null
          opening_balance: number
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_id: string
          code_prefix: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          next_invoice_sequence?: number
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_id?: string
          code_prefix?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          next_invoice_sequence?: number
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_counters: {
        Row: {
          business_id: string
          kind: string
          last_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          kind: string
          last_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          kind?: string
          last_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grn_amendments: {
        Row: {
          action: Database["public"]["Enums"]["amend_action"]
          created_at: string
          grn_id: string
          id: string
          new_total: number
          previous_total: number
          reason: string
          user_id: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["amend_action"]
          created_at?: string
          grn_id: string
          id?: string
          new_total: number
          previous_total: number
          reason: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["amend_action"]
          created_at?: string
          grn_id?: string
          id?: string
          new_total?: number
          previous_total?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_amendments: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          new_total: number
          previous_total: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          new_total: number
          previous_total: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          new_total?: number
          previous_total?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_amendments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          grn_ref: string | null
          id: string
          invoice_id: string
          line_total: number
          product_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          vehicle_ref: string | null
          quantity_formula: string | null
          unit_price_formula: string | null
        }
        Insert: {
          description: string
          grn_ref?: string | null
          id?: string
          invoice_id: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vehicle_ref?: string | null
          quantity_formula?: string | null
          unit_price_formula?: string | null
        }
        Update: {
          description?: string
          grn_ref?: string | null
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vehicle_ref?: string | null
          quantity_formula?: string | null
          unit_price_formula?: string | null
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
          business_id: string
          client_id: string
          created_at: string
          current_version: number
          discount: number
          doc_template: Database["public"]["Enums"]["doc_template"]
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          posted_at: string | null
          shipping: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string
          discount_formula: string | null
          tax_formula: string | null
          shipping_formula: string | null
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          current_version?: number
          discount?: number
          doc_template?: Database["public"]["Enums"]["doc_template"]
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          posted_at?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id: string
          discount_formula?: string | null
          tax_formula?: string | null
          shipping_formula?: string | null
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          current_version?: number
          discount?: number
          doc_template?: Database["public"]["Enums"]["doc_template"]
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          posted_at?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string
          discount_formula?: string | null
          tax_formula?: string | null
          shipping_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          id: string
          user_id: string
          business_id: string
          transaction_date: string
          category: string
          description: string | null
          type: "debit" | "credit"
          amount: number
          asset_id: string | null
          reconciled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          transaction_date?: string
          category: string
          description?: string | null
          type: "debit" | "credit"
          amount: number
          asset_id?: string | null
          reconciled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_id?: string
          transaction_date?: string
          category?: string
          description?: string | null
          type?: "debit" | "credit"
          amount?: number
          asset_id?: string | null
          reconciled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      payment_amendments: {
        Row: {
          action: Database["public"]["Enums"]["amend_action"]
          client_id: string
          created_at: string
          id: string
          new_amount: number
          payment_id: string | null
          previous_amount: number
          reason: string
          user_id: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["amend_action"]
          client_id: string
          created_at?: string
          id?: string
          new_amount: number
          payment_id?: string | null
          previous_amount: number
          reason: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["amend_action"]
          client_id?: string
          created_at?: string
          id?: string
          new_amount?: number
          payment_id?: string | null
          previous_amount?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      transfer_logs: {
        Row: {
          id: string
          user_id: string
          business_id: string
          from_asset_id: string
          to_asset_id: string
          amount: number
          remarks: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          from_asset_id: string
          to_asset_id: string
          amount: number
          remarks?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_id?: string
          from_asset_id?: string
          to_asset_id?: string
          amount?: number
          remarks?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_logs_from_asset_id_fkey"
            columns: ["from_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_logs_to_asset_id_fkey"
            columns: ["to_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          default_price: number
          default_tax_rate: number
          description: string | null
          id: string
          name: string
          sku: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          default_price?: number
          default_tax_rate?: number
          description?: string | null
          id?: string
          name: string
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          default_price?: number
          default_tax_rate?: number
          description?: string | null
          id?: string
          name?: string
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      vendor_grns: {
        Row: {
          business_id: string
          created_at: string
          discount: number
          doc_template: Database["public"]["Enums"]["doc_template"]
          grn_date: string
          grn_number: string
          id: string
          material: string
          notes: string | null
          product_id: string | null
          quantity: number
          shipping: number
          status: "draft" | "posted"
          posted_at: string | null
          tax: number
          total_amount: number
          unit: string
          unit_price: number
          user_id: string
          vendor_id: string
          quantity_formula: string | null
          unit_price_formula: string | null
          discount_formula: string | null
          tax_formula: string | null
          shipping_formula: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          discount?: number
          doc_template?: Database["public"]["Enums"]["doc_template"]
          grn_date?: string
          grn_number: string
          id?: string
          material: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          shipping?: number
          status?: "draft" | "posted"
          posted_at?: string | null
          tax?: number
          total_amount?: number
          unit?: string
          unit_price?: number
          user_id: string
          vendor_id: string
          quantity_formula?: string | null
          unit_price_formula?: string | null
          discount_formula?: string | null
          tax_formula?: string | null
          shipping_formula?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          discount?: number
          doc_template?: Database["public"]["Enums"]["doc_template"]
          grn_date?: string
          grn_number?: string
          id?: string
          material?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          shipping?: number
          status?: "draft" | "posted"
          posted_at?: string | null
          tax?: number
          total_amount?: number
          unit?: string
          unit_price?: number
          user_id?: string
          vendor_id?: string
          quantity_formula?: string | null
          unit_price_formula?: string | null
          discount_formula?: string | null
          tax_formula?: string | null
          shipping_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_grns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          asset_id: string | null
          business_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          reconciled: boolean
          reference: string | null
          user_id: string
          vendor_id: string
        }
        Insert: {
          amount: number
          asset_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reconciled?: boolean
          reference?: string | null
          user_id: string
          vendor_id: string
        }
        Update: {
          amount?: number
          asset_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          reconciled?: boolean
          reference?: string | null
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
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
          business_id: string
          code_prefix: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          next_grn_sequence: number
          notes: string | null
          opening_balance: number
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_id: string
          code_prefix: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          next_grn_sequence?: number
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_id?: string
          code_prefix?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          next_grn_sequence?: number
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      get_next_grn_number: { Args: { _vendor_id: string }; Returns: string }
      get_next_invoice_number: { Args: { _client_id: string }; Returns: string }
      next_doc_number: { Args: { _business_id: string; _kind: string }; Returns: string }
      transfer_funds: {
        Args: {
          p_from_asset_id: string
          p_to_asset_id: string
          p_amount: number
          p_date: string
          p_remarks: string
          p_user_id: string
          p_business_id: string
        }
        Returns: undefined
      }
      update_client_payment: {
        Args: {
          p_payment_id: string
          p_amount: number
          p_date: string
          p_method: string
          p_reference: string
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      set_master_password: {
        Args: {
          p_user_id: string
          p_password: string
        }
        Returns: undefined
      }
      check_master_password: {
        Args: {
          p_user_id: string
          p_password: string
        }
        Returns: boolean
      }
      check_master_password_reset: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      reset_master_password_with_token: {
        Args: {
          p_token: string
          p_new_password: string
        }
        Returns: boolean
      }
      request_master_password_recovery: {
        Args: {
          p_user_id: string
        }
        Returns: string
      }
      delete_audit_log_entry: {
        Args: {
          p_user_id: string
          p_password: string
          p_id: string
          p_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      amend_action: "edit" | "delete"
      app_role: "admin" | "user"
      currency_code:
        | "PKR"
        | "USD"
        | "EUR"
        | "INR"
        | "BDT"
        | "AED"
        | "LKR"
        | "GBP"
        | "SAR"
        | "CNY"
      doc_template: "classic" | "modern" | "compact" | "acelog"
      invoice_status: "draft" | "posted"
      payment_method: "cash" | "bank" | "cheque" | "mobile" | "other"
      ui_theme:
        | "light"
        | "dark"
        | "contrast"
        | "coloured"
        | "lavender"
        | "maroon"
        | "green"
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
      amend_action: ["edit", "delete"],
      app_role: ["admin", "user"],
      currency_code: [
        "PKR",
        "USD",
        "EUR",
        "INR",
        "BDT",
        "AED",
        "LKR",
        "GBP",
        "SAR",
        "CNY",
      ],
      doc_template: ["classic", "modern", "compact", "acelog"],
      invoice_status: ["draft", "posted"],
      payment_method: ["cash", "bank", "cheque", "mobile", "other"],
      ui_theme: [
        "light",
        "dark",
        "contrast",
        "coloured",
        "lavender",
        "maroon",
        "green",
      ],
    },
  },
} as const
