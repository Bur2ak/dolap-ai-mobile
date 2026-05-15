import { useQuery } from "@tanstack/react-query";

import { getCurrentWeather, getForecast } from "@/lib/weather";

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

export function useEventWeather(eventDate: string | null) {
  const forecastQuery = useQuery({
    queryKey: ["event-forecast", eventDate],
    queryFn: () => getForecast(eventDate!),
    enabled: Boolean(eventDate) && isValidFutureDate(eventDate!),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return {
    weather: forecastQuery.data ?? null,
    isLoading: forecastQuery.isLoading,
  };
}

function isValidFutureDate(dateStr: string): boolean {
  const ms = new Date(dateStr).getTime();
  return Number.isFinite(ms) && ms > Date.now();
}
