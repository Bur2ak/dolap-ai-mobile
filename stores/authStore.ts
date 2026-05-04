import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  resetPassword: (email: string, redirectTo: string) => Promise<void>;
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
      throw error;
    }
    set({ session: data.session });
    await get().fetchProfile();
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      throw error;
    }
  },

  resetPassword: async (email, redirectTo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      throw error;
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
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
      throw error;
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
      throw error;
    }

    set((state) => ({
      profile: state.profile ? { ...state.profile, ...nextUpdates } : state.profile,
    }));
  },
}));
