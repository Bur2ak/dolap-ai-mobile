import { useQuery } from "@tanstack/react-query";

import { getCurrentWeather } from "@/lib/weather";

export function useWeather() {
  const weatherQuery = useQuery({
    queryKey: ["current-weather"],
    queryFn: getCurrentWeather,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  return {
    weather: weatherQuery.data ?? null,
    isLoading: weatherQuery.isLoading,
    refetch: weatherQuery.refetch,
  };
}
