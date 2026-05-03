import { useMemo } from "react";

import { useWardrobe } from "@/hooks/useWardrobe";
import { calculateWardrobeAnalytics } from "@/utils/analytics";

export function useWardrobeAnalytics() {
  const { items, isLoading } = useWardrobe();
  const analytics = useMemo(() => calculateWardrobeAnalytics(items), [items]);

  return {
    analytics,
    isLoading,
  };
}
