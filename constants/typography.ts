// Font family names — loaded via useFonts() in app/_layout.tsx
export const FONTS = {
  // Playfair Display — serif, başlıklar için
  displayRegular: "PlayfairDisplay_400Regular",
  displayMedium: "PlayfairDisplay_500Medium",
  displayBold: "PlayfairDisplay_700Bold",
  displayItalic: "PlayfairDisplay_400Regular_Italic",
  displayBoldItalic: "PlayfairDisplay_700Bold_Italic",

  // DM Sans — geometric sans-serif, body + UI için
  sansRegular: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansBold: "DMSans_700Bold",
  sansItalic: "DMSans_400Regular_Italic",
} as const;

export const FONT_SIZE = {
  caption: 11,
  label: 13,
  body: 15,
  h3: 17,
  h2: 22,
  h1: 28,
  display: 38,
} as const;

export const LINE_HEIGHT = {
  caption: 16,
  label: 18,
  body: 22,
  h3: 24,
  h2: 30,
  h1: 36,
  display: 46,
} as const;
