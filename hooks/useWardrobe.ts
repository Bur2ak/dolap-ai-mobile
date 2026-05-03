import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createWardrobeItem, fetchWardrobeItems } from "@/lib/api/wardrobe";
import { useAuthStore } from "@/stores/authStore";
import type { CreateWardrobeItemInput } from "@/types";

export function useWardrobe() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);

  const itemsQuery = useQuery({
    queryKey: ["wardrobe-items", userId],
    queryFn: () => fetchWardrobeItems(userId!),
    enabled: Boolean(userId),
  });

  const createItemMutation = useMutation({
    mutationFn: (input: CreateWardrobeItemInput) => createWardrobeItem(userId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  return {
    items: itemsQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    refetch: itemsQuery.refetch,
    createItem: createItemMutation.mutateAsync,
    isCreating: createItemMutation.isPending,
    canCreate: Boolean(userId),
  };
}
