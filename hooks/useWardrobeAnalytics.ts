import { useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import { useWardrobe } from "@/hooks/useWardrobe";
import { calculateWardrobeAnalytics } from "@/utils/analytics";
import type { WardrobeAnalytics } from "@/types";

const emptyAnalytics = calculateWardrobeAnalytics([]);

// Items below this threshold are computed synchronously (no perceptible lag).
// Above it we defer to after interactions to avoid JS thread blocking.
const LARGE_WARDROBE_THRESHOLD = 200;

export function useWardrobeAnalytics() {
  const { items, error, isLoading, isRefetching, refetch } = useWardrobe();
  const [deferredAnalytics, setDeferredAnalytics] = useState<WardrobeAnalytics>(emptyAnalytics);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const isLarge = items.length > LARGE_WARDROBE_THRESHOLD;

  const immediateAnalytics = useMemo(
    () => (!isLarge ? calculateWardrobeAnalytics(items) : null),
    [isLarge, items],
  );

  useEffect(() => {
    if (!isLarge) return;

    // Defer heavy calculation until after navigation animations settle
    const handle = InteractionManager.runAfterInteractions(() => {
      setDeferredAnalytics(calculateWardrobeAnalytics(itemsRef.current));
    });

    return () => handle.cancel();
  }, [isLarge, items]);

  return {
    analytics: immediateAnalytics ?? deferredAnalytics,
    error,
    isLoading,
    isRefetching,
    refetch,
  };
}
