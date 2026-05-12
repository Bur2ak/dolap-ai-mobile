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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
