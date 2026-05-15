import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { useState } from "react";

import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const googleClientId = Platform.OS === "ios"
  ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  : Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const redirectUrl = Linking.createURL("/");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("Google OAuth URL alinamadi.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === "success") {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          captureEvent("auth_google_completed");
        } else {
          const accessToken = url.searchParams.get("access_token");
          const refreshToken = url.searchParams.get("refresh_token");
          if (accessToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? "" });
            captureEvent("auth_google_completed");
          }
        }
      } else if (result.type === "cancel") {
        captureEvent("auth_google_cancelled");
      }
    } catch (error) {
      captureError(error, { area: "auth_google" });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { signInWithGoogle, isLoading };
}
