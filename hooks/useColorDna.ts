import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  analyzeColorDna,
  fetchColorDnaFromProfile,
  saveColorDnaToProfile,
  type ColorDnaResult,
} from "@/lib/api/colorDna";
import { captureError } from "@/lib/observability";
import { useAuthStore } from "@/stores/authStore";

export function useColorDna() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  const profileQuery = useQuery({
    queryKey: ["color-dna", userId],
    queryFn: () => fetchColorDnaFromProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 30,
  });

  const analyzeMutation = useMutation({
    mutationFn: async ({ imageBase64, mimeType }: { imageBase64: string; mimeType: string }) => {
      if (!userId) throw new Error("Oturum gerekli.");
      const result = await analyzeColorDna(imageBase64, mimeType);
      await saveColorDnaToProfile(userId, result);
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["color-dna", userId] });
    },
    onError: (err) => captureError(err, { area: "color_dna_analyze" }),
  });

  return {
    dna: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    analyze: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
    userId,
  };
}

export type { ColorDnaResult };
