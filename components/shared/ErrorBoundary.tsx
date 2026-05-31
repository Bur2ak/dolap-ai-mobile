import { Component, type ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { captureError } from "@/lib/observability";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Global hata sınırı — tek bir render hatası tüm uygulamayı beyaz ekrana düşürmesin.
 * Hata Sentry'ye gider, kullanıcıya nazik bir kurtarma ekranı gösterilir.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    captureError(error, { area: "react_error_boundary", component_stack: info.componentStack?.slice(0, 500) });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Ionicons name="refresh-circle-outline" size={48} color={COLORS.accentText} />
          </View>
          <Text variant="h2" style={styles.title}>Bir şeyler ters gitti</Text>
          <Text variant="body" color="secondary" style={styles.body}>
            Beklenmedik bir hata oluştu. Endişelenme, verilerin güvende.
            Tekrar deneyelim.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
            <Text variant="label" color="inverse">Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    gap: SPACING.md,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  title: { textAlign: "center" },
  body: { maxWidth: 300, textAlign: "center" },
  button: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    marginTop: SPACING.sm,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
});
