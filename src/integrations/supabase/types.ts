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
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_user_notes: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          agent_role: string
          avatar_url: string | null
          created_at: string
          full_name: string
          staff_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_role?: string
          avatar_url?: string | null
          created_at?: string
          full_name: string
          staff_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_role?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          staff_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          severity: string
          target_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          target_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          target_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          badge_key: string
          badge_url: string | null
          category: string
          created_at: string
          document_url: string | null
          expiry_date: string | null
          id: string
          is_active: boolean
          issue_date: string | null
          issuer: string
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          badge_key?: string
          badge_url?: string | null
          category?: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issue_date?: string | null
          issuer?: string
          sort_order?: number
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          badge_key?: string
          badge_url?: string | null
          category?: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issue_date?: string | null
          issuer?: string
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
          session_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role?: string
          session_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_ratings: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          agent_role: string | null
          created_at: string
          feedback: string | null
          id: string
          session_id: string | null
          stars: number
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          agent_role?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          session_id?: string | null
          stars: number
          user_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          agent_role?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          session_id?: string | null
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          active_agent_id: string | null
          agent_last_read_at: string
          created_at: string
          id: string
          last_message_at: string
          status: string
          subject: string | null
          user_id: string
          user_last_read_at: string
        }
        Insert: {
          active_agent_id?: string | null
          agent_last_read_at?: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          subject?: string | null
          user_id: string
          user_last_read_at?: string
        }
        Update: {
          active_agent_id?: string | null
          agent_last_read_at?: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          subject?: string | null
          user_id?: string
          user_last_read_at?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          analytics: boolean
          anon_id: string | null
          created_at: string
          essential: boolean
          functional: boolean
          id: string
          marketing: boolean
          policy_version: string
          source: string
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          marketing?: boolean
          policy_version?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          marketing?: boolean
          policy_version?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          currency: string
          direction: string
          display_symbol: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          opened_at: string
          outcome_override: Database["public"]["Enums"]["outcome_mode"]
          payout: number | null
          payout_pct: number
          result: string | null
          settled_at: string | null
          stake: number
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          currency?: string
          direction: string
          display_symbol: string
          duration_seconds: number
          entry_price: number
          exit_price?: number | null
          expires_at: string
          id?: string
          opened_at?: string
          outcome_override?: Database["public"]["Enums"]["outcome_mode"]
          payout?: number | null
          payout_pct: number
          result?: string | null
          settled_at?: string | null
          stake: number
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          currency?: string
          direction?: string
          display_symbol?: string
          duration_seconds?: number
          entry_price?: number
          exit_price?: number | null
          expires_at?: string
          id?: string
          opened_at?: string
          outcome_override?: Database["public"]["Enums"]["outcome_mode"]
          payout?: number | null
          payout_pct?: number
          result?: string | null
          settled_at?: string | null
          stake?: number
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_addresses: {
        Row: {
          active: boolean
          address: string
          coin: string
          created_at: string
          id: string
          memo: string | null
          network: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          coin: string
          created_at?: string
          id?: string
          memo?: string | null
          network: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          coin?: string
          created_at?: string
          id?: string
          memo?: string | null
          network?: string
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount: number
          coin: string
          created_at: string
          id: string
          network: string
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          coin: string
          created_at?: string
          id?: string
          network: string
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          coin?: string
          created_at?: string
          id?: string
          network?: string
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          address: string | null
          admin_note: string | null
          country: string
          created_at: string
          date_of_birth: string | null
          document_expires_at: string | null
          document_number: string | null
          document_path: string | null
          document_type: string
          full_name: string
          id: string
          level2_admin_note: string | null
          level2_proof_path: string | null
          level2_proof_type: string | null
          level2_reviewed_at: string | null
          level2_reviewed_by: string | null
          level2_selfie_path: string | null
          level2_status: string
          level2_submitted_at: string | null
          level2_tax_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_note?: string | null
          country: string
          created_at?: string
          date_of_birth?: string | null
          document_expires_at?: string | null
          document_number?: string | null
          document_path?: string | null
          document_type: string
          full_name: string
          id?: string
          level2_admin_note?: string | null
          level2_proof_path?: string | null
          level2_proof_type?: string | null
          level2_reviewed_at?: string | null
          level2_reviewed_by?: string | null
          level2_selfie_path?: string | null
          level2_status?: string
          level2_submitted_at?: string | null
          level2_tax_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_note?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          document_expires_at?: string | null
          document_number?: string | null
          document_path?: string | null
          document_type?: string
          full_name?: string
          id?: string
          level2_admin_note?: string | null
          level2_proof_path?: string | null
          level2_proof_type?: string | null
          level2_reviewed_at?: string | null
          level2_reviewed_by?: string | null
          level2_selfie_path?: string | null
          level2_status?: string
          level2_submitted_at?: string | null
          level2_tax_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
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
      positions: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          closed_at: string | null
          currency: string
          display_symbol: string
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          opened_at: string
          quantity: number
          realized_pnl: number | null
          side: Database["public"]["Enums"]["trade_side"]
          status: Database["public"]["Enums"]["position_status"]
          symbol: string
          user_id: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          closed_at?: string | null
          currency?: string
          display_symbol: string
          entry_price: number
          exit_price?: number | null
          id?: string
          leverage?: number
          opened_at?: string
          quantity: number
          realized_pnl?: number | null
          side: Database["public"]["Enums"]["trade_side"]
          status?: Database["public"]["Enums"]["position_status"]
          symbol: string
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          closed_at?: string | null
          currency?: string
          display_symbol?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          leverage?: number
          opened_at?: string
          quantity?: number
          realized_pnl?: number | null
          side?: Database["public"]["Enums"]["trade_side"]
          status?: Database["public"]["Enums"]["position_status"]
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_currency: string
          created_at: string
          credit_score: number
          display_name: string
          display_name_updated_at: string | null
          email: string | null
          id: string
          outcome_mode: Database["public"]["Enums"]["outcome_mode"]
          preferences: Json
          referral_code: string | null
          referral_rewards_usdt: number
          referred_by: string | null
          trading_frozen: boolean
          uid: string | null
          withdrawal_password_hash: string | null
          withdrawal_password_updated_at: string | null
          withdrawals_disabled: boolean
        }
        Insert: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          credit_score?: number
          display_name?: string
          display_name_updated_at?: string | null
          email?: string | null
          id: string
          outcome_mode?: Database["public"]["Enums"]["outcome_mode"]
          preferences?: Json
          referral_code?: string | null
          referral_rewards_usdt?: number
          referred_by?: string | null
          trading_frozen?: boolean
          uid?: string | null
          withdrawal_password_hash?: string | null
          withdrawal_password_updated_at?: string | null
          withdrawals_disabled?: boolean
        }
        Update: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          credit_score?: number
          display_name?: string
          display_name_updated_at?: string | null
          email?: string | null
          id?: string
          outcome_mode?: Database["public"]["Enums"]["outcome_mode"]
          preferences?: Json
          referral_code?: string | null
          referral_rewards_usdt?: number
          referred_by?: string | null
          trading_frozen?: boolean
          uid?: string | null
          withdrawal_password_hash?: string | null
          withdrawal_password_updated_at?: string | null
          withdrawals_disabled?: boolean
        }
        Relationships: []
      }
      security_reports: {
        Row: {
          admin_note: string | null
          attachment_name: string | null
          attachment_path: string | null
          category: string
          created_at: string
          description: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          sender_id: string
          sender_role?: string
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_last_read_at: string
          assigned_agent_id: string | null
          body: string | null
          category: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          internal_notes: string | null
          last_response_at: string | null
          priority: string
          reference: string | null
          resolution_note: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_last_read_at?: string
          assigned_agent_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          last_response_at?: string | null
          priority?: string
          reference?: string | null
          resolution_note?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_last_read_at?: string
          assigned_agent_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          last_response_at?: string | null
          priority?: string
          reference?: string | null
          resolution_note?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      swaps: {
        Row: {
          created_at: string
          from_amount: number
          from_currency: string
          id: string
          rate: number
          to_amount: number
          to_currency: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_amount: number
          from_currency: string
          id?: string
          rate: number
          to_amount: number
          to_currency: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_amount?: number
          from_currency?: string
          id?: string
          rate?: number
          to_amount?: number
          to_currency?: string
          user_id?: string
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
      user_sessions: {
        Row: {
          browser: string
          country: string | null
          created_at: string
          current_path: string | null
          device_id: string
          id: string
          ip_address: string | null
          last_active_at: string
          os: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string
          country?: string | null
          created_at?: string
          current_path?: string | null
          device_id: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string
          country?: string | null
          created_at?: string
          current_path?: string | null
          device_id?: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vip_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role_key: string
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_key: string
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role_key?: string
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          created_at: string
          id: string
          read_at: string | null
          role_key: string
          sender_id: string | null
          sender_role: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          role_key: string
          sender_id?: string | null
          sender_role: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          role_key?: string
          sender_id?: string | null
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_specialists: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          role_key: string
          role_label: string
          staff_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          role_key: string
          role_label: string
          staff_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role_key?: string
          role_label?: string
          staff_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          currency: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          coin: string
          created_at: string
          destination_address: string
          id: string
          network: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          coin: string
          created_at?: string
          destination_address: string
          id?: string
          network: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          coin?: string
          created_at?: string
          destination_address?: string
          id?: string
          network?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
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
      generate_uid7: { Args: never; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      set_withdrawal_password: {
        Args: { p_password_hash: string; p_user_id: string }
        Returns: Json
      }
      verify_withdrawal_password: {
        Args: { p_provided_hash: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "user" | "finance"
      asset_class: "crypto" | "stock" | "future" | "forex" | "metal"
      outcome_mode: "normal" | "force_win" | "force_loss"
      position_status: "open" | "closed"
      request_status: "pending" | "approved" | "rejected"
      trade_side: "long" | "short"
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
      app_role: ["admin", "agent", "user", "finance"],
      asset_class: ["crypto", "stock", "future", "forex", "metal"],
      outcome_mode: ["normal", "force_win", "force_loss"],
      position_status: ["open", "closed"],
      request_status: ["pending", "approved", "rejected"],
      trade_side: ["long", "short"],
    },
  },
} as const
