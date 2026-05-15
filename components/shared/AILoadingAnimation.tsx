import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { Text } from "@/components/ui/Text";

interface AILoadingAnimationProps {
  message?: string;
  subMessages?: string[];
}

const defaultSubMessages = [
  "Dolabın taranıyor...",
  "Renkler analiz ediliyor...",
  "Kombinler hesaplanıyor...",
  "Son dokunuşlar yapılıyor...",
];

export function AILoadingAnimation({ message = "AI düşünüyor", subMessages = defaultSubMessages }: AILoadingAnimationProps) {
  const [subIndex, setSubIndex] = useState(0);
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function animateDot(dot: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      );
    }

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubIndex((prev) => (prev + 1) % subMessages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [subMessages.length]);

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, index) => (
          <Animated.View key={index} style={[styles.dot, { opacity: dot }]} />
        ))}
      </View>
      <Text variant="h3" style={styles.message}>
        {message}
      </Text>
      <Text variant="body" color="secondary" style={styles.sub}>
        {subMessages[subIndex]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  dots: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  dot: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  message: {
    textAlign: "center",
  },
  sub: {
    minHeight: 22,
    textAlign: "center",
  },
});
