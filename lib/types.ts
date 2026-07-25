export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  date: string;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  status: "draft" | "published" | "past";
  is_featured: boolean;
  external_ticket_url?: string | null;
  /** Where buyers go to pay. Only ever shown for orders with a total above zero. */
  payment_url?: string | null;
  /** Free-text payment instructions, shown alongside payment_url on paid orders. */
  payment_note?: string | null;
  /**
   * Whether the birthday package is offered on this night. Defaults to true in
   * the database, so an event that predates the column offers it — which is the
   * intended behaviour for a standing offer.
   */
  birthday_package?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Gallery {
  id: string;
  event_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  qr_code_url: string | null;
  is_public: boolean;
  created_at: string;
}

export interface GalleryPhoto {
  id: string;
  gallery_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price_zar: number;
  category: "tshirt" | "cup" | "accessory";
  image_url: string | null;
  sizes: string[];
  colors: string[];
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  items: OrderItem[];
  total_zar: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  payment_method: "whatsapp" | "yoco" | "payfast";
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  price: number;
}

export interface Ticket {
  id: string;
  event_id: string;
  name: string;
  price_zar: number;
  quantity_total: number;
  quantity_sold: number;
  sale_start: string | null;
  sale_end: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TicketOrder {
  id: string;
  /** Generated in the database from the id, e.g. TS-1A2B3C4D. Read-only. */
  order_ref: string;
  ticket_id: string;
  user_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  quantity: number;
  total_zar: number;
  qr_code: string | null;
  status: "pending" | "confirmed" | "used" | "cancelled";
  payment_method: string;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  area: string | null;
  capacity: number | null;
  venue_type: string | null;
  hire_cost_zar: number | null;
  revenue_share_percent: number | null;
  partnership_status: "prospect" | "contacted" | "negotiating" | "partnered" | "declined";
  notes: string | null;
  website: string | null;
  instagram: string | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VenueContact {
  id: string;
  venue_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string | null;
  name: string;
  role: string;
  responsibilities: string[];
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TeamTask {
  id: string;
  assigned_to: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GalleryView {
  id: string;
  gallery_id: string;
  user_id: string;
  viewed_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  source: string;
  subscribed_at: string;
  is_active: boolean;
  consent_events: boolean;
  consent_merch: boolean;
  consent_at: string | null;
  consent_ip: string | null;
  /**
   * Proof of ownership for opting out. It only ever leaves the server inside an
   * email to the address itself — never render it in a page or an admin list.
   */
  unsubscribe_token: string;
}

export interface AnalyticsEvent {
  id: string;
  site: "app" | "static";
  event_name: string;
  path: string | null;
  referrer_host: string | null;
  session_id: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device: string | null;
  props: Record<string, unknown>;
  created_at: string;
}

export interface VideoProject {
  id: string;
  event_id: string | null;
  title: string;
  status: "pending" | "processing" | "complete" | "failed";
  source_files: Record<string, string>[] | null;
  output_path: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  created_at: string;
  updated_at: string;
}
