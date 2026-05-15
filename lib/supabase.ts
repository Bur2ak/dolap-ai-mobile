import "react-native-url-polyfill/auto";

import { createMMKV } from "react-native-mmkv";
import { createClient } from "@supabase/supabase-js";

import { getMissingRequiredPublicEnv, publicEnv } from "@/lib/env";

const missingSupabaseEnv = getMissingRequiredPublicEnv();
if (missingSupabaseEnv.length > 0) {
  console.warn(`Supabase env degerleri eksik: ${missingSupabaseEnv.join(", ")}. .env dosyasini .env.example uzerinden olustur.`);
}

const mmkv = createMMKV({ id: "shipirio-auth" });

const mmkvStorage = {
  setItem: (key: string, value: string) => mmkv.set(key, value),
  getItem: (key: string) => mmkv.getString(key) ?? null,
  removeItem: (key: string) => { mmkv.remove(key); },
};

export const supabase = createClient(publicEnv.supabaseUrl ?? "https://placeholder.supabase.co", publicEnv.supabaseAnonKey ?? "placeholder", {
  auth: {
    storage: mmkvStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function safeChannel(name: string) {
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${name}`);
  if (existing) {
    void supabase.removeChannel(existing);
  }
  return supabase.channel(name);
}
