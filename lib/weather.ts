import * as Location from "expo-location";

import { publicEnv } from "@/lib/env";
import { captureError } from "@/lib/observability";
import type { WeatherData } from "@/types";

export async function getCurrentWeather(): Promise<WeatherData | null> {
  const apiKey = publicEnv.openWeatherApiKey;

  if (!apiKey) {
    return null;
  }

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    const params = new URLSearchParams({
      appid: apiKey,
      lang: "tr",
      lat: String(latitude),
      lon: String(longitude),
      units: "metric",
    });

    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`);

    if (!response.ok) {
      captureError(new Error(`OpenWeather ${response.status}`), { area: "weather_fetch", status: response.status });
      return null;
    }

    const data = await response.json();
    const temp = getNumber(data?.main?.temp);
    const feelsLike = getNumber(data?.main?.feels_like);
    const humidity = getNumber(data?.main?.humidity);

    if (temp === null || feelsLike === null || humidity === null) {
      captureError(new Error("OpenWeather payload eksik."), { area: "weather_parse" });
      return null;
    }

    return {
      city: typeof data.name === "string" ? data.name : "",
      description: typeof data.weather?.[0]?.description === "string" ? data.weather[0].description : "belirsiz",
      feels_like: Math.round(feelsLike),
      humidity: Math.round(humidity),
      icon: typeof data.weather?.[0]?.icon === "string" ? data.weather[0].icon : "01d",
      temp: Math.round(temp),
    };
  } catch (error) {
    captureError(error, { area: "weather_current" });
    return null;
  }
}

export async function getForecast(targetDate: string): Promise<WeatherData | null> {
  const apiKey = publicEnv.openWeatherApiKey;
  if (!apiKey) return null;

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    const params = new URLSearchParams({
      appid: apiKey,
      lang: "tr",
      lat: String(latitude),
      lon: String(longitude),
      units: "metric",
      cnt: "40",
    });

    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${params.toString()}`);
    if (!response.ok) return null;

    const data = await response.json();
    const list: unknown[] = Array.isArray(data?.list) ? data.list : [];
    const targetMs = new Date(targetDate).getTime();

    if (!Number.isFinite(targetMs) || list.length === 0) return getCurrentWeather();

    const closest = list.reduce<{ entry: unknown; diff: number } | null>((best, entry) => {
      const entryMs = typeof (entry as Record<string, unknown>).dt === "number"
        ? ((entry as Record<string, unknown>).dt as number) * 1000
        : NaN;
      if (!Number.isFinite(entryMs)) return best;
      const diff = Math.abs(entryMs - targetMs);
      return best === null || diff < best.diff ? { entry, diff } : best;
    }, null);

    if (!closest) return getCurrentWeather();

    const entry = closest.entry as Record<string, unknown>;
    const main = entry.main as Record<string, unknown> | undefined;
    const weatherArr = entry.weather as Array<Record<string, unknown>> | undefined;
    const temp = getNumber(main?.temp);
    const feelsLike = getNumber(main?.feels_like);
    const humidity = getNumber(main?.humidity);
    if (temp === null || feelsLike === null || humidity === null) return getCurrentWeather();

    return {
      city: typeof data.city?.name === "string" ? data.city.name : "",
      description: typeof weatherArr?.[0]?.description === "string" ? weatherArr[0].description : "belirsiz",
      feels_like: Math.round(feelsLike),
      humidity: Math.round(humidity),
      icon: typeof weatherArr?.[0]?.icon === "string" ? weatherArr[0].icon : "01d",
      temp: Math.round(temp),
    };
  } catch (error) {
    captureError(error, { area: "weather_forecast" });
    return null;
  }
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
