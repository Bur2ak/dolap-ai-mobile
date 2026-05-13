import type { Season } from "@/types";
import { getCurrencyInputError } from "@/utils/formatters";

interface WardrobeMetadataInput {
  colorsText: string;
  fabric?: string;
  price: string;
  seasons: Season[];
  subcategory: string;
  usageContextText?: string;
}

export function parseColorList(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((color) => color.trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, 8);
}

export function parseUsageContextList(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, 8);
}

export function getSubcategoryInputError(value: string) {
  return value.trim().length > 80 ? "Alt kategori en fazla 80 karakter olmali." : value.trim() ? undefined : "Alt kategori gerekli.";
}

export function getColorListInputError(value: string) {
  return parseColorList(value).length > 0 ? undefined : "En az bir renk yaz.";
}

export function getUsageContextInputError(value: string) {
  return value.trim().length > 0 && parseUsageContextList(value).length === 0 ? "Kullanim alanini virgulle ayirarak yaz." : undefined;
}

export function getWardrobeMetadataInputError(input: WardrobeMetadataInput) {
  if (!input.subcategory.trim()) {
    return { message: "Alt kategori dolabinda parcayi bulmak icin gerekli.", title: "Alt kategori gerekli" };
  }

  if (input.subcategory.trim().length > 80) {
    return { message: "Alt kategori en fazla 80 karakter olmali.", title: "Alt kategori uzun" };
  }

  if (parseColorList(input.colorsText).length === 0) {
    return { message: "En az bir renk yaz. Birden fazlaysa virgulle ayirabilirsin.", title: "Renk gerekli" };
  }

  if (input.seasons.length === 0) {
    return { message: "Parcanin kullanilacagi en az bir sezon sec.", title: "Sezon gerekli" };
  }

  if (input.fabric && input.fabric.trim().length > 80) {
    return { message: "Kumas bilgisi en fazla 80 karakter olmali.", title: "Kumas uzun" };
  }

  if (input.usageContextText && parseUsageContextList(input.usageContextText).some((entry) => entry.length > 40)) {
    return { message: "Kullanim alanlari 40 karakteri gecmemeli.", title: "Kullanim alani uzun" };
  }

  const priceError = getCurrencyInputError(input.price);
  if (priceError) {
    return { message: priceError, title: "Fiyat gecersiz" };
  }

  return null;
}
