import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { SPACING } from "@/constants/spacing";

interface PremiumGateProps {
  title: string;
  body: string;
}

export function PremiumGate({ title, body }: PremiumGateProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.copy}>
        <Text variant="h3">{title}</Text>
        <Text variant="body" color="secondary">
          {body}
        </Text>
      </View>
      <Button title="Premium'a Gec" onPress={() => router.push("/paywall")} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.md,
  },
  copy: {
    gap: SPACING.xs,
  },
});
