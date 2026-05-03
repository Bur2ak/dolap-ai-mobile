import { create } from "zustand";

import type { ClothingCategory, Season } from "@/types";

interface WardrobeState {
  category: ClothingCategory | "all";
  season: Season | "all";
  search: string;
  setCategory: (category: ClothingCategory | "all") => void;
  setSeason: (season: Season | "all") => void;
  setSearch: (search: string) => void;
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  category: "all",
  season: "all",
  search: "",
  setCategory: (category) => set({ category }),
  setSeason: (season) => set({ season }),
  setSearch: (search) => set({ search }),
}));
