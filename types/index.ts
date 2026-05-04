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

export interface ClothingAnalysisResult {
  category: ClothingCategory;
  subcategory: string;
  colors: string[];
  dominant_color_hex: string;
  season: Season[];
  brand?: string | null;
}

export interface CreateWardrobeItemInput {
  image_url: string;
  thumbnail_url?: string | null;
  category: ClothingCategory;
  subcategory?: string | null;
  colors?: string[];
  dominant_color_hex?: string | null;
  season?: Season[];
  brand?: string | null;
  purchase_price?: number | null;
}

export type UpdateWardrobeItemInput = Partial<Omit<CreateWardrobeItemInput, "image_url" | "thumbnail_url">> & {
  image_url?: string;
  thumbnail_url?: string | null;
  wear_count?: number;
  last_worn?: string | null;
  is_active?: boolean;
};

export interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  humidity: number;
  city: string;
}

export interface OutfitSuggestion {
  items: string[];
  name: string;
  reason: string;
  formality_match?: string;
}

export interface OutfitRecommendationInput {
  event: string;
  mood: string;
  weather: WeatherData | null;
  wardrobe: WardrobeItem[];
}

export type BuyDecision = "AL" | "BEKLEME" | "ALMA";

export interface BuyDecisionResult {
  decision: BuyDecision;
  confidence: number;
  similar_items_in_wardrobe: string[];
  combination_count: number;
  cost_per_wear_suggestion: string;
  main_reason: string;
  details: string;
  discount_advice: string | null;
}

export interface BuyDecisionInput {
  imageUri: string;
  price: number | null;
  wardrobe: WardrobeItem[];
}

export interface BuyDecisionRecord {
  id: string;
  user_id: string;
  product_image_url: string | null;
  product_name: string | null;
  price: number | null;
  decision: BuyDecision;
  confidence: number;
  similar_items: string[];
  combination_count: number;
  ai_reasoning: string;
  created_at: string;
}

export interface EventPlanInput {
  title: string;
  event_type: string;
  event_date: string;
  location: string | null;
  notes: string | null;
  weather: WeatherData | null;
  wardrobe: WardrobeItem[];
}

export interface EventRecord {
  id: string;
  user_id: string;
  outfit_id: string | null;
  title: string;
  event_type: string;
  event_date: string;
  location: string | null;
  notes: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

export interface DistributionPoint {
  label: string;
  value: number;
  color?: string;
}

export interface WardrobeAnalytics {
  total_items: number;
  total_value: number;
  avg_cost_per_wear: number;
  monthly_spending: number;
  most_worn: WardrobeItem[];
  never_worn: WardrobeItem[];
  category_distribution: DistributionPoint[];
  color_distribution: DistributionPoint[];
  suggestions_to_remove: WardrobeItem[];
}

export interface PriceTracking {
  id: string;
  user_id: string;
  product_name: string;
  product_url: string | null;
  product_image_url: string | null;
  current_price: number | null;
  target_price: number | null;
  initial_price: number | null;
  price_history: Array<{ price: number; date: string }>;
  store: string | null;
  is_active: boolean;
  last_checked: string | null;
  notified_at: string | null;
  created_at: string;
}

export interface CreatePriceTrackingInput {
  product_name: string;
  product_url?: string | null;
  current_price?: number | null;
  target_price?: number | null;
  store?: string | null;
}
