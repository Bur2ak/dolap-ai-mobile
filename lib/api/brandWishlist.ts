import { throwApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";

export interface BrandWishlistEntry {
  id: string;
  user_id: string;
  brand_name: string;
  store_url: string | null;
  notify_on_sale: boolean;
  last_notified_at: string | null;
  created_at: string;
}

export interface CreateBrandWishlistInput {
  brand_name: string;
  store_url?: string | null;
  notify_on_sale?: boolean;
}

const COLS = "id,user_id,brand_name,store_url,notify_on_sale,last_notified_at,created_at" as const;

export async function fetchBrandWishlist(userId: string): Promise<BrandWishlistEntry[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("brand_wishlist")
    .select(COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throwApiError(error, "Marka listesi yüklenemedi.");
  return (data ?? []).map(normalizeEntry).filter(Boolean) as BrandWishlistEntry[];
}

export async function addBrandWishlistEntry(userId: string, input: CreateBrandWishlistInput): Promise<BrandWishlistEntry> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("brand_wishlist")
    .insert({
      user_id: userId,
      brand_name: input.brand_name.trim().slice(0, 80),
      store_url: input.store_url?.trim() || null,
      notify_on_sale: input.notify_on_sale ?? true,
    })
    .select(COLS)
    .single();

  if (error) throwApiError(error, "Marka eklenemedi.");
  const entry = normalizeEntry(data);
  if (!entry) throw new Error("Marka kaydı geçersiz döndü.");
  return entry;
}

export async function updateBrandWishlistEntry(
  userId: string,
  entryId: string,
  input: Partial<Pick<BrandWishlistEntry, "notify_on_sale" | "store_url">>,
): Promise<BrandWishlistEntry> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("brand_wishlist")
    .update({
      notify_on_sale: input.notify_on_sale,
      store_url: input.store_url?.trim() || null,
    })
    .eq("user_id", userId)
    .eq("id", entryId)
    .select(COLS)
    .single();

  if (error) throwApiError(error, "Marka güncellenemedi.");
  const entry = normalizeEntry(data);
  if (!entry) throw new Error("Marka kaydı geçersiz döndü.");
  return entry;
}

export async function deleteBrandWishlistEntry(userId: string, entryId: string): Promise<void> {
  assertUserId(userId);
  const { error } = await supabase
    .from("brand_wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) throwApiError(error, "Marka silinemedi.");
}

function normalizeEntry(value: unknown): BrandWishlistEntry | null {
  const r = value as Record<string, unknown>;
  if (!r || typeof r.id !== "string") return null;
  return {
    id: r.id,
    user_id: String(r.user_id ?? ""),
    brand_name: String(r.brand_name ?? ""),
    store_url: typeof r.store_url === "string" ? r.store_url : null,
    notify_on_sale: r.notify_on_sale !== false,
    last_notified_at: typeof r.last_notified_at === "string" ? r.last_notified_at : null,
    created_at: String(r.created_at ?? ""),
  };
}

function assertUserId(value: string) {
  if (!isUuid(value)) throw new Error("Oturum bilgisi geçersiz.");
}
