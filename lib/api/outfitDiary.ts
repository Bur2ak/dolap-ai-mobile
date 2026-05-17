import { throwApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import { formatDateOnly } from "@/utils/formatters";

export interface DiaryEntry {
  id: string;
  user_id: string;
  worn_at: string;
  outfit_id: string | null;
  item_ids: string[];
  photo_url: string | null;
  mood: string | null;
  weather_desc: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateDiaryEntryInput {
  worn_at: string;
  item_ids: string[];
  outfit_id?: string | null;
  photo_url?: string | null;
  mood?: string | null;
  weather_desc?: string | null;
  rating?: number | null;
  notes?: string | null;
}

const DIARY_COLS = "id,user_id,worn_at,outfit_id,item_ids,photo_url,mood,weather_desc,rating,notes,created_at" as const;

export async function fetchDiaryEntries(userId: string, limit = 30): Promise<DiaryEntry[]> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("outfit_diary")
    .select(DIARY_COLS)
    .eq("user_id", userId)
    .order("worn_at", { ascending: false })
    .limit(limit);

  if (error) throwApiError(error, "Giyim günlüğü yüklenemedi.");
  return (data ?? []).map(normalizeDiaryEntry).filter(Boolean) as DiaryEntry[];
}

export async function fetchTodayDiaryEntry(userId: string): Promise<DiaryEntry | null> {
  assertUserId(userId);
  const today = formatDateOnly(new Date());
  const { data, error } = await supabase
    .from("outfit_diary")
    .select(DIARY_COLS)
    .eq("user_id", userId)
    .eq("worn_at", today)
    .maybeSingle();

  if (error) throwApiError(error, "Bugünün kaydı alınamadı.");
  return data ? normalizeDiaryEntry(data) : null;
}

export async function upsertDiaryEntry(userId: string, input: CreateDiaryEntryInput): Promise<DiaryEntry> {
  assertUserId(userId);
  const { data, error } = await supabase
    .from("outfit_diary")
    .upsert({
      user_id: userId,
      worn_at: input.worn_at,
      item_ids: input.item_ids ?? [],
      outfit_id: input.outfit_id ?? null,
      photo_url: input.photo_url ?? null,
      mood: input.mood?.trim().slice(0, 80) ?? null,
      weather_desc: input.weather_desc?.trim().slice(0, 120) ?? null,
      rating: input.rating ?? null,
      notes: input.notes?.trim().slice(0, 500) ?? null,
    }, { onConflict: "user_id,worn_at" })
    .select(DIARY_COLS)
    .single();

  if (error) throwApiError(error, "Giyim kaydı kaydedilemedi.");
  const entry = normalizeDiaryEntry(data);
  if (!entry) throw new Error("Giyim kaydı geçersiz döndü.");
  return entry;
}

export async function deleteDiaryEntry(userId: string, entryId: string): Promise<void> {
  assertUserId(userId);
  const { error } = await supabase
    .from("outfit_diary")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) throwApiError(error, "Giyim kaydı silinemedi.");
}

function normalizeDiaryEntry(value: unknown): DiaryEntry | null {
  const r = value as Record<string, unknown>;
  if (!r || typeof r.id !== "string") return null;
  return {
    id: r.id,
    user_id: String(r.user_id ?? ""),
    worn_at: String(r.worn_at ?? ""),
    outfit_id: typeof r.outfit_id === "string" ? r.outfit_id : null,
    item_ids: Array.isArray(r.item_ids) ? (r.item_ids as string[]).filter((id) => typeof id === "string") : [],
    photo_url: typeof r.photo_url === "string" ? r.photo_url : null,
    mood: typeof r.mood === "string" ? r.mood : null,
    weather_desc: typeof r.weather_desc === "string" ? r.weather_desc : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    notes: typeof r.notes === "string" ? r.notes : null,
    created_at: String(r.created_at ?? ""),
  };
}

function assertUserId(value: string) {
  if (!isUuid(value)) throw new Error("Oturum bilgisi geçersiz.");
}
