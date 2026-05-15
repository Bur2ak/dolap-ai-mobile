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
  revenuecat_customer_id: string | null;
  push_token: string | null;
  notification_preferences: NotificationPreferences;
  privacy_settings: PrivacySettings;
  onboarding_completed: boolean;
  kvkk_consent_at: string | null;
  terms_accepted_at: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  outfit_reminder: boolean;
  price_drops: boolean;
  friend_requests: boolean;
  outfit_votes: boolean;
  lend_requests: boolean;
}

export interface PrivacySettings {
  wardrobe_visible: boolean;
  allow_friend_requests: boolean;
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
  fabric: string | null;
  usage_context: string[];
  purchase_price: number | null;
  wear_count: number;
  last_worn: string | null;
  is_shareable: boolean;
  is_lendable: boolean;
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
  fabric?: string | null;
  usage_context?: string[];
  embedding?: number[] | null;
}

export interface CareRecommendation {
  title: string;
  body: string;
  priority: "normal" | "important";
}

export interface SustainabilityInsight {
  score: number;
  status: "excellent" | "good" | "needs_use" | "at_risk";
  title: string;
  body: string;
  signals: string[];
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
  fabric?: string | null;
  usage_context?: string[];
  purchase_price?: number | null;
  is_shareable?: boolean;
  is_lendable?: boolean;
  embedding?: number[] | null;
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

export interface SmartNotificationPlan {
  title: string;
  body: string;
  reason: string;
  route: string;
}

export interface CapsuleOutfitIdea {
  name: string;
  event: string;
  item_ids: string[];
  reason: string;
}

export interface CapsuleWardrobePlan {
  title: string;
  summary: string;
  coverage_score: number;
  core_item_ids: string[];
  outfit_ideas: CapsuleOutfitIdea[];
}

export interface OutfitSuggestion {
  items: string[];
  name: string;
  reason: string;
  accessory_note?: string | null;
  formality_match?: string;
}

export interface OutfitRecord {
  id: string;
  user_id: string;
  name: string | null;
  event_type: string | null;
  weather_temp: number | null;
  weather_description: string | null;
  mood: string | null;
  ai_reasoning: string | null;
  worn_at: string | null;
  is_favorite: boolean;
  is_shareable: boolean;
  share_token: string | null;
  created_at: string;
}

export type OutfitVoteValue = "yes" | "no" | "love";

export interface OutfitVote {
  id: string;
  outfit_id: string;
  voter_id: string;
  vote: OutfitVoteValue;
  created_at: string;
  voter?: Pick<Profile, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface SharedOutfit {
  outfit: OutfitRecord;
  items: WardrobeItem[];
  owner?: Pick<Profile, "id" | "username" | "full_name" | "avatar_url"> | null;
  votes: OutfitVote[];
}

export interface OutfitRecommendationInput {
  event: string;
  mood: string;
  weather: WeatherData | null;
  wardrobe: WardrobeItem[];
  focus_item_id?: string | null;
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

export type UpdateEventInput = Partial<Pick<EventRecord, "title" | "event_type" | "event_date" | "location" | "notes" | "calendar_event_id" | "outfit_id">>;

export interface StyleCalendarDay {
  date: string;
  day_label: string;
  title: string;
  body: string;
  status: "planned" | "open";
  event_id: string | null;
  suggested_event_type: string;
}

export interface DistributionPoint {
  label: string;
  value: number;
  color?: string;
}

export interface StyleProfile {
  label: string;
  confidence: number;
  summary: string;
  signals: string[];
}

export interface MissingWardrobePiece {
  category: ClothingCategory;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggested_colors: string[];
}

export interface WardrobeGoal {
  id: string;
  title: string;
  body: string;
  current: number;
  target: number;
  action_label: string;
  action_route: string;
  priority: "high" | "medium" | "low";
}

export interface MonthlySpendingPoint {
  month: string;
  amount: number;
}

export interface WardrobeAnalytics {
  total_items: number;
  total_value: number;
  avg_cost_per_wear: number;
  monthly_spending: number;
  monthly_spending_data: MonthlySpendingPoint[];
  utilization_score: number;
  sustainability_score: number;
  inactive_items_count: number;
  most_worn: WardrobeItem[];
  never_worn: WardrobeItem[];
  category_distribution: DistributionPoint[];
  color_distribution: DistributionPoint[];
  season_distribution: DistributionPoint[];
  brand_distribution: DistributionPoint[];
  fabric_distribution: DistributionPoint[];
  usage_context_distribution: DistributionPoint[];
  style_profile: StyleProfile;
  missing_pieces: MissingWardrobePiece[];
  weekly_goals: WardrobeGoal[];
  sustainability_focus_items: WardrobeItem[];
  high_value_unused: WardrobeItem[];
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

export type UpdatePriceTrackingInput = Partial<CreatePriceTrackingInput>;

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: "friend_request" | "outfit_vote" | "price_drop" | "outfit_reminder" | "lend_request" | "system";
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  sent_at: string;
}

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  requester?: Profile;
  addressee?: Profile;
}

export interface ReferralReward {
  id: string;
  friendship_id: string;
  referrer_id: string;
  referred_id: string;
  reward_days: number;
  created_at: string;
  referrer?: Profile | null;
  referred?: Profile | null;
}

export interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface FriendWardrobe {
  profile: Pick<Profile, "id" | "username" | "full_name" | "avatar_url" | "bio" | "privacy_settings">;
  items: WardrobeItem[];
}

export type LoanRequestStatus = "pending" | "approved" | "declined" | "returned";

export interface LoanRequest {
  id: string;
  item_id: string;
  owner_id: string;
  requester_id: string;
  status: LoanRequestStatus;
  requested_at: string;
  due_date: string | null;
  returned_at: string | null;
  note: string | null;
  item?: WardrobeItem | null;
  owner?: Profile | null;
  requester?: Profile | null;
}
