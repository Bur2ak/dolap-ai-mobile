import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { throwApiError } from "@/lib/api/errors";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import { normalizeEmail, normalizeUsername } from "@/utils/validation";

const maxFullNameLength = 120;
const maxBioLength = 160;
const maxPushTokenLength = 512;

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
    const { error, data } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) {
      captureError(error, { area: "auth_sign_in" });
      throwApiError(error, "Giris yapilamadi.");
    }
    set({ session: data.session });
    captureEvent("auth_signed_in");
    await get().fetchProfile();
  },

  signUp: async (email, password, fullName) => {
    const normalizedFullName = normalizeProfileText(fullName, maxFullNameLength);
    const consentedAt = new Date().toISOString();
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: {
          full_name: normalizedFullName,
          kvkk_consent_at: consentedAt,
          terms_accepted_at: consentedAt,
        },
      },
    });
    if (error) {
      captureError(error, { area: "auth_sign_up" });
      throwApiError(error, "Kayit olusturulamadi.");
    }
    captureEvent("auth_signed_up", { kvkk_accepted: true, terms_accepted: true });
  },

  resetPassword: async (email, redirectTo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo,
    });
    if (error) {
      captureError(error, { area: "auth_password_reset_request" });
      throwApiError(error, "Sifre sifirlama e-postasi gonderilemedi.");
    }
    captureEvent("auth_password_reset_requested");
  },

  updatePassword: async (password) => {
    if (password.length < 8) {
      throw new Error("Sifre en az 8 karakter olmali.");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      captureError(error, { area: "auth_password_update" });
      throwApiError(error, "Sifre guncellenemedi.");
    }
    captureEvent("auth_password_updated");
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      captureError(error, { area: "auth_sign_out" });
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
      captureError(error, { area: "profile_fetch" });
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

    const nextUpdates = normalizeProfileUpdates(updates);
    const { error } = await supabase.from("profiles").update(nextUpdates).eq("id", user.id);
    if (error) {
      captureError(error, {
        area: "profile_update",
        changed_bio: updates.bio !== undefined,
        changed_full_name: updates.full_name !== undefined,
        changed_notifications: updates.notification_preferences !== undefined,
        changed_privacy: updates.privacy_settings !== undefined,
        changed_username: updates.username !== undefined,
        requested_deletion: updates.deletion_requested_at !== undefined,
      });
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

type ProfileUpdatePayload = Partial<
  Pick<
    Profile,
    | "avatar_url"
    | "bio"
    | "deletion_requested_at"
    | "deletion_scheduled_for"
    | "full_name"
    | "notification_preferences"
    | "onboarding_completed"
    | "privacy_settings"
    | "push_token"
    | "username"
  >
> & { updated_at: string };

function normalizeProfileUpdates(updates: Partial<Profile>): ProfileUpdatePayload {
  const normalized: ProfileUpdatePayload = { updated_at: new Date().toISOString() };

  if (updates.full_name !== undefined) {
    normalized.full_name = normalizeProfileText(updates.full_name, maxFullNameLength);
  }

  if (updates.username !== undefined) {
    const username = updates.username ? normalizeUsername(updates.username) : "";
    normalized.username = username || null;
  }

  if (updates.bio !== undefined) {
    normalized.bio = normalizeProfileText(updates.bio, maxBioLength);
  }

  if (updates.avatar_url !== undefined) {
    normalized.avatar_url = normalizeNullableText(updates.avatar_url, 500);
  }

  if (updates.push_token !== undefined) {
    normalized.push_token = normalizeNullableText(updates.push_token, maxPushTokenLength);
  }

  if (updates.notification_preferences !== undefined) {
    normalized.notification_preferences = {
      outfit_reminder: updates.notification_preferences.outfit_reminder !== false,
      price_drops: updates.notification_preferences.price_drops !== false,
      friend_requests: updates.notification_preferences.friend_requests !== false,
      outfit_votes: updates.notification_preferences.outfit_votes !== false,
      lend_requests: updates.notification_preferences.lend_requests !== false,
    };
  }

  if (updates.privacy_settings !== undefined) {
    normalized.privacy_settings = {
      wardrobe_visible: updates.privacy_settings.wardrobe_visible === true,
      allow_friend_requests: updates.privacy_settings.allow_friend_requests !== false,
    };
  }

  if (updates.onboarding_completed !== undefined) {
    normalized.onboarding_completed = updates.onboarding_completed === true;
  }

  if (updates.deletion_requested_at !== undefined) {
    normalized.deletion_requested_at = normalizeIsoDateTime(updates.deletion_requested_at);
  }

  if (updates.deletion_scheduled_for !== undefined) {
    normalized.deletion_scheduled_for = normalizeDateOnly(updates.deletion_scheduled_for);
  }

  return normalized;
}

function normalizeProfileText(value: string | null | undefined, maxLength: number) {
  return normalizeNullableText(value, maxLength);
}

function normalizeNullableText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim().replace(/\s+/g, " ").slice(0, maxLength) ?? "";
  return normalized || null;
}

function normalizeIsoDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? value : null;
}
