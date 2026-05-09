import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteFriendship,
  fetchFriendWardrobe,
  fetchFriendships,
  fetchLoanRequests,
  type BorrowWardrobeItemInput,
  fetchReferralRewards,
  requestBorrowWardrobeItem,
  searchUsers,
  sendFriendRequest,
  updateFriendshipStatus,
  updateLoanRequestStatus,
} from "@/lib/api/social";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { LoanRequest, LoanRequestStatus, WardrobeItem } from "@/types";

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
      void queryClient.invalidateQueries({ queryKey: ["referral-rewards", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void useAuthStore.getState().fetchProfile();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (friendshipId: string) => deleteFriendship(userId!, friendshipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const invalidateFriendships = () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    };
    const requesterChannel = supabase
      .channel(`friendships-requester-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` }, invalidateFriendships)
      .subscribe();
    const addresseeChannel = supabase
      .channel(`friendships-addressee-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` }, invalidateFriendships)
      .subscribe();

    return () => {
      void supabase.removeChannel(requesterChannel);
      void supabase.removeChannel(addresseeChannel);
    };
  }, [queryClient, userId]);

  return {
    userId,
    friendships: friendshipsQuery.data ?? [],
    error: friendshipsQuery.error,
    isLoading: friendshipsQuery.isLoading,
    isRefetching: friendshipsQuery.isRefetching,
    refetch: friendshipsQuery.refetch,
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
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const wardrobeQuery = useQuery({
    queryKey: ["friend-wardrobe", friendId],
    queryFn: () => fetchFriendWardrobe(friendId!),
    enabled: Boolean(friendId),
  });
  const loanRequestsQuery = useQuery({
    queryKey: ["loan-requests", userId],
    queryFn: () => fetchLoanRequests(userId!),
    enabled: Boolean(userId),
  });
  const borrowMutation = useMutation({
    mutationFn: ({ item, input }: { item: WardrobeItem; input?: BorrowWardrobeItemInput }) => requestBorrowWardrobeItem(userId!, item, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    },
  });

  useEffect(() => {
    if (!friendId) {
      return;
    }

    const channel = supabase
      .channel(`friend-wardrobe-${friendId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wardrobe_items", filter: `user_id=eq.${friendId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["friend-wardrobe", friendId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [friendId, queryClient]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const invalidateLoanRequests = () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    };
    const ownerChannel = supabase
      .channel(`friend-wardrobe-loans-owner-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `owner_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();
    const requesterChannel = supabase
      .channel(`friend-wardrobe-loans-requester-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `requester_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();

    return () => {
      void supabase.removeChannel(ownerChannel);
      void supabase.removeChannel(requesterChannel);
    };
  }, [queryClient, userId]);

  return {
    ...wardrobeQuery,
    currentUserId: userId,
    loanRequests: loanRequestsQuery.data ?? [],
    isLoadingLoanRequests: loanRequestsQuery.isLoading,
    requestBorrowItem: borrowMutation.mutateAsync,
    isRequestingBorrow: borrowMutation.isPending,
  };
}

export function useReferralRewards() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const rewardsQuery = useQuery({
    queryKey: ["referral-rewards", userId],
    queryFn: () => fetchReferralRewards(userId!),
    enabled: Boolean(userId),
  });

  return {
    rewards: rewardsQuery.data ?? [],
    error: rewardsQuery.error,
    isLoading: rewardsQuery.isLoading,
    isRefetching: rewardsQuery.isRefetching,
    refetch: rewardsQuery.refetch,
    userId,
  };
}

export function useLoanRequests() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const loanRequestsQuery = useQuery({
    queryKey: ["loan-requests", userId],
    queryFn: () => fetchLoanRequests(userId!),
    enabled: Boolean(userId),
  });
  const updateMutation = useMutation({
    mutationFn: ({ loanRequest, status }: { loanRequest: LoanRequest; status: LoanRequestStatus }) =>
      updateLoanRequestStatus(userId!, loanRequest, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const invalidateLoanRequests = () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    };
    const ownerChannel = supabase
      .channel(`loan-requests-owner-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `owner_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();
    const requesterChannel = supabase
      .channel(`loan-requests-requester-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `requester_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();

    return () => {
      void supabase.removeChannel(ownerChannel);
      void supabase.removeChannel(requesterChannel);
    };
  }, [queryClient, userId]);

  return {
    loanRequests: loanRequestsQuery.data ?? [],
    error: loanRequestsQuery.error,
    isLoading: loanRequestsQuery.isLoading,
    isRefetching: loanRequestsQuery.isRefetching,
    refetch: loanRequestsQuery.refetch,
    updateLoanRequestStatus: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    userId,
  };
}
