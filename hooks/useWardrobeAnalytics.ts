import { useMemo } from "react";

import { useWardrobe } from "@/hooks/useWardrobe";
import { calculateWardrobeAnalytics } from "@/utils/analytics";

export function useWardrobeAnalytics() {
  const { items, error, isLoading, isRefetching, refetch } = useWardrobe();
  const analytics = useMemo(() => calculateWardrobeAnalytics(items), [items]);

  return {
    analytics,
    error,
    isLoading,
    isRefetching,
    refetch,
  };
}
