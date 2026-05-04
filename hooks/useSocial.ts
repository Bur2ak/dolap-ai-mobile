import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteFriendship, fetchFriendWardrobe, fetchFriendships, searchUsers, sendFriendRequest, updateFriendshipStatus } from "@/lib/api/social";
import { useAuthStore } from "@/stores/authStore";

export function useSocial() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);

  const friendshipsQuery = useQuery({
    queryKey: ["friendships", userId],
    queryFn: () => fetchFriendships(userId!),
    enabled: Boolean(userId),
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => searchUsers(query, userId!),
  });

  const sendRequestMutation = useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(userId!, addresseeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ friendshipId, status }: { friendshipId: string; status: "accepted" | "blocked" }) =>
      updateFriendshipStatus(userId!, friendshipId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (friendshipId: string) => deleteFriendship(userId!, friendshipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
  });

  return {
    userId,
    friendships: friendshipsQuery.data ?? [],
    isLoading: friendshipsQuery.isLoading,
    searchUsers: searchMutation.mutateAsync,
    searchResults: searchMutation.data ?? [],
    isSearching: searchMutation.isPending,
    sendFriendRequest: sendRequestMutation.mutateAsync,
    updateFriendshipStatus: updateStatusMutation.mutateAsync,
    deleteFriendship: deleteMutation.mutateAsync,
    isMutating: sendRequestMutation.isPending || updateStatusMutation.isPending || deleteMutation.isPending,
  };
}

export function useFriendWardrobe(friendId?: string) {
  return useQuery({
    queryKey: ["friend-wardrobe", friendId],
    queryFn: () => fetchFriendWardrobe(friendId!),
    enabled: Boolean(friendId),
  });
}
