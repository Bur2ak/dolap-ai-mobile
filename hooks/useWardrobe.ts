import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWardrobeItem,
  deleteWardrobeItem,
  fetchWardrobeItem,
  fetchWardrobeItems,
  markWardrobeItemWorn,
  updateWardrobeItem,
} from "@/lib/api/wardrobe";
import { supabase } from "@/lib/supabase";
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
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateWardrobeItemInput }) => updateWardrobeItem(userId!, itemId, input),
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
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteWardrobeItem(userId!, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`wardrobe-items-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wardrobe_items", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    items: itemsQuery.data ?? [],
    error: itemsQuery.error,
    isLoading: itemsQuery.isLoading,
    isRefetching: itemsQuery.isRefetching,
    refetch: itemsQuery.refetch,
    createItem: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutateAsync,
    markWorn: markWornMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    isCreating: createItemMutation.isPending,
    isUpdating: updateItemMutation.isPending || markWornMutation.isPending || deleteItemMutation.isPending,
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

  useEffect(() => {
    if (!userId || !itemId) {
      return;
    }

    const channel = supabase
      .channel(`wardrobe-item-${itemId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wardrobe_items", filter: `id=eq.${itemId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["wardrobe-item", userId, itemId] });
        void queryClient.invalidateQueries({ queryKey: ["wardrobe-items", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [itemId, queryClient, userId]);

  return {
    item: itemQuery.data,
    error: itemQuery.error,
    isLoading: itemQuery.isLoading,
    isRefetching: itemQuery.isRefetching,
    refetch: itemQuery.refetch,
    updateItem: updateMutation.mutateAsync,
    markWorn: markWornMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending || markWornMutation.isPending || deleteMutation.isPending,
  };
}
