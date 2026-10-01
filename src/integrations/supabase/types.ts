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
      account_security_settings: {
        Row: {
          address_whitelisting_enabled: boolean
          anti_phishing_code_hash: string | null
          anti_phishing_code_hint: string | null
          created_at: string
          login_password_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_whitelisting_enabled?: boolean
          anti_phishing_code_hash?: string | null
          anti_phishing_code_hint?: string | null
          created_at?: string
          login_password_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_whitelisting_enabled?: boolean
          anti_phishing_code_hash?: string | null
          anti_phishing_code_hint?: string | null
          created_at?: string
          login_password_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          delivered_at: string | null
          id: string
          is_internal: boolean
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
          delivered_at?: string | null
          id?: string
          is_internal?: boolean
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
          delivered_at?: string | null
          id?: string
          is_internal?: boolean
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
          bot_context: Json | null
          connected_at: string | null
          created_at: string
          department: string
          escalated_at: string | null
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
          bot_context?: Json | null
          connected_at?: string | null
          created_at?: string
          department?: string
          escalated_at?: string | null
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
          bot_context?: Json | null
          connected_at?: string | null
          created_at?: string
          department?: string
          escalated_at?: string | null
          id?: string
          last_message_at?: string
          status?: string
          subject?: string | null
          user_id?: string
          user_last_read_at?: string
        }
        Relationships: []
      }
      community_announcements: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_channels: {
        Row: {
          action_label: string
          channel_key: string
          created_at: string
          description: string
          display_name: string
          id: string
          invite_url: string | null
          member_count: number
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
          vip_only: boolean
        }
        Insert: {
          action_label: string
          channel_key: string
          created_at?: string
          description: string
          display_name: string
          id?: string
          invite_url?: string | null
          member_count?: number
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          vip_only?: boolean
        }
        Update: {
          action_label?: string
          channel_key?: string
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          invite_url?: string | null
          member_count?: number
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          vip_only?: boolean
        }
        Relationships: []
      }
      community_vip_requests: {
        Row: {
          created_at: string
          id: string
          request_note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
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
          fee_paid: number
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
          fee_paid?: number
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
          fee_paid?: number
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
          kyc_level_1_status: string
          kyc_level_2_status: string
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
          kyc_level_1_status?: string
          kyc_level_2_status?: string
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
          kyc_level_1_status?: string
          kyc_level_2_status?: string
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
          fees_paid: number
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
          fees_paid?: number
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
          fees_paid?: number
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
          account_frozen: boolean
          avatar_url: string | null
          base_currency: string
          created_at: string
          credit_score: number
          display_name: string
          display_name_updated_at: string | null
          email: string | null
          id: string
          margin_restricted: boolean
          outcome_mode: Database["public"]["Enums"]["outcome_mode"]
          preferences: Json
          referral_code: string | null
          referral_rewards_usdt: number
          referred_by: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspended_until: string | null
          suspension_note: string | null
          suspension_reason: string | null
          suspension_status: string
          trader_trust_score: number
          trading_frozen: boolean
          trust_score_override: number | null
          trust_score_updated_at: string | null
          uid: string | null
          verification_required: boolean
          vip_tier: string
          vip_upgraded_at: string | null
          withdrawal_password_hash: string | null
          withdrawal_password_updated_at: string | null
          withdrawals_disabled: boolean
        }
        Insert: {
          account_frozen?: boolean
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          credit_score?: number
          display_name?: string
          display_name_updated_at?: string | null
          email?: string | null
          id: string
          margin_restricted?: boolean
          outcome_mode?: Database["public"]["Enums"]["outcome_mode"]
          preferences?: Json
          referral_code?: string | null
          referral_rewards_usdt?: number
          referred_by?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_note?: string | null
          suspension_reason?: string | null
          suspension_status?: string
          trader_trust_score?: number
          trading_frozen?: boolean
          trust_score_override?: number | null
          trust_score_updated_at?: string | null
          uid?: string | null
          verification_required?: boolean
          vip_tier?: string
          vip_upgraded_at?: string | null
          withdrawal_password_hash?: string | null
          withdrawal_password_updated_at?: string | null
          withdrawals_disabled?: boolean
        }
        Update: {
          account_frozen?: boolean
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          credit_score?: number
          display_name?: string
          display_name_updated_at?: string | null
          email?: string | null
          id?: string
          margin_restricted?: boolean
          outcome_mode?: Database["public"]["Enums"]["outcome_mode"]
          preferences?: Json
          referral_code?: string | null
          referral_rewards_usdt?: number
          referred_by?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_note?: string | null
          suspension_reason?: string | null
          suspension_status?: string
          trader_trust_score?: number
          trading_frozen?: boolean
          trust_score_override?: number | null
          trust_score_updated_at?: string | null
          uid?: string | null
          verification_required?: boolean
          vip_tier?: string
          vip_upgraded_at?: string | null
          withdrawal_password_hash?: string | null
          withdrawal_password_updated_at?: string | null
          withdrawals_disabled?: boolean
        }
        Relationships: []
      }
      referrals: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          referee_id: string
          referral_code: string | null
          referrer_id: string
          reviewed_by: string | null
          reward_amount: number
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          referee_id: string
          referral_code?: string | null
          referrer_id: string
          reviewed_by?: string | null
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          referee_id?: string
          referral_code?: string | null
          referrer_id?: string
          reviewed_by?: string | null
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      session_replays: {
        Row: {
          chunk_index: number
          created_at: string
          device_id: string | null
          event_count: number
          events: Json
          id: string
          route: string | null
          session_key: string
          started_at: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          created_at?: string
          device_id?: string | null
          event_count?: number
          events?: Json
          id?: string
          route?: string | null
          session_key: string
          started_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string
          device_id?: string | null
          event_count?: number
          events?: Json
          id?: string
          route?: string | null
          session_key?: string
          started_at?: string
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
      trade_executions: {
        Row: {
          ack_latency_ms: number | null
          acknowledged_at: string | null
          created_at: string
          fill_latency_ms: number | null
          filled_at: string | null
          filled_qty: number
          id: string
          ref_id: string | null
          ref_type: string
          requested_qty: number
          side: string | null
          status: string
          submitted_at: string
          symbol: string
          user_id: string
        }
        Insert: {
          ack_latency_ms?: number | null
          acknowledged_at?: string | null
          created_at?: string
          fill_latency_ms?: number | null
          filled_at?: string | null
          filled_qty?: number
          id?: string
          ref_id?: string | null
          ref_type: string
          requested_qty?: number
          side?: string | null
          status?: string
          submitted_at?: string
          symbol: string
          user_id: string
        }
        Update: {
          ack_latency_ms?: number | null
          acknowledged_at?: string | null
          created_at?: string
          fill_latency_ms?: number | null
          filled_at?: string | null
          filled_qty?: number
          id?: string
          ref_id?: string | null
          ref_type?: string
          requested_qty?: number
          side?: string | null
          status?: string
          submitted_at?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      two_factor_sessions: {
        Row: {
          id: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action_type: string
          city: string | null
          country: string | null
          created_at: string
          device_id: string | null
          dom_events_json: Json
          id: string
          ip_address: string | null
          label: string | null
          metadata_json: Json
          route: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          dom_events_json?: Json
          id?: string
          ip_address?: string | null
          label?: string | null
          metadata_json?: Json
          route?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          dom_events_json?: Json
          id?: string
          ip_address?: string | null
          label?: string | null
          metadata_json?: Json
          route?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fee_overrides: {
        Row: {
          futures_maker: number | null
          futures_taker: number | null
          note: string | null
          scalp_maker: number | null
          scalp_taker: number | null
          spot_maker: number | null
          spot_taker: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          futures_maker?: number | null
          futures_taker?: number | null
          note?: string | null
          scalp_maker?: number | null
          scalp_taker?: number | null
          spot_maker?: number | null
          spot_taker?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          futures_maker?: number | null
          futures_taker?: number | null
          note?: string | null
          scalp_maker?: number | null
          scalp_taker?: number | null
          spot_maker?: number | null
          spot_taker?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
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
      user_security: {
        Row: {
          created_at: string
          failed_attempts: number
          last_totp_step: number | null
          locked_until: string | null
          pending_totp_secret: string | null
          totp_secret: string | null
          two_factor_enabled: boolean
          two_factor_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          last_totp_step?: number | null
          locked_until?: string | null
          pending_totp_secret?: string | null
          totp_secret?: string | null
          two_factor_enabled?: boolean
          two_factor_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          last_totp_step?: number | null
          locked_until?: string | null
          pending_totp_secret?: string | null
          totp_secret?: string | null
          two_factor_enabled?: boolean
          two_factor_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          asn: string | null
          browser: string
          browser_version: string | null
          city: string | null
          country: string | null
          created_at: string
          current_path: string | null
          device_id: string
          device_model: string | null
          device_type: string | null
          device_vendor: string | null
          id: string
          ip_address: string | null
          is_online: boolean
          isp: string | null
          last_active_at: string
          latitude: number | null
          longitude: number | null
          os: string
          os_version: string | null
          region: string | null
          screen_resolution: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          asn?: string | null
          browser?: string
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_path?: string | null
          device_id: string
          device_model?: string | null
          device_type?: string | null
          device_vendor?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean
          isp?: string | null
          last_active_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string
          os_version?: string | null
          region?: string | null
          screen_resolution?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          asn?: string | null
          browser?: string
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_path?: string | null
          device_id?: string
          device_model?: string | null
          device_type?: string | null
          device_vendor?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean
          isp?: string | null
          last_active_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string
          os_version?: string | null
          region?: string | null
          screen_resolution?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_withdrawal_limits: {
        Row: {
          daily_limit_usdt: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          daily_limit_usdt: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          daily_limit_usdt?: number
          updated_at?: string
          updated_by?: string | null
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
      vip_accounts: {
        Row: {
          account_manager_email: string | null
          account_manager_name: string | null
          evaluated_at: string | null
          futures_volume_30d: number
          grace_until: string | null
          level: number
          portfolio_usdt: number
          recommended_level: number | null
          scalp_volume_30d: number
          spot_volume_30d: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          evaluated_at?: string | null
          futures_volume_30d?: number
          grace_until?: string | null
          level?: number
          portfolio_usdt?: number
          recommended_level?: number | null
          scalp_volume_30d?: number
          spot_volume_30d?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          evaluated_at?: string | null
          futures_volume_30d?: number
          grace_until?: string | null
          level?: number
          portfolio_usdt?: number
          recommended_level?: number | null
          scalp_volume_30d?: number
          spot_volume_30d?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_fee_tiers: {
        Row: {
          futures_maker: number
          futures_taker: number
          level: number
          min_futures_volume: number
          min_portfolio_usdt: number
          min_scalp_volume: number
          min_spot_volume: number
          name: string
          scalp_maker: number
          scalp_taker: number
          spot_maker: number
          spot_taker: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          futures_maker?: number
          futures_taker?: number
          level: number
          min_futures_volume?: number
          min_portfolio_usdt?: number
          min_scalp_volume?: number
          min_spot_volume?: number
          name: string
          scalp_maker?: number
          scalp_taker?: number
          spot_maker?: number
          spot_taker?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          futures_maker?: number
          futures_taker?: number
          level?: number
          min_futures_volume?: number
          min_portfolio_usdt?: number
          min_scalp_volume?: number
          min_spot_volume?: number
          name?: string
          scalp_maker?: number
          scalp_taker?: number
          spot_maker?: number
          spot_taker?: number
          updated_at?: string
          updated_by?: string | null
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
      purge_old_session_replays: { Args: never; Returns: number }
      review_withdrawal_atomic: {
        Args: {
          p_id: string
          p_note: string
          p_reviewer: string
          p_status: string
        }
        Returns: Json
      }
      set_withdrawal_password: {
        Args: { p_password_hash: string; p_user_id: string }
        Returns: Json
      }
      settle_contract_atomic: {
        Args: {
          p_exit: number
          p_id: string
          p_payout: number
          p_result: string
          p_user: string
        }
        Returns: Json
      }
      settle_deposit_atomic: {
        Args: {
          p_id: string
          p_note: string
          p_reviewer: string
          p_status: string
        }
        Returns: Json
      }
      verify_cron_token: {
        Args: { p_name: string; p_token: string }
        Returns: boolean
      }
      verify_withdrawal_password: {
        Args: { p_provided_hash: string; p_user_id: string }
        Returns: boolean
      }
      wallet_adjust: {
        Args: { p_currency: string; p_delta: number; p_user: string }
        Returns: number
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
