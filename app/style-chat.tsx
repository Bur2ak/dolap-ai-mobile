"use client";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { invokeFunctionWithRetry } from "@/lib/api/functions";
import { captureError, captureEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const STARTERS = [
  "Bugün ne giyeyim?",
  "Düğün için ne önerirsin?",
  "Sade ama şık bir iş kombini?",
  "Dolapta en çok ne kullanmıyorum?",
];

export default function StyleChatScreen() {
  const { session } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    captureEvent("style_chat_opened");
    loadHistory();
  }, []);

  async function loadHistory() {
    if (!session?.user.id) return;
    const { data } = await supabase
      .from("style_chat_history")
      .select("id, role, content, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (data && data.length > 0) {
      setMessages(data.map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        ts: new Date(row.created_at).getTime(),
      })));
    } else {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Merhaba! Ben Shipirio Style Asistanın 👋 Dolabını tam olarak biliyorum. Ne giymek istiyorsun veya hangi konuda yardımcı olayım?",
        ts: Date.now(),
      }]);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const data = await invokeFunctionWithRetry<{ reply: string }>("style-chat", { message: trimmed, history });
      const reply = data?.reply ?? "Üzgünüm, şu an yanıt veremiyorum.";
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: reply, ts: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
      captureEvent("style_chat_message_sent", { message_length: trimmed.length });
    } catch (err) {
      captureError(err, { area: "style_chat_send" });
      Alert.alert("Yanıt alınamadı", "Tekrar dene.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatarDot} />
          <View>
            <Text variant="label">Style Asistanı</Text>
            <Text variant="caption" color="muted">Dolabını biliyor</Text>
          </View>
        </View>
        <Pressable onPress={() => {
          setMessages([]);
          captureEvent("style_chat_cleared");
        }}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.textMuted} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
            <Text
              variant="body"
              color={item.role === "user" ? "inverse" : "primary"}
              style={item.role === "user" ? styles.bubbleUserText : undefined}
            >
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={isSending ? (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <Text variant="caption" color="muted">Yazıyor…</Text>
          </View>
        ) : null}
      />

      {/* Starter chips — show when no user messages yet */}
      {messages.filter((m) => m.role === "user").length === 0 && (
        <View style={styles.starters}>
          {STARTERS.map((s) => (
            <Pressable key={s} style={styles.starterChip} onPress={() => void send(s)}>
              <Text variant="caption" color="secondary">{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Bir şey sor…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
          editable={!isSending}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={() => void send(input)}
          disabled={!input.trim() || isSending}
        >
          <Ionicons name="send" size={18} color={COLORS.surface} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    alignItems: "center",
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: "center", flexDirection: "row", gap: SPACING.sm, flex: 1 },
  avatarDot: { backgroundColor: COLORS.primary, borderRadius: 999, height: 36, width: 36 },
  list: { gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.xl },
  bubble: {
    borderRadius: 18,
    maxWidth: "80%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleUserText: { color: COLORS.surface },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  starters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  starterChip: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  inputRow: {
    alignItems: "flex-end",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    color: COLORS.text,
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sendBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
