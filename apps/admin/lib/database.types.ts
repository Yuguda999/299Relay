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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      admin_audit: {
        Row: {
          action: string;
          admin_id: string;
          created_at: string;
          detail: Json | null;
          id: number;
          target: string;
        };
        Insert: {
          action: string;
          admin_id: string;
          created_at?: string;
          detail?: Json | null;
          id?: never;
          target: string;
        };
        Update: {
          action?: string;
          admin_id?: string;
          created_at?: string;
          detail?: Json | null;
          id?: never;
          target?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_audit_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_accounts: {
        Row: {
          account_last4: string;
          active: boolean;
          bank_code: string;
          bank_name: string;
          created_at: string;
          id: string;
          paystack_recipient: string;
          profile_id: string;
          resolved_name: string;
        };
        Insert: {
          account_last4: string;
          active?: boolean;
          bank_code: string;
          bank_name: string;
          created_at?: string;
          id?: string;
          paystack_recipient: string;
          profile_id: string;
          resolved_name: string;
        };
        Update: {
          account_last4?: string;
          active?: boolean;
          bank_code?: string;
          bank_name?: string;
          created_at?: string;
          id?: string;
          paystack_recipient?: string;
          profile_id?: string;
          resolved_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bank_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      campuses: {
        Row: {
          active: boolean;
          created_at: string;
          handoff_curfew: string;
          id: string;
          item_cap_new: number;
          item_cap_trusted: number;
          name: string;
          short_name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          handoff_curfew?: string;
          id?: string;
          item_cap_new?: number;
          item_cap_trusted?: number;
          name: string;
          short_name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          handoff_curfew?: string;
          id?: string;
          item_cap_new?: number;
          item_cap_trusted?: number;
          name?: string;
          short_name?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          last_seen: string;
          platform: string;
          profile_id: string;
          push_token: string;
        };
        Insert: {
          id?: string;
          last_seen?: string;
          platform: string;
          profile_id: string;
          push_token: string;
        };
        Update: {
          id?: string;
          last_seen?: string;
          platform?: string;
          profile_id?: string;
          push_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devices_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          admin_note: string | null;
          created_at: string;
          details: string | null;
          id: string;
          job_id: string;
          photo_paths: string[];
          reason: string;
          reporter_id: string | null;
          resolution: Database["public"]["Enums"]["dispute_resolution"] | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["dispute_status"];
          strike_profile_id: string | null;
          to_requester: number | null;
          to_traveler: number | null;
          updated_at: string;
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          job_id: string;
          photo_paths?: string[];
          reason: string;
          reporter_id?: string | null;
          resolution?: Database["public"]["Enums"]["dispute_resolution"] | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          strike_profile_id?: string | null;
          to_requester?: number | null;
          to_traveler?: number | null;
          updated_at?: string;
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          job_id?: string;
          photo_paths?: string[];
          reason?: string;
          reporter_id?: string | null;
          resolution?: Database["public"]["Enums"]["dispute_resolution"] | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          strike_profile_id?: string | null;
          to_requester?: number | null;
          to_traveler?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_strike_profile_id_fkey";
            columns: ["strike_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_strike_profile_id_fkey";
            columns: ["strike_profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["job_status"] | null;
          id: number;
          job_id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["job_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["job_status"] | null;
          id?: never;
          job_id: string;
          note?: string | null;
          to_status: Database["public"]["Enums"]["job_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["job_status"] | null;
          id?: never;
          job_id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["job_status"];
        };
        Relationships: [
          {
            foreignKeyName: "job_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_handoff_codes: {
        Row: {
          code: string;
          created_at: string;
          job_id: string;
          requester_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          job_id: string;
          requester_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          job_id?: string;
          requester_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_handoff_codes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_handoff_codes_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_handoff_codes_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          advance_amount: number;
          campus_id: string;
          code_attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          receipt_amount: number | null;
          receipt_path: string | null;
          request_id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["job_status"];
          traveler_id: string;
          trip_id: string | null;
          updated_at: string;
        };
        Insert: {
          advance_amount?: number;
          campus_id: string;
          code_attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          receipt_amount?: number | null;
          receipt_path?: string | null;
          request_id: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["job_status"];
          traveler_id: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          advance_amount?: number;
          campus_id?: string;
          code_attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          receipt_amount?: number | null;
          receipt_path?: string | null;
          request_id?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          traveler_id?: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_accounts: {
        Row: {
          balance: number;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["ledger_account_kind"];
          profile_id: string | null;
          request_id: string | null;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["ledger_account_kind"];
          profile_id?: string | null;
          request_id?: string | null;
        };
        Update: {
          balance?: number;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["ledger_account_kind"];
          profile_id?: string | null;
          request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account_id: string;
          amount: number;
          created_at: string;
          direction: Database["public"]["Enums"]["ledger_direction"];
          id: number;
          job_id: string | null;
          reason: string;
          request_id: string | null;
          txn_id: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          created_at?: string;
          direction: Database["public"]["Enums"]["ledger_direction"];
          id?: never;
          job_id?: string | null;
          reason: string;
          request_id?: string | null;
          txn_id: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          created_at?: string;
          direction?: Database["public"]["Enums"]["ledger_direction"];
          id?: never;
          job_id?: string | null;
          reason?: string;
          request_id?: string | null;
          txn_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          created_at: string;
          decision: Database["public"]["Enums"]["substitute_decision"] | null;
          id: string;
          job_id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          photo_path: string | null;
          sender_id: string | null;
          substitute_amount: number | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          decision?: Database["public"]["Enums"]["substitute_decision"] | null;
          id?: string;
          job_id: string;
          kind?: Database["public"]["Enums"]["message_kind"];
          photo_path?: string | null;
          sender_id?: string | null;
          substitute_amount?: number | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          decision?: Database["public"]["Enums"]["substitute_decision"] | null;
          id?: string;
          job_id?: string;
          kind?: Database["public"]["Enums"]["message_kind"];
          photo_path?: string | null;
          sender_id?: string | null;
          substitute_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          email: boolean;
          id: string;
          kind: string;
          link: string | null;
          profile_id: string;
          pushed_at: string | null;
          read_at: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          email?: boolean;
          id?: string;
          kind: string;
          link?: string | null;
          profile_id: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          email?: boolean;
          id?: string;
          kind?: string;
          link?: string | null;
          profile_id?: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          method: string;
          paystack_reference: string;
          profile_id: string;
          raw_webhook: Json | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          method: string;
          paystack_reference: string;
          profile_id: string;
          raw_webhook?: Json | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          method?: string;
          paystack_reference?: string;
          profile_id?: string;
          raw_webhook?: Json | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payouts: {
        Row: {
          amount: number;
          bank_account_id: string;
          created_at: string;
          failure_reason: string | null;
          id: string;
          paystack_reference: string;
          paystack_transfer: string | null;
          profile_id: string;
          status: Database["public"]["Enums"]["payout_status"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          bank_account_id: string;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          paystack_reference: string;
          paystack_transfer?: string | null;
          profile_id: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          bank_account_id?: string;
          created_at?: string;
          failure_reason?: string | null;
          id?: string;
          paystack_reference?: string;
          paystack_transfer?: string | null;
          profile_id?: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_bank_account_id_fkey";
            columns: ["bank_account_id"];
            isOneToOne: false;
            referencedRelation: "bank_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      paystack_customers: {
        Row: {
          account_name: string | null;
          account_number: string | null;
          bank_name: string | null;
          created_at: string;
          customer_code: string;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          customer_code: string;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          customer_code?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paystack_customers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paystack_customers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      places: {
        Row: {
          active: boolean;
          campus_id: string;
          created_at: string;
          id: string;
          is_handoff_point: boolean;
          kind: Database["public"]["Enums"]["place_kind"];
          name: string;
          updated_at: string;
          zone: string;
        };
        Insert: {
          active?: boolean;
          campus_id: string;
          created_at?: string;
          id?: string;
          is_handoff_point?: boolean;
          kind: Database["public"]["Enums"]["place_kind"];
          name: string;
          updated_at?: string;
          zone: string;
        };
        Update: {
          active?: boolean;
          campus_id?: string;
          created_at?: string;
          id?: string;
          is_handoff_point?: boolean;
          kind?: Database["public"]["Enums"]["place_kind"];
          name?: string;
          updated_at?: string;
          zone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          campus_id: string;
          created_at: string;
          email: string;
          full_name: string;
          hostel: string | null;
          id: string;
          jobs_carried: number;
          jobs_requested: number;
          photo_path: string | null;
          rating_avg: number;
          rating_count: number;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          strikes: number;
          updated_at: string;
          women_only: boolean;
        };
        Insert: {
          campus_id: string;
          created_at?: string;
          email: string;
          full_name: string;
          hostel?: string | null;
          id: string;
          jobs_carried?: number;
          jobs_requested?: number;
          photo_path?: string | null;
          rating_avg?: number;
          rating_count?: number;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          strikes?: number;
          updated_at?: string;
          women_only?: boolean;
        };
        Update: {
          campus_id?: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          hostel?: string | null;
          id?: string;
          jobs_carried?: number;
          jobs_requested?: number;
          photo_path?: string | null;
          rating_avg?: number;
          rating_count?: number;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          strikes?: number;
          updated_at?: string;
          women_only?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
        ];
      };
      prohibited_keywords: {
        Row: {
          id: string;
          keyword: string;
        };
        Insert: {
          id?: string;
          keyword: string;
        };
        Update: {
          id?: string;
          keyword?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          job_id: string;
          rated_id: string;
          rater_id: string;
          stars: number;
          tags: string[];
          tip_amount: number;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          job_id: string;
          rated_id: string;
          rater_id: string;
          stars: number;
          tags?: string[];
          tip_amount?: number;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          rated_id?: string;
          rater_id?: string;
          stars?: number;
          tags?: string[];
          tip_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_rated_id_fkey";
            columns: ["rated_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_rated_id_fkey";
            columns: ["rated_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_rater_id_fkey";
            columns: ["rater_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_rater_id_fkey";
            columns: ["rater_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      requests: {
        Row: {
          campus_id: string;
          created_at: string;
          deadline: string;
          fee: number;
          flagged_keywords: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id: string;
          item_budget: number;
          items_text: string;
          photo_path: string | null;
          requester_id: string;
          status: Database["public"]["Enums"]["request_status"];
          target_trip_id: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at: string;
          urgent: boolean;
        };
        Insert: {
          campus_id: string;
          created_at?: string;
          deadline: string;
          fee: number;
          flagged_keywords?: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id?: string;
          item_budget?: number;
          items_text: string;
          photo_path?: string | null;
          requester_id: string;
          status?: Database["public"]["Enums"]["request_status"];
          target_trip_id?: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at?: string;
          urgent?: boolean;
        };
        Update: {
          campus_id?: string;
          created_at?: string;
          deadline?: string;
          fee?: number;
          flagged_keywords?: string[] | null;
          from_place_id?: string;
          handoff_place_id?: string;
          id?: string;
          item_budget?: number;
          items_text?: string;
          photo_path?: string | null;
          requester_id?: string;
          status?: Database["public"]["Enums"]["request_status"];
          target_trip_id?: string | null;
          type?: Database["public"]["Enums"]["request_type"];
          updated_at?: string;
          urgent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "requests_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_from_place_id_fkey";
            columns: ["from_place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_handoff_place_id_fkey";
            columns: ["handoff_place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_target_trip_id_fkey";
            columns: ["target_trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          back_by: string;
          campus_id: string;
          capacity: number;
          created_at: string;
          from_place_id: string;
          id: string;
          job_types: Database["public"]["Enums"]["request_type"][];
          leaves_at: string;
          note: string | null;
          slots_taken: number;
          status: Database["public"]["Enums"]["trip_status"];
          to_place_id: string;
          traveler_id: string;
          updated_at: string;
        };
        Insert: {
          back_by: string;
          campus_id: string;
          capacity: number;
          created_at?: string;
          from_place_id: string;
          id?: string;
          job_types?: Database["public"]["Enums"]["request_type"][];
          leaves_at: string;
          note?: string | null;
          slots_taken?: number;
          status?: Database["public"]["Enums"]["trip_status"];
          to_place_id: string;
          traveler_id: string;
          updated_at?: string;
        };
        Update: {
          back_by?: string;
          campus_id?: string;
          capacity?: number;
          created_at?: string;
          from_place_id?: string;
          id?: string;
          job_types?: Database["public"]["Enums"]["request_type"][];
          leaves_at?: string;
          note?: string | null;
          slots_taken?: number;
          status?: Database["public"]["Enums"]["trip_status"];
          to_place_id?: string;
          traveler_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_from_place_id_fkey";
            columns: ["from_place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_to_place_id_fkey";
            columns: ["to_place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_traveler_id_fkey";
            columns: ["traveler_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verifications: {
        Row: {
          campus_id: string;
          created_at: string;
          decided_at: string | null;
          hostel: string | null;
          id: string;
          id_photo_path: string;
          matric_number: string;
          photos_deleted_at: string | null;
          profile_id: string;
          reject_reason: string | null;
          reviewer_id: string | null;
          selfie_path: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
        };
        Insert: {
          campus_id: string;
          created_at?: string;
          decided_at?: string | null;
          hostel?: string | null;
          id?: string;
          id_photo_path: string;
          matric_number: string;
          photos_deleted_at?: string | null;
          profile_id: string;
          reject_reason?: string | null;
          reviewer_id?: string | null;
          selfie_path: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
        };
        Update: {
          campus_id?: string;
          created_at?: string;
          decided_at?: string | null;
          hostel?: string | null;
          id?: string;
          id_photo_path?: string;
          matric_number?: string;
          photos_deleted_at?: string | null;
          profile_id?: string;
          reject_reason?: string | null;
          reviewer_id?: string | null;
          selfie_path?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verifications_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          available: number;
          held: number;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          available?: number;
          held?: number;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          available?: number;
          held?: number;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallets_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          campus_id: string | null;
          created_at: string | null;
          first_name: string | null;
          hostel: string | null;
          id: string | null;
          jobs_carried: number | null;
          jobs_requested: number | null;
          last_initial: string | null;
          photo_path: string | null;
          rating_avg: number | null;
          rating_count: number | null;
          verified: boolean | null;
        };
        Insert: {
          campus_id?: string | null;
          created_at?: string | null;
          first_name?: never;
          hostel?: string | null;
          id?: string | null;
          jobs_carried?: number | null;
          jobs_requested?: number | null;
          last_initial?: never;
          photo_path?: string | null;
          rating_avg?: number | null;
          rating_count?: number | null;
          verified?: never;
        };
        Update: {
          campus_id?: string | null;
          created_at?: string | null;
          first_name?: never;
          hostel?: string | null;
          id?: string | null;
          jobs_carried?: number | null;
          jobs_requested?: number | null;
          last_initial?: never;
          photo_path?: string | null;
          rating_avg?: number | null;
          rating_count?: number | null;
          verified?: never;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_job: {
        Args: { p_request: string; p_trip?: string };
        Returns: {
          advance_amount: number;
          campus_id: string;
          code_attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          receipt_amount: number | null;
          receipt_path: string | null;
          request_id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["job_status"];
          traveler_id: string;
          trip_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_ledger_health: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_metrics: { Args: { p_days?: number }; Returns: Json };
      admin_review_request: {
        Args: { p_approve: boolean; p_note?: string; p_request: string };
        Returns: {
          campus_id: string;
          created_at: string;
          deadline: string;
          fee: number;
          flagged_keywords: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id: string;
          item_budget: number;
          items_text: string;
          photo_path: string | null;
          requester_id: string;
          status: Database["public"]["Enums"]["request_status"];
          target_trip_id: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at: string;
          urgent: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_set_profile_status: {
        Args: {
          p_note: string;
          p_profile: string;
          p_status: Database["public"]["Enums"]["profile_status"];
        };
        Returns: {
          campus_id: string;
          created_at: string;
          email: string;
          full_name: string;
          hostel: string | null;
          id: string;
          jobs_carried: number;
          jobs_requested: number;
          photo_path: string | null;
          rating_avg: number;
          rating_count: number;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          strikes: number;
          updated_at: string;
          women_only: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_update_campus: {
        Args: { p_curfew: string; p_item_cap_new: number; p_item_cap_trusted: number };
        Returns: {
          active: boolean;
          created_at: string;
          handoff_curfew: string;
          id: string;
          item_cap_new: number;
          item_cap_trusted: number;
          name: string;
          short_name: string;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "campuses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_request: {
        Args: { p_request: string };
        Returns: {
          campus_id: string;
          created_at: string;
          deadline: string;
          fee: number;
          flagged_keywords: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id: string;
          item_budget: number;
          items_text: string;
          photo_path: string | null;
          requester_id: string;
          status: Database["public"]["Enums"]["request_status"];
          target_trip_id: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at: string;
          urgent: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_trip: {
        Args: { p_trip: string };
        Returns: {
          back_by: string;
          campus_id: string;
          capacity: number;
          created_at: string;
          from_place_id: string;
          id: string;
          job_types: Database["public"]["Enums"]["request_type"][];
          leaves_at: string;
          note: string | null;
          slots_taken: number;
          status: Database["public"]["Enums"]["trip_status"];
          to_place_id: string;
          traveler_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_purchase: {
        Args: { p_job: string; p_receipt_amount: number; p_receipt_path: string };
        Returns: {
          advance_amount: number;
          campus_id: string;
          code_attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          receipt_amount: number | null;
          receipt_path: string | null;
          request_id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["job_status"];
          traveler_id: string;
          trip_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_request: {
        Args: {
          p_deadline: string;
          p_fee?: number;
          p_from_place: string;
          p_handoff_place: string;
          p_item_budget?: number;
          p_items_text: string;
          p_photo_path?: string;
          p_trip?: string;
          p_type: Database["public"]["Enums"]["request_type"];
          p_urgent?: boolean;
        };
        Returns: {
          campus_id: string;
          created_at: string;
          deadline: string;
          fee: number;
          flagged_keywords: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id: string;
          item_budget: number;
          items_text: string;
          photo_path: string | null;
          requester_id: string;
          status: Database["public"]["Enums"]["request_status"];
          target_trip_id: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at: string;
          urgent: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_trip: {
        Args: {
          p_back_by: string;
          p_capacity: number;
          p_from_place: string;
          p_job_types?: Database["public"]["Enums"]["request_type"][];
          p_leaves_at: string;
          p_note?: string;
          p_to_place: string;
        };
        Returns: {
          back_by: string;
          campus_id: string;
          capacity: number;
          created_at: string;
          from_place_id: string;
          id: string;
          job_types: Database["public"]["Enums"]["request_type"][];
          leaves_at: string;
          note: string | null;
          slots_taken: number;
          status: Database["public"]["Enums"]["trip_status"];
          to_place_id: string;
          traveler_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      my_campus: { Args: Record<PropertyKey, never>; Returns: string };
      open_dispute: {
        Args: { p_details?: string; p_job: string; p_photo_paths?: string[]; p_reason: string };
        Returns: {
          admin_note: string | null;
          created_at: string;
          details: string | null;
          id: string;
          job_id: string;
          photo_paths: string[];
          reason: string;
          reporter_id: string | null;
          resolution: Database["public"]["Enums"]["dispute_resolution"] | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["dispute_status"];
          strike_profile_id: string | null;
          to_requester: number | null;
          to_traveler: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      propose_substitute: {
        Args: { p_body: string; p_job: string; p_new_amount: number; p_photo_path?: string };
        Returns: {
          body: string | null;
          created_at: string;
          decision: Database["public"]["Enums"]["substitute_decision"] | null;
          id: string;
          job_id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          photo_path: string | null;
          sender_id: string | null;
          substitute_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      quote_request: {
        Args: {
          p_from_place: string;
          p_handoff_place: string;
          p_item_budget?: number;
          p_type: Database["public"]["Enums"]["request_type"];
          p_urgent?: boolean;
        };
        Returns: Json;
      };
      rate_job: {
        Args: {
          p_comment?: string;
          p_job: string;
          p_stars: number;
          p_tags?: string[];
          p_tip?: number;
        };
        Returns: {
          comment: string | null;
          created_at: string;
          id: string;
          job_id: string;
          rated_id: string;
          rater_id: string;
          stars: number;
          tags: string[];
          tip_amount: number;
        };
        SetofOptions: {
          from: "*";
          to: "ratings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_device: { Args: { p_platform: string; p_token: string }; Returns: undefined };
      release_job: {
        Args: { p_job: string };
        Returns: {
          campus_id: string;
          created_at: string;
          deadline: string;
          fee: number;
          flagged_keywords: string[] | null;
          from_place_id: string;
          handoff_place_id: string;
          id: string;
          item_budget: number;
          items_text: string;
          photo_path: string | null;
          requester_id: string;
          status: Database["public"]["Enums"]["request_status"];
          target_trip_id: string | null;
          type: Database["public"]["Enums"]["request_type"];
          updated_at: string;
          urgent: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_withdrawal: { Args: { p_amount: number }; Returns: Json };
      resolve_dispute: {
        Args: {
          p_clawback?: number;
          p_dispute: string;
          p_note?: string;
          p_resolution: Database["public"]["Enums"]["dispute_resolution"];
          p_strike?: string;
          p_to_requester?: number;
        };
        Returns: {
          admin_note: string | null;
          created_at: string;
          details: string | null;
          id: string;
          job_id: string;
          photo_paths: string[];
          reason: string;
          reporter_id: string | null;
          resolution: Database["public"]["Enums"]["dispute_resolution"] | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["dispute_status"];
          strike_profile_id: string | null;
          to_requester: number | null;
          to_traveler: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      respond_substitute: {
        Args: { p_approve: boolean; p_message: string };
        Returns: {
          body: string | null;
          created_at: string;
          decision: Database["public"]["Enums"]["substitute_decision"] | null;
          id: string;
          job_id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          photo_path: string | null;
          sender_id: string | null;
          substitute_amount: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_verification: {
        Args: { p_approve: boolean; p_reason?: string; p_verification: string };
        Returns: {
          campus_id: string;
          created_at: string;
          decided_at: string | null;
          hostel: string | null;
          id: string;
          id_photo_path: string;
          matric_number: string;
          photos_deleted_at: string | null;
          profile_id: string;
          reject_reason: string | null;
          reviewer_id: string | null;
          selfie_path: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_delivery: {
        Args: { p_job: string };
        Returns: {
          advance_amount: number;
          campus_id: string;
          code_attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          receipt_amount: number | null;
          receipt_path: string | null;
          request_id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["job_status"];
          traveler_id: string;
          trip_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_handoff_code: { Args: { p_code: string; p_job: string }; Returns: Json };
      submit_verification: {
        Args: {
          p_hostel: string;
          p_id_photo_path: string;
          p_matric: string;
          p_selfie_path: string;
        };
        Returns: {
          campus_id: string;
          created_at: string;
          decided_at: string | null;
          hostel: string | null;
          id: string;
          id_photo_path: string;
          matric_number: string;
          photos_deleted_at: string | null;
          profile_id: string;
          reject_reason: string | null;
          reviewer_id: string | null;
          selfie_path: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      svc_confirm_payment: {
        Args: {
          p_amount: number;
          p_method: string;
          p_profile: string;
          p_raw: Json;
          p_reference: string;
        };
        Returns: {
          amount: number;
          created_at: string;
          id: string;
          method: string;
          paystack_reference: string;
          profile_id: string;
          raw_webhook: Json | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      svc_create_payment: {
        Args: { p_amount: number; p_method: string; p_profile: string; p_reference: string };
        Returns: {
          amount: number;
          created_at: string;
          id: string;
          method: string;
          paystack_reference: string;
          profile_id: string;
          raw_webhook: Json | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      svc_fail_payment: { Args: { p_raw: Json; p_reference: string }; Returns: undefined };
      svc_profile_for_customer: { Args: { p_customer_code: string }; Returns: string };
      svc_save_bank_account: {
        Args: {
          p_bank_code: string;
          p_bank_name: string;
          p_last4: string;
          p_profile: string;
          p_recipient: string;
          p_resolved_name: string;
        };
        Returns: {
          account_last4: string;
          active: boolean;
          bank_code: string;
          bank_name: string;
          created_at: string;
          id: string;
          paystack_recipient: string;
          profile_id: string;
          resolved_name: string;
        };
        SetofOptions: {
          from: "*";
          to: "bank_accounts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      svc_save_paystack_customer: {
        Args: {
          p_account_name: string;
          p_account_number: string;
          p_bank_name: string;
          p_customer_code: string;
          p_profile: string;
        };
        Returns: {
          account_name: string | null;
          account_number: string | null;
          bank_name: string | null;
          created_at: string;
          customer_code: string;
          profile_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "paystack_customers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      svc_settle_payout: {
        Args: {
          p_reason?: string;
          p_reference: string;
          p_success: boolean;
          p_transfer_code?: string;
        };
        Returns: {
          amount: number;
          bank_account_id: string;
          created_at: string;
          failure_reason: string | null;
          id: string;
          paystack_reference: string;
          paystack_transfer: string | null;
          profile_id: string;
          status: Database["public"]["Enums"]["payout_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unregister_device: { Args: { p_token: string }; Returns: undefined };
    };
    Enums: {
      dispute_resolution: "refund" | "release" | "split";
      dispute_status: "open" | "resolved";
      job_status:
        | "accepted"
        | "purchased"
        | "in_transit"
        | "completed"
        | "disputed"
        | "refunded"
        | "cancelled";
      ledger_account_kind:
        | "user_available"
        | "job_escrow"
        | "platform_revenue"
        | "gateway_clearing"
        | "payouts_in_transit";
      ledger_direction: "debit" | "credit";
      message_kind: "text" | "photo" | "substitute" | "system";
      payment_status: "pending" | "success" | "failed";
      payout_status: "pending" | "success" | "failed" | "reversed";
      place_kind: "market" | "gate" | "hostel" | "faculty" | "office" | "other";
      profile_status: "pending" | "verified" | "suspended";
      request_status: "review" | "posted" | "accepted" | "completed" | "cancelled" | "expired";
      request_type: "buy" | "pick_up" | "drop_off";
      substitute_decision: "pending" | "approved" | "declined";
      trip_status: "live" | "full" | "done" | "cancelled";
      user_role: "student" | "admin";
      verification_status: "submitted" | "approved" | "rejected";
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      dispute_resolution: ["refund", "release", "split"],
      dispute_status: ["open", "resolved"],
      job_status: [
        "accepted",
        "purchased",
        "in_transit",
        "completed",
        "disputed",
        "refunded",
        "cancelled",
      ],
      ledger_account_kind: [
        "user_available",
        "job_escrow",
        "platform_revenue",
        "gateway_clearing",
        "payouts_in_transit",
      ],
      ledger_direction: ["debit", "credit"],
      message_kind: ["text", "photo", "substitute", "system"],
      payment_status: ["pending", "success", "failed"],
      payout_status: ["pending", "success", "failed", "reversed"],
      place_kind: ["market", "gate", "hostel", "faculty", "office", "other"],
      profile_status: ["pending", "verified", "suspended"],
      request_status: ["review", "posted", "accepted", "completed", "cancelled", "expired"],
      request_type: ["buy", "pick_up", "drop_off"],
      substitute_decision: ["pending", "approved", "declined"],
      trip_status: ["live", "full", "done", "cancelled"],
      user_role: ["student", "admin"],
      verification_status: ["submitted", "approved", "rejected"],
    },
  },
} as const;
