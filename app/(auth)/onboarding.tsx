import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { getSafeInternalReturnTo } from "@/lib/routeParams";

const slides = [
  {
    title: "Dolabini dijitallestir",
    body: "Kiyafetlerini fotografla, AI kategori, renk ve sezon bilgilerini otomatik cikarsin.",
  },
  {
    title: "Her gun kombin bul",
    body: "Hava durumu, etkinlik ve ruh haline gore gardirobundan uygulanabilir oneriler al.",
  },
  {
    title: "Alisverisini zekice yonet",
    body: "Yeni bir parca almadan once dolabindaki benzerleri ve kombin potansiyelini gor.",
  },
];

export default function OnboardingScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeInternalReturnTo(returnToParam);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text variant="display">Shipirio</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          Gardirobunu anlayan, kombinleyen ve satin alma kararlarini sadelestiren mobil stil asistani.
        </Text>
      </View>

      <View style={styles.slides}>
        {slides.map((slide, index) => (
          <Card key={slide.title} style={styles.slide}>
            <Text variant="caption" color="muted">
              0{index + 1}
            </Text>
            <Text variant="h3">{slide.title}</Text>
            <Text variant="body" color="secondary">
              {slide.body}
            </Text>
          </Card>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          title="Kayit Ol"
          onPress={() =>
            router.push({
              pathname: "/(auth)/register",
              params: returnTo ? { returnTo } : undefined,
            })
          }
        />
        <Button
          title="Giris Yap"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/(auth)/login",
              params: returnTo ? { returnTo } : undefined,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    paddingTop: 72,
  },
  hero: {
    gap: SPACING.sm,
  },
  subtitle: {
    maxWidth: 340,
  },
  slides: {
    flex: 1,
    justifyContent: "center",
    gap: SPACING.md,
  },
  slide: {
    gap: SPACING.xs,
  },
  actions: {
    gap: SPACING.sm,
  },
});
