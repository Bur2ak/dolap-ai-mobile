import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteDiaryEntry, fetchDiaryEntries, fetchTodayDiaryEntry, upsertDiaryEntry, type CreateDiaryEntryInput } from "@/lib/api/outfitDiary";
import { captureError } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

export function useOutfitDiary() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  const entriesQuery = useQuery({
    queryKey: ["outfit-diary", userId],
    queryFn: () => fetchDiaryEntries(userId!),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });

  const todayQuery = useQuery({
    queryKey: ["outfit-diary-today", userId],
    queryFn: () => fetchTodayDiaryEntry(userId!),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });

  const upsertMutation = useMutation({
    mutationFn: (input: CreateDiaryEntryInput) => upsertDiaryEntry(userId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outfit-diary", userId] });
      void queryClient.invalidateQueries({ queryKey: ["outfit-diary-today", userId] });
    },
    onError: (err) => captureError(err, { area: "outfit_diary_upsert" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteDiaryEntry(userId!, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outfit-diary", userId] });
      void queryClient.invalidateQueries({ queryKey: ["outfit-diary-today", userId] });
    },
    onError: (err) => captureError(err, { area: "outfit_diary_delete" }),
  });

  return {
    entries: entriesQuery.data ?? [],
    todayEntry: todayQuery.data ?? null,
    isLoading: entriesQuery.isLoading,
    isRefetching: entriesQuery.isRefetching,
    refetch: entriesQuery.refetch,
    saveEntry: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    deleteEntry: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    userId,
  };
}
