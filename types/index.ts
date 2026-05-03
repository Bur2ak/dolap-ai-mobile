export type SubscriptionTier = "free" | "premium" | "family";

export type ClothingCategory =
  | "ust"
  | "alt"
  | "elbise"
  | "etek"
  | "dis_giyim"
  | "ayakkabi"
  | "canta"
  | "aksesuar"
  | "ic_giyim"
  | "spor"
  | "diger";

export type Season = "ilkbahar" | "yaz" | "sonbahar" | "kis";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  push_token: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url: string | null;
  category: ClothingCategory;
  subcategory: string | null;
  colors: string[];
  dominant_color_hex: string | null;
  season: Season[];
  brand: string | null;
  purchase_price: number | null;
  wear_count: number;
  last_worn: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
