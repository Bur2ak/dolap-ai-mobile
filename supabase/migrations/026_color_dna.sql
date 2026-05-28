-- Renk / Ten Tonu DNA analizi
-- Gemini Vision'dan dönen analiz: undertone (warm/cool/neutral), season (spring/summer/autumn/winter),
-- best_colors (HEX array), avoid_colors (HEX array), confidence, analyzed_at, source_image_path

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS color_dna jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.color_dna IS 'AI analiz çıktısı: undertone, seasonal_palette, best_colors, avoid_colors, confidence, analyzed_at';

-- Index for users who completed color DNA analysis (used in onboarding analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_color_dna_analyzed
  ON profiles ((color_dna ->> 'analyzed_at'))
  WHERE color_dna ->> 'analyzed_at' IS NOT NULL;
