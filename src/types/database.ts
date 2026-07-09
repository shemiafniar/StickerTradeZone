export type TradeStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";
export type TradeItemDirection = "give" | "receive";
export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended";
export type ListingType = "trade" | "sale" | "both";
export type StickerStatus = "have" | "duplicate" | "missing";
export type NotificationType =
  | "trade_request_received"
  | "trade_accepted"
  | "trade_declined"
  | "new_message"
  | "new_match";

export type Profile = {
  id: string;
  full_name: string;
  city: string;
  neighborhood: string | null;
  role: UserRole;
  status: UserStatus;
  location_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
};

export type ProfileContact = {
  user_id: string;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  updated_at: string;
};

/** A participating national team, shown as a card in the visual collection UI. */
export type Team = {
  code: string;
  name_he: string;
  flag_emoji: string;
  /**
   * `flag-icons` library code (ISO 3166-1 alpha-2, or `gb-eng`/`gb-sct` for
   * England/Scotland) used to render a real, reliably-rendering SVG flag.
   * Null for custom teams an admin adds beyond the official roster, which
   * fall back to displaying `flag_emoji` instead - see TeamFlag.tsx.
   */
  flag_icon: string | null;
  sort_order: number;
  created_at: string;
};

/** A single sticker slot, uniquely identified by `code` (e.g. "GER-2"). */
export type Sticker = {
  id: string;
  team_code: string;
  /** 1-20, the sticker's position within its team. */
  number: number;
  /** Unique identifier, always `${team_code}-${number}` (e.g. "GER-2"). */
  code: string;
  created_at: string;
};

export type AppSettings = {
  id: true;
  set_name: string;
  total_stickers: number;
  updated_at: string;
};

/**
 * One row per (user, sticker) the user has marked. No row = unmarked/gray.
 * `listing_type`/`price`/`note` are only meaningful when status = 'duplicate'.
 */
export type UserSticker = {
  id: string;
  user_id: string;
  sticker_id: string;
  status: StickerStatus;
  listing_type: ListingType;
  price: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
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

export type TradeMessage = {
  id: string;
  trade_request_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  dispatched_channels: string[];
  read_at: string | null;
  created_at: string;
};

export type ScanMode = "sticker_backs";

export type ScanEvent = {
  id: string;
  user_id: string;
  mode: ScanMode;
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
      teams: {
        Row: Team;
        Insert: Partial<Team> & { code: string; name_he: string; flag_emoji: string };
        Update: Partial<Team>;
        Relationships: [];
      };
      stickers: {
        Row: Sticker;
        Insert: Partial<Sticker> & { team_code: string; number: number; code: string };
        Update: Partial<Sticker>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettings;
        Insert: Partial<AppSettings>;
        Update: Partial<AppSettings>;
        Relationships: [];
      };
      user_stickers: {
        Row: UserSticker;
        Insert: Partial<UserSticker> & { user_id: string; sticker_id: string; status: StickerStatus };
        Update: Partial<UserSticker>;
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
      profile_locations: {
        Row: ProfileLocation;
        Insert: Partial<ProfileLocation> & { user_id: string; latitude: number; longitude: number };
        Update: Partial<ProfileLocation>;
        Relationships: [];
      };
      trade_messages: {
        Row: TradeMessage;
        Insert: Partial<TradeMessage> & { trade_request_id: string; sender_id: string; body: string };
        Update: Partial<TradeMessage>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & { user_id: string; type: NotificationType };
        Update: Partial<Notification>;
        Relationships: [];
      };
      scan_events: {
        Row: ScanEvent;
        Insert: Partial<ScanEvent> & { user_id: string; mode: ScanMode };
        Update: Partial<ScanEvent>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      admin_add_team: {
        Args: { p_code: string; p_name_he: string; p_flag_emoji: string | null; p_sort_order?: number | null };
        Returns: undefined;
      };
      nearby_distances: {
        Args: { max_km?: number };
        Returns: { user_id: string; distance_km: number }[];
      };
      nearby_locations: {
        Args: { max_km?: number };
        Returns: { user_id: string; distance_km: number; approx_lat: number; approx_lng: number }[];
      };
      disable_my_location: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      mark_trade_messages_read: {
        Args: { p_trade_request_id: string };
        Returns: undefined;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
};
