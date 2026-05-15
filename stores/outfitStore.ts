import { create } from "zustand";

import type { OutfitSuggestion, WeatherData } from "@/types";

interface OutfitState {
  selectedEvent: string;
  selectedMood: string;
  focusItemId: string | null;
  suggestions: OutfitSuggestion[];
  isRecommending: boolean;
  lastWeather: WeatherData | null;
  setSelectedEvent: (event: string) => void;
  setSelectedMood: (mood: string) => void;
  setFocusItemId: (id: string | null) => void;
  setSuggestions: (suggestions: OutfitSuggestion[]) => void;
  setIsRecommending: (value: boolean) => void;
  setLastWeather: (weather: WeatherData | null) => void;
  resetSuggestions: () => void;
}

export const useOutfitStore = create<OutfitState>((set) => ({
  selectedEvent: "is",
  selectedMood: "Rahat",
  focusItemId: null,
  suggestions: [],
  isRecommending: false,
  lastWeather: null,
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setSelectedMood: (selectedMood) => set({ selectedMood }),
  setFocusItemId: (focusItemId) => set({ focusItemId }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setIsRecommending: (isRecommending) => set({ isRecommending }),
  setLastWeather: (lastWeather) => set({ lastWeather }),
  resetSuggestions: () => set({ suggestions: [] }),
}));
