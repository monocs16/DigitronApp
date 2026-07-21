export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          app_user: string | null;
          change_ts: string;
          changed_fields: Json | null;
          column_name: string | null;
          db_user: string | null;
          full_row_new: Json | null;
          full_row_old: Json | null;
          id: number;
          new_value: string | null;
          old_value: string | null;
          operation: string;
          record_pk: Json | null;
          schema_name: string;
          table_name: string;
        };
        Insert: {
          app_user?: string | null;
          change_ts?: string;
          changed_fields?: Json | null;
          column_name?: string | null;
          db_user?: string | null;
          full_row_new?: Json | null;
          full_row_old?: Json | null;
          id?: never;
          new_value?: string | null;
          old_value?: string | null;
          operation: string;
          record_pk?: Json | null;
          schema_name: string;
          table_name: string;
        };
        Update: {
          app_user?: string | null;
          change_ts?: string;
          changed_fields?: Json | null;
          column_name?: string | null;
          db_user?: string | null;
          full_row_new?: Json | null;
          full_row_old?: Json | null;
          id?: never;
          new_value?: string | null;
          old_value?: string | null;
          operation?: string;
          record_pk?: Json | null;
          schema_name?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          advances: number;
          budgeted_at: string;
          customer_comments: string | null;
          decided_at: string | null;
          decision: Database["public"]["Enums"]["budget_decision"] | null;
          deferred_reason: string | null;
          freight_cost: number;
          id: string;
          labor_cost: number;
          order_id: string;
          other_charges: number;
          parts_cost: number;
          updated_at: string;
        };
        Insert: {
          advances?: number;
          budgeted_at?: string;
          customer_comments?: string | null;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["budget_decision"] | null;
          deferred_reason?: string | null;
          freight_cost?: number;
          id?: string;
          labor_cost?: number;
          order_id: string;
          other_charges?: number;
          parts_cost?: number;
          updated_at?: string;
        };
        Update: {
          advances?: number;
          budgeted_at?: string;
          customer_comments?: string | null;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["budget_decision"] | null;
          deferred_reason?: string | null;
          freight_cost?: number;
          id?: string;
          labor_cost?: number;
          order_id?: string;
          other_charges?: number;
          parts_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          email: string | null;
          id: string;
          name: string;
          phone1: string | null;
          phone2: string | null;
          registered_at: string;
          tax_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          phone1?: string | null;
          phone2?: string | null;
          registered_at?: string;
          tax_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          phone1?: string | null;
          phone2?: string | null;
          registered_at?: string;
          tax_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment: {
        Row: {
          brand: string;
          created_at: string;
          id: string;
          model: string;
          purchase_date: string | null;
          purchase_invoice: string | null;
          purchase_store: string | null;
          serial_number: string | null;
          type: string;
        };
        Insert: {
          brand: string;
          created_at?: string;
          id?: string;
          model: string;
          purchase_date?: string | null;
          purchase_invoice?: string | null;
          purchase_store?: string | null;
          serial_number?: string | null;
          type: string;
        };
        Update: {
          brand?: string;
          created_at?: string;
          id?: string;
          model?: string;
          purchase_date?: string | null;
          purchase_invoice?: string | null;
          purchase_store?: string | null;
          serial_number?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      order_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string;
          id: string;
          order_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by: string;
          id?: string;
          order_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_notes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_parts: {
        Row: {
          created_at: string;
          evaluation_id: string | null;
          id: string;
          in_stock_at_registration: boolean;
          order_id: string;
          part_id: string;
          quantity: number;
          stage: string;
          supplier_part_number: string | null;
          unit_cost_at_registration: number;
        };
        Insert: {
          created_at?: string;
          evaluation_id?: string | null;
          id?: string;
          in_stock_at_registration?: boolean;
          order_id: string;
          part_id: string;
          quantity: number;
          stage?: string;
          supplier_part_number?: string | null;
          unit_cost_at_registration?: number;
        };
        Update: {
          created_at?: string;
          evaluation_id?: string | null;
          id?: string;
          in_stock_at_registration?: boolean;
          order_id?: string;
          part_id?: string;
          quantity?: number;
          stage?: string;
          supplier_part_number?: string | null;
          unit_cost_at_registration?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_parts_evaluation_id_fkey";
            columns: ["evaluation_id"];
            isOneToOne: false;
            referencedRelation: "technical_evaluations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_part_id_fkey";
            columns: ["part_id"];
            isOneToOne: false;
            referencedRelation: "parts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_part_id_fkey";
            columns: ["part_id"];
            isOneToOne: false;
            referencedRelation: "parts_technician";
            referencedColumns: ["id"];
          },
        ];
      };
      order_photos: {
        Row: {
          id: string;
          order_id: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_photos_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_photos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          authorized: boolean;
          balance_waived: boolean;
          client_id: string;
          closing_notes: string | null;
          created_at: string;
          created_by: string | null;
          decision_notified_at: string | null;
          delivery_at: string | null;
          delivery_notified_at: string | null;
          equipment_condition: string;
          equipment_id: string;
          general_notes: string | null;
          id: string;
          intake_at: string;
          order_number: string;
          received_accessories: string | null;
          received_by: string | null;
          reported_fault: string;
          source: string | null;
          stage: Database["public"]["Enums"]["order_stage"];
          technician_id: string | null;
          updated_at: string;
          warranty_origin_id: string | null;
        };
        Insert: {
          authorized?: boolean;
          balance_waived?: boolean;
          client_id: string;
          closing_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision_notified_at?: string | null;
          delivery_at?: string | null;
          delivery_notified_at?: string | null;
          equipment_condition?: string;
          equipment_id: string;
          general_notes?: string | null;
          id?: string;
          intake_at?: string;
          order_number?: string;
          received_accessories?: string | null;
          received_by?: string | null;
          reported_fault: string;
          source?: string | null;
          stage?: Database["public"]["Enums"]["order_stage"];
          technician_id?: string | null;
          updated_at?: string;
          warranty_origin_id?: string | null;
        };
        Update: {
          authorized?: boolean;
          balance_waived?: boolean;
          client_id?: string;
          closing_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision_notified_at?: string | null;
          delivery_at?: string | null;
          delivery_notified_at?: string | null;
          equipment_condition?: string;
          equipment_id?: string;
          general_notes?: string | null;
          id?: string;
          intake_at?: string;
          order_number?: string;
          received_accessories?: string | null;
          received_by?: string | null;
          reported_fault?: string;
          source?: string | null;
          stage?: Database["public"]["Enums"]["order_stage"];
          technician_id?: string | null;
          updated_at?: string;
          warranty_origin_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_technician_id_fkey";
            columns: ["technician_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_warranty_origin_id_fkey";
            columns: ["warranty_origin_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      parts: {
        Row: {
          created_at: string;
          created_from_order_id: string | null;
          description: string;
          id: string;
          part_code: string;
          stock: number;
          supplier: string | null;
          unit_cost: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_from_order_id?: string | null;
          description: string;
          id?: string;
          part_code: string;
          stock?: number;
          supplier?: string | null;
          unit_cost?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_from_order_id?: string | null;
          description?: string;
          id?: string;
          part_code?: string;
          stock?: number;
          supplier?: string | null;
          unit_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parts_created_from_order_id_fkey";
            columns: ["created_from_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          id: string;
          method: string;
          order_id: string;
          paid_at: string;
          reference: string | null;
          registered_by: string | null;
        };
        Insert: {
          amount: number;
          id?: string;
          method: string;
          order_id: string;
          paid_at?: string;
          reference?: string | null;
          registered_by?: string | null;
        };
        Update: {
          amount?: number;
          id?: string;
          method?: string;
          order_id?: string;
          paid_at?: string;
          reference?: string | null;
          registered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_registered_by_fkey";
            columns: ["registered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      repairs: {
        Row: {
          created_at: string;
          finished_at: string | null;
          id: string;
          order_id: string;
          started_at: string | null;
          state: string;
          technician_id: string | null;
          updated_at: string;
          work_description: string | null;
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          order_id: string;
          started_at?: string | null;
          state?: string;
          technician_id?: string | null;
          updated_at?: string;
          work_description?: string | null;
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          order_id?: string;
          started_at?: string | null;
          state?: string;
          technician_id?: string | null;
          updated_at?: string;
          work_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "repairs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "repairs_technician_id_fkey";
            columns: ["technician_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      technical_evaluations: {
        Row: {
          diagnosis: string;
          evaluated_at: string;
          id: string;
          order_id: string;
          technical_notes: string | null;
          technician_id: string | null;
        };
        Insert: {
          diagnosis: string;
          evaluated_at?: string;
          id?: string;
          order_id: string;
          technical_notes?: string | null;
          technician_id?: string | null;
        };
        Update: {
          diagnosis?: string;
          evaluated_at?: string;
          id?: string;
          order_id?: string;
          technical_notes?: string | null;
          technician_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "technical_evaluations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "technical_evaluations_technician_id_fkey";
            columns: ["technician_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      order_parts_technician: {
        Row: {
          created_at: string | null;
          evaluation_id: string | null;
          id: string | null;
          order_id: string | null;
          part_id: string | null;
          quantity: number | null;
          stage: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_parts_evaluation_id_fkey";
            columns: ["evaluation_id"];
            isOneToOne: false;
            referencedRelation: "technical_evaluations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_part_id_fkey";
            columns: ["part_id"];
            isOneToOne: false;
            referencedRelation: "parts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_parts_part_id_fkey";
            columns: ["part_id"];
            isOneToOne: false;
            referencedRelation: "parts_technician";
            referencedColumns: ["id"];
          },
        ];
      };
      parts_technician: {
        Row: {
          description: string | null;
          id: string | null;
          part_code: string | null;
        };
        Insert: {
          description?: string | null;
          id?: string | null;
          part_code?: string | null;
        };
        Update: {
          description?: string | null;
          id?: string | null;
          part_code?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      app_role: "cliente" | "administrativo" | "tecnico" | "super";
      budget_decision: "approved" | "deferred" | "rejected";
      order_stage:
        | "intake"
        | "evaluation"
        | "budget"
        | "customer_decision"
        | "on_hold"
        | "repair"
        | "payment"
        | "awaiting_withdrawal"
        | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["cliente", "administrativo", "tecnico", "super"],
      budget_decision: ["approved", "deferred", "rejected"],
      order_stage: [
        "intake",
        "evaluation",
        "budget",
        "customer_decision",
        "on_hold",
        "repair",
        "payment",
        "awaiting_withdrawal",
        "closed",
      ],
    },
  },
} as const;
