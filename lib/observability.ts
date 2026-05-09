import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";

import { publicEnv } from "@/lib/env";

type ObservabilityProperties = Record<string, string | number | boolean | null | undefined>;
type SanitizedObservabilityProperties = Record<string, string | number | boolean | null>;

let posthog: PostHog | null = null;
let sentryReady = false;

export function initializeObservability() {
  const sentryDsn = publicEnv.sentryDsn;
  if (sentryDsn && !sentryReady) {
    Sentry.init({
      dsn: sentryDsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: __DEV__ ? 0 : 0.1,
    });
    sentryReady = true;
  }

  const posthogApiKey = publicEnv.posthogApiKey;
  if (posthogApiKey && !posthog) {
    posthog = new PostHog(posthogApiKey, {
      host: publicEnv.posthogHost ?? "https://us.i.posthog.com",
      captureAppLifecycleEvents: true,
    });
  }
}

export function captureEvent(name: string, properties?: ObservabilityProperties) {
  posthog?.capture(name, sanitizeProperties(properties));
}

export function captureError(error: unknown, context?: ObservabilityProperties) {
  const sanitizedContext = sanitizeProperties(context);

  if (sentryReady) {
    Sentry.captureException(error, sanitizedContext ? { extra: sanitizedContext } : undefined);
  }

  posthog?.captureException(error, sanitizedContext);
}

export function identifyUser(userId: string, properties?: ObservabilityProperties) {
  const sanitizedProperties = sanitizeProperties(properties);

  if (sentryReady) {
    Sentry.setUser({ id: userId, email: typeof sanitizedProperties?.email === "string" ? sanitizedProperties.email : undefined });
  }

  posthog?.identify(userId, sanitizedProperties);
}

export function resetUser() {
  if (sentryReady) {
    Sentry.setUser(null);
  }

  posthog?.reset();
}

function sanitizeProperties(properties?: ObservabilityProperties): SanitizedObservabilityProperties | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined)) as SanitizedObservabilityProperties;
}
