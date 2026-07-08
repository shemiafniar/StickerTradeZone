export type TradeStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";
export type TradeItemDirection = "give" | "receive";
export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended";

export type Profile = {
  id: string;
  full_name: string;
  city: string;
  neighborhood: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type ProfileContact = {
  user_id: string;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  updated_at: string;
};

export type Sticker = {
  id: string;
  number: number;
  name: string | null;
  team: string | null;
  created_at: string;
};

export type AppSettings = {
  id: true;
  set_name: string;
  total_stickers: number;
  updated_at: string;
};

export type UserDuplicate = {
  id: string;
  user_id: string;
  sticker_id: string;
  quantity: number;
  for_sale: boolean;
  note: string | null;
  created_at: string;
};

export type UserMissing = {
  id: string;
  user_id: string;
  sticker_id: string;
  created_at: string;
};

export type TradeRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: TradeStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export type TradeRequestItem = {
  id: string;
  trade_request_id: string;
  sticker_id: string;
  direction: TradeItemDirection;
  quantity: number;
  created_at: string;
};

export type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      profile_contacts: {
        Row: ProfileContact;
        Insert: Partial<ProfileContact> & { user_id: string };
        Update: Partial<ProfileContact>;
        Relationships: [];
      };
      stickers: {
        Row: Sticker;
        Insert: Partial<Sticker> & { number: number };
        Update: Partial<Sticker>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettings;
        Insert: Partial<AppSettings>;
        Update: Partial<AppSettings>;
        Relationships: [];
      };
      user_duplicates: {
        Row: UserDuplicate;
        Insert: Partial<UserDuplicate> & { user_id: string; sticker_id: string };
        Update: Partial<UserDuplicate>;
        Relationships: [];
      };
      user_missing: {
        Row: UserMissing;
        Insert: Partial<UserMissing> & { user_id: string; sticker_id: string };
        Update: Partial<UserMissing>;
        Relationships: [];
      };
      trade_requests: {
        Row: TradeRequest;
        Insert: Partial<TradeRequest> & { from_user_id: string; to_user_id: string };
        Update: Partial<TradeRequest>;
        Relationships: [];
      };
      trade_request_items: {
        Row: TradeRequestItem;
        Insert: Partial<TradeRequestItem> & {
          trade_request_id: string;
          sticker_id: string;
          direction: TradeItemDirection;
        };
        Update: Partial<TradeRequestItem>;
        Relationships: [];
      };
      admin_logs: {
        Row: AdminLog;
        Insert: Partial<AdminLog> & { admin_id: string; action: string };
        Update: Partial<AdminLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      generate_sticker_range: {
        Args: { p_total: number };
        Returns: undefined;
      };
    };
  };
};
