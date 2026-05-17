import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addBrandWishlistEntry,
  deleteBrandWishlistEntry,
  fetchBrandWishlist,
  type CreateBrandWishlistInput,
} from "@/lib/api/brandWishlist";
import { captureError } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

export function useBrandWishlist() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  const listQuery = useQuery({
    queryKey: ["brand-wishlist", userId],
    queryFn: () => fetchBrandWishlist(userId!),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: (input: CreateBrandWishlistInput) => addBrandWishlistEntry(userId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brand-wishlist", userId] });
    },
    onError: (err) => captureError(err, { area: "brand_wishlist_add" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteBrandWishlistEntry(userId!, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brand-wishlist", userId] });
    },
    onError: (err) => captureError(err, { area: "brand_wishlist_delete" }),
  });

  return {
    entries: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    addEntry: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    deleteEntry: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    userId,
  };
}
