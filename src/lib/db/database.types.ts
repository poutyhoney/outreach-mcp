export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          id: string;
          key_hash: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          key_hash: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          key_hash?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          api_key_id: string | null;
          args_redacted: NonNullable<Json>;
          created_at: string;
          id: string;
          ok: boolean;
          result_summary: string | null;
          tool_name: string;
        };
        ComputedFields: never;
        Insert: {
          api_key_id?: string | null;
          args_redacted?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          ok: boolean;
          result_summary?: string | null;
          tool_name: string;
        };
        Update: {
          api_key_id?: string | null;
          args_redacted?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          ok?: boolean;
          result_summary?: string | null;
          tool_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_api_key_id_fkey";
            columns: ["api_key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      broadcasts: {
        Row: {
          body_template: string;
          confirm_token_hash: string | null;
          created_at: string;
          id: string;
          name: string;
          preview_count: number | null;
          sent_count: number;
          skipped_count: number;
          status: Database["public"]["Enums"]["broadcast_status"];
          tag_filter: string;
        };
        ComputedFields: never;
        Insert: {
          body_template: string;
          confirm_token_hash?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          preview_count?: number | null;
          sent_count?: number;
          skipped_count?: number;
          status?: Database["public"]["Enums"]["broadcast_status"];
          tag_filter: string;
        };
        Update: {
          body_template?: string;
          confirm_token_hash?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          preview_count?: number | null;
          sent_count?: number;
          skipped_count?: number;
          status?: Database["public"]["Enums"]["broadcast_status"];
          tag_filter?: string;
        };
        Relationships: [];
      };
      consent_events: {
        Row: {
          channel: Database["public"]["Enums"]["consent_channel"];
          contact_id: string;
          created_at: string;
          id: string;
          raw_body: string | null;
          received_at: string;
          type: Database["public"]["Enums"]["consent_type"];
        };
        ComputedFields: never;
        Insert: {
          channel: Database["public"]["Enums"]["consent_channel"];
          contact_id: string;
          created_at?: string;
          id?: string;
          raw_body?: string | null;
          received_at?: string;
          type: Database["public"]["Enums"]["consent_type"];
        };
        Update: {
          channel?: Database["public"]["Enums"]["consent_channel"];
          contact_id?: string;
          created_at?: string;
          id?: string;
          raw_body?: string | null;
          received_at?: string;
          type?: Database["public"]["Enums"]["consent_type"];
        };
        Relationships: [
          {
            foreignKeyName: "consent_events_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contact_consent_status";
            referencedColumns: ["contact_id"];
          },
          {
            foreignKeyName: "consent_events_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_tags: {
        Row: {
          contact_id: string;
          created_at: string;
          id: string;
          tag_id: string;
        };
        ComputedFields: never;
        Insert: {
          contact_id: string;
          created_at?: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contact_consent_status";
            referencedColumns: ["contact_id"];
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          custom_fields: NonNullable<Json>;
          first_name: string | null;
          id: string;
          last_name: string | null;
          phone_e164: string;
          source: string | null;
          timezone: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_fields?: NonNullable<Json>;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone_e164: string;
          source?: string | null;
          timezone?: string | null;
        };
        Update: {
          created_at?: string;
          custom_fields?: NonNullable<Json>;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone_e164?: string;
          source?: string | null;
          timezone?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          broadcast_id: string | null;
          contact_id: string;
          created_at: string;
          direction: Database["public"]["Enums"]["message_direction"];
          error_code: string | null;
          id: string;
          provider: string;
          provider_message_id: string | null;
          sandbox_redirected_to: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          broadcast_id?: string | null;
          contact_id: string;
          created_at?: string;
          direction: Database["public"]["Enums"]["message_direction"];
          error_code?: string | null;
          id?: string;
          provider: string;
          provider_message_id?: string | null;
          sandbox_redirected_to?: string | null;
          status?: string;
        };
        Update: {
          body?: string;
          broadcast_id?: string | null;
          contact_id?: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["message_direction"];
          error_code?: string | null;
          id?: string;
          provider?: string;
          provider_message_id?: string | null;
          sandbox_redirected_to?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_broadcast_id_fkey";
            columns: ["broadcast_id"];
            isOneToOne: false;
            referencedRelation: "broadcasts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contact_consent_status";
            referencedColumns: ["contact_id"];
          },
          {
            foreignKeyName: "messages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      contact_consent_status: {
        Row: {
          channel: Database["public"]["Enums"]["consent_channel"] | null;
          contact_id: string;
          is_opted_out: boolean | null;
          status: Database["public"]["Enums"]["consent_type"] | null;
          status_at: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      broadcast_status: "draft" | "previewed" | "confirmed" | "sending" | "done";
      consent_channel: "sms_keyword" | "import" | "manual";
      consent_type: "opt_in" | "opt_out";
      message_direction: "outbound" | "inbound";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      broadcast_status: ["draft", "previewed", "confirmed", "sending", "done"],
      consent_channel: ["sms_keyword", "import", "manual"],
      consent_type: ["opt_in", "opt_out"],
      message_direction: ["outbound", "inbound"],
    },
  },
} as const;
