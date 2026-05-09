import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { getMissingRequiredPublicEnv, publicEnv } from "@/lib/env";

const missingSupabaseEnv = getMissingRequiredPublicEnv();
if (missingSupabaseEnv.length > 0) {
  console.warn(`Supabase env degerleri eksik: ${missingSupabaseEnv.join(", ")}. .env dosyasini .env.example uzerinden olustur.`);
}

export const supabase = createClient(publicEnv.supabaseUrl ?? "https://placeholder.supabase.co", publicEnv.supabaseAnonKey ?? "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
