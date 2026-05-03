import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWardrobeItem,
  deleteWardrobeItem,
  fetchWardrobeItem,
  fetchWardrobeItems,
  markWardrobeItemWorn,
  updateWardrobeItem,
} from "@/lib/api/wardrobe";
import { useAuthStore } from "@/stores/authStore";
import type { CreateWardrobeItemInput, UpdateWardrobeItemInput, WardrobeItem } from "@/types";

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

export function useWardrobeItem(itemId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);

  const itemQuery = useQuery({
    queryKey: ["wardrobe-item", userId, itemId],
    queryFn: () => fetchWardrobeItem(userId!, itemId!),
    enabled: Boolean(userId && itemId),
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateWardrobeItemInput) => updateWardrobeItem(userId!, itemId!, input),
    onSuccess: (item) => {
      queryClient.setQueryData(["wardrobe-item", userId, item.id], item);
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  const markWornMutation = useMutation({
    mutationFn: (item: WardrobeItem) => markWardrobeItemWorn(userId!, item),
    onSuccess: (item) => {
      queryClient.setQueryData(["wardrobe-item", userId, item.id], item);
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWardrobeItem(userId!, itemId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  return {
    item: itemQuery.data,
    isLoading: itemQuery.isLoading,
    updateItem: updateMutation.mutateAsync,
    markWorn: markWornMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending || markWornMutation.isPending || deleteMutation.isPending,
  };
}
