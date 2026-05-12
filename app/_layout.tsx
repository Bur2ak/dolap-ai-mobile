import "react-native-gesture-handler";
import "react-native-url-polyfill/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments, type Href } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { COLORS } from "@/constants/colors";
import { syncSupabaseSessionFromUrl } from "@/lib/authLinks";
import { getNotificationRoute } from "@/lib/notifications";
import { captureError, captureEvent, identifyUser, initializeObservability, resetUser } from "@/lib/observability";
import { configureRevenueCat, getRevenueCatCustomerInfo, hasPremiumEntitlement } from "@/lib/revenuecat";
import { getSafeInternalReturnTo } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

void SplashScreen.preventAutoHideAsync();
initializeObservability();

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const segments = useSegments();
  const queryClient = useMemo(() => new QueryClient(), []);
  const handledNotificationResponseIds = useRef(new Set<string>());
  const { session, isLoading, fetchProfile } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    async function syncRevenueCat() {
      const status = await configureRevenueCat(session?.user.id ?? null);
      if (!status.configured) {
        useSubscriptionStore.getState().setRevenueCatPremium(false);
        captureEvent("revenuecat_sync_skipped", { reason: status.reason ?? "not_configured" });
        return;
      }

      const customerInfo = await getRevenueCatCustomerInfo();
      if (mounted) {
        const premium = hasPremiumEntitlement(customerInfo);
        useSubscriptionStore.getState().setRevenueCatPremium(premium);
        captureEvent("revenuecat_sync_completed", { premium });
      }
    }

    void syncRevenueCat().catch((error) => {
      captureError(error, { area: "revenuecat_sync" });
      useSubscriptionStore.getState().setRevenueCatPremium(false);
    });

    return () => {
      mounted = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (session?.user.id) {
      identifyUser(session.user.id, { email: session.user.email });
      return;
    }

    resetUser();
  }, [session?.user.email, session?.user.id]);

  useEffect(() => {
    let active = true;

    async function handleAuthLink(url: string | null) {
      if (!url) {
        return;
      }

      const linkType = await syncSupabaseSessionFromUrl(url);
      if (active && linkType === "recovery") {
        router.replace("/(auth)/reset-password");
      }
    }

    void Linking.getInitialURL()
      .then(handleAuthLink)
      .catch((error) => captureError(error, { area: "auth_initial_link" }));

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthLink(url).catch((error) => captureError(error, { area: "auth_runtime_link" }));
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    const openNotificationRoute = (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const responseId = response.notification.request.identifier;
      if (handledNotificationResponseIds.current.has(responseId)) {
        return;
      }

      handledNotificationResponseIds.current.add(responseId);
      const route = getNotificationRoute(response.notification.request.content.data);
      captureEvent("notification_opened", { route });
      router.push(route as Href);
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(openNotificationRoute)
      .catch((error) => captureError(error, { area: "notification_initial_response" }));

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationRoute(response);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    const fetchProfileSafely = (area: string) => {
      void fetchProfile().catch((error) => {
        captureError(error, { area });
      });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        useAuthStore.setState({ session: data.session, isLoading: false });
        if (data.session) {
          fetchProfileSafely("profile_bootstrap_fetch");
        }
      })
      .catch((error) => {
        captureError(error, { area: "auth_bootstrap_session" });
        useAuthStore.setState({ session: null, isLoading: false });
      })
      .finally(() => {
        void SplashScreen.hideAsync();
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      useAuthStore.setState({ session: nextSession });
      if (nextSession) {
        fetchProfileSafely("profile_auth_state_fetch");
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === "(auth)";
    const inPasswordReset = inAuthGroup && segmentList[1] === "reset-password";
    const inPublicSharedOutfit = segmentList[0] === "outfit" && segmentList[1] === "share";

    if (!session && !inAuthGroup && !inPublicSharedOutfit) {
      const returnTo = getReturnTo(pathname, params);
      router.replace({
        pathname: "/(auth)/onboarding",
        params: returnTo ? { returnTo } : undefined,
      });
    }

    if (session && inAuthGroup && !inPasswordReset) {
      router.replace(getSafeInternalReturnTo(params.returnTo) as Href);
    }
  }, [isLoading, params, pathname, router, segments, session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" backgroundColor={COLORS.background} />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function getReturnTo(pathname: string, params: Record<string, string | string[] | undefined>) {
  if (!pathname.startsWith("/") || pathname.startsWith("/(auth)") || pathname === "/") {
    return undefined;
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key === "returnTo" || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!isPathParam(pathname, entry)) {
          query.append(key, entry);
        }
      });
      return;
    }

    if (isPathParam(pathname, value)) {
      return;
    }

    query.set(key, value);
  });

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function isPathParam(pathname: string, value: string) {
  return pathname.split("/").some((segment) => segment === value || segment === encodeURIComponent(value));
}
