import * as Location from "expo-location";

import { publicEnv } from "@/lib/env";
import type { WeatherData } from "@/types";

export async function getCurrentWeather(): Promise<WeatherData | null> {
  const apiKey = publicEnv.openWeatherApiKey;

  if (!apiKey) {
    return null;
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const location = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = location.coords;

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=tr`,
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    description: data.weather[0]?.description ?? "belirsiz",
    icon: data.weather[0]?.icon ?? "01d",
    humidity: data.main.humidity,
    city: data.name ?? "",
  };
}
