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
import { requireUserId } from "@/lib/authGuards";
import { captureError, captureEvent } from "@/lib/observability";
import { safeChannel, supabase } from "@/lib/supabase";
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
    mutationFn: (query: string) => searchUsers(query, requireUserId(userId, "social_user_search")),
    onError: (error) => {
      captureError(error, { area: "social_user_search" });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(requireUserId(userId, "friend_request_send"), addresseeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "friend_request_send" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ friendshipId, status }: { friendshipId: string; status: "accepted" | "blocked" }) =>
      updateFriendshipStatus(requireUserId(userId, "friendship_status_update"), friendshipId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
      void queryClient.invalidateQueries({ queryKey: ["referral-rewards", userId] });
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void useAuthStore
        .getState()
        .fetchProfile()
        .catch((error) => {
          captureError(error, { area: "friendship_profile_refresh" });
        });
      captureEvent("friendship_status_updated_locally");
    },
    onError: (error, variables) => {
      captureError(error, { area: "friendship_status_update", status: variables.status });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (friendshipId: string) => deleteFriendship(requireUserId(userId, "friendship_delete"), friendshipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "friendship_delete" });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Single channel for both requester and addressee changes — halves WebSocket connections
    const invalidateFriendships = () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
    };
    const friendshipsChannel = safeChannel(`friendships-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` }, invalidateFriendships)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` }, invalidateFriendships)
      .subscribe();

    return () => {
      void supabase.removeChannel(friendshipsChannel);
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
    queryKey: ["friend-wardrobe", userId, friendId],
    queryFn: () => fetchFriendWardrobe(friendId!),
    enabled: Boolean(userId && friendId),
  });
  const loanRequestsQuery = useQuery({
    queryKey: ["loan-requests", userId],
    queryFn: () => fetchLoanRequests(userId!),
    enabled: Boolean(userId),
  });
  const borrowMutation = useMutation({
    mutationFn: ({ item, input }: { item: WardrobeItem; input?: BorrowWardrobeItemInput }) => requestBorrowWardrobeItem(requireUserId(userId, "loan_request_create"), item, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    },
    onError: (error) => {
      captureError(error, { area: "loan_request_create" });
    },
  });

  useEffect(() => {
    if (!friendId) {
      return;
    }

    const channel = safeChannel(`friend-wardrobe-${friendId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wardrobe_items", filter: `user_id=eq.${friendId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["friend-wardrobe", userId, friendId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [friendId, queryClient, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Single channel for both owner and requester — halves WebSocket connections
    const invalidateLoanRequests = () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    };
    const loanChannel = safeChannel(`friend-wardrobe-loans-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `owner_id=eq.${userId}` }, invalidateLoanRequests)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `requester_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();

    return () => {
      void supabase.removeChannel(loanChannel);
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
      updateLoanRequestStatus(requireUserId(userId, "loan_request_status_update"), loanRequest, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (error, variables) => {
      captureError(error, { area: "loan_request_status_update", status: variables.status });
    },
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const invalidateLoanRequests = () => {
      void queryClient.invalidateQueries({ queryKey: ["loan-requests", userId] });
    };
    const loanRequestsChannel = safeChannel(`loan-requests-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `owner_id=eq.${userId}` }, invalidateLoanRequests)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests", filter: `requester_id=eq.${userId}` }, invalidateLoanRequests)
      .subscribe();

    return () => {
      void supabase.removeChannel(loanRequestsChannel);
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
