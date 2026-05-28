import { supabase } from "@/lib/supabase";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { throwApiError } from "@/lib/api/errors";

export interface ColorDnaResult {
  undertone: "warm" | "cool" | "neutral";
  seasonal_palette: "spring" | "summer" | "autumn" | "winter";
  best_colors: string[];
  avoid_colors: string[];
  description: string;
  confidence: number;
  analyzed_at: string;
}

export async function analyzeColorDna(imageBase64: string, mimeType: string): Promise<ColorDnaResult> {
  const result = await invokeFunctionWithRetry<ColorDnaResult>("color-dna", { imageBase64, mimeType });
  if (!result) throw new Error("Renk DNA analizi başarısız.");
  return result;
}

export async function saveColorDnaToProfile(userId: string, result: ColorDnaResult): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ color_dna: result })
    .eq("id", userId);

  if (error) throwApiError(error, "Renk DNA profile kaydedilemedi.");
}

export async function fetchColorDnaFromProfile(userId: string): Promise<ColorDnaResult | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("color_dna")
    .eq("id", userId)
    .maybeSingle();

  if (error) throwApiError(error, "Renk DNA okunamadı.");
  if (!data?.color_dna || typeof data.color_dna !== "object") return null;

  const dna = data.color_dna as Partial<ColorDnaResult>;
  if (!dna.undertone || !dna.analyzed_at) return null;
  return dna as ColorDnaResult;
}
