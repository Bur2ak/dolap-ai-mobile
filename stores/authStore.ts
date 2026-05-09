import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { throwApiError } from "@/lib/api/errors";
import { captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  resetPassword: (email: string, redirectTo: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  signIn: async (email, password) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throwApiError(error, "Giris yapilamadi.");
    }
    set({ session: data.session });
    captureEvent("auth_signed_in");
    await get().fetchProfile();
  },

  signUp: async (email, password, fullName) => {
    const consentedAt = new Date().toISOString();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          kvkk_consent_at: consentedAt,
          terms_accepted_at: consentedAt,
        },
      },
    });
    if (error) {
      throwApiError(error, "Kayit olusturulamadi.");
    }
    captureEvent("auth_signed_up", { kvkk_accepted: true, terms_accepted: true });
  },

  resetPassword: async (email, redirectTo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      throwApiError(error, "Sifre sifirlama e-postasi gonderilemedi.");
    }
    captureEvent("auth_password_reset_requested");
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throwApiError(error, "Sifre guncellenemedi.");
    }
    captureEvent("auth_password_updated");
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throwApiError(error, "Cikis yapilamadi.");
    }
    captureEvent("auth_signed_out");
    set({ session: null, profile: null });
  },

  fetchProfile: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      set({ profile: null });
      return;
    }

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

    if (error) {
      throwApiError(error, "Profil yuklenemedi.");
    }

    set({ profile: data as Profile });
  },

  updateProfile: async (updates) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const nextUpdates = { ...updates, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").update(nextUpdates).eq("id", user.id);
    if (error) {
      throwApiError(error, "Profil guncellenemedi.");
    }

    captureEvent("profile_updated", {
      changed_bio: updates.bio !== undefined,
      changed_full_name: updates.full_name !== undefined,
      changed_notifications: updates.notification_preferences !== undefined,
      changed_privacy: updates.privacy_settings !== undefined,
      changed_username: updates.username !== undefined,
      requested_deletion: updates.deletion_requested_at !== undefined,
    });

    set((state) => ({
      profile: state.profile ? { ...state.profile, ...nextUpdates } : state.profile,
    }));
  },
}));
