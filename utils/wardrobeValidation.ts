import type { Season } from "@/types";
import { getCurrencyInputError } from "@/utils/formatters";

interface WardrobeMetadataInput {
  colorsText: string;
  price: string;
  seasons: Season[];
  subcategory: string;
}

export function parseColorList(value: string) {
  return value
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

export function getSubcategoryInputError(value: string) {
  return value.trim() ? undefined : "Alt kategori gerekli.";
}

export function getColorListInputError(value: string) {
  return parseColorList(value).length > 0 ? undefined : "En az bir renk yaz.";
}

export function getWardrobeMetadataInputError(input: WardrobeMetadataInput) {
  if (!input.subcategory.trim()) {
    return { message: "Alt kategori dolabinda parcayi bulmak icin gerekli.", title: "Alt kategori gerekli" };
  }

  if (parseColorList(input.colorsText).length === 0) {
    return { message: "En az bir renk yaz. Birden fazlaysa virgulle ayirabilirsin.", title: "Renk gerekli" };
  }

  if (input.seasons.length === 0) {
    return { message: "Parcanin kullanilacagi en az bir sezon sec.", title: "Sezon gerekli" };
  }

  const priceError = getCurrencyInputError(input.price);
  if (priceError) {
    return { message: priceError, title: "Fiyat gecersiz" };
  }

  return null;
}
