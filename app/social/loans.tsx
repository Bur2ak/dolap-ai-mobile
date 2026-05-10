import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { COLORS } from "@/constants/colors";
import { SPACING } from "@/constants/spacing";
import { useLoanRequests } from "@/hooks/useSocial";
import { captureError, captureEvent } from "@/lib/observability";
import type { LoanRequest, LoanRequestStatus } from "@/types";
import { formatDate, formatRelativeDueDate } from "@/utils/formatters";

const statusLabels: Record<LoanRequestStatus, string> = {
  pending: "Bekliyor",
  approved: "Onaylandi",
  declined: "Reddedildi",
  returned: "Iade edildi",
};

export default function LoansScreen() {
  const { loanRequests, error, isLoading, isRefetching, refetch, updateLoanRequestStatus, isUpdating, userId } = useLoanRequests();
  const incoming = loanRequests.filter((request) => request.owner_id === userId);
  const outgoing = loanRequests.filter((request) => request.requester_id === userId);
  const pendingCount = loanRequests.filter((request) => request.status === "pending").length;
  const activeCount = loanRequests.filter((request) => request.status === "approved").length;

  async function handleStatus(loanRequest: LoanRequest, status: LoanRequestStatus) {
    if (isUpdating) {
      return;
    }

    try {
      await updateLoanRequestStatus({ loanRequest, status });
      captureEvent("loan_request_status_changed", {
        loan_request_id: loanRequest.id,
        role: loanRequest.owner_id === userId ? "owner" : "requester",
        status,
      });
      Alert.alert("Guncellendi", `Odunc istegi ${statusLabels[status].toLowerCase()}.`);
    } catch (error) {
      captureError(error, { area: "loan_request_status_action", loan_request_id: loanRequest.id, status });
      Alert.alert("Guncellenemedi", error instanceof Error ? error.message : "Tekrar dene.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Odunc Takibi</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.summary}>
        <Ionicons name="swap-horizontal-outline" size={28} color={COLORS.primary} />
        <View style={styles.summaryCopy}>
          <Text variant="h3">{loanRequests.length} kayit</Text>
          <Text variant="body" color="secondary">
            Sana gelen ve senin gonderdigin odunc isteklerini takip et.
          </Text>
          <View style={styles.summaryPills}>
            <View style={styles.summaryPill}>
              <Text variant="caption" color="primary">
                Bekleyen {pendingCount}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text variant="caption" color="primary">
                Aktif {activeCount}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {isLoading ? (
        <EmptyState icon="sync-outline" title="Odunc kayitlari yukleniyor" body="Odunc isteklerin hazirlaniyor." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Odunc kayitlari yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={() => void refetch()}
        />
      ) : (
        <>
          <LoanSection
            title="Sana gelen istekler"
            empty="Sana gelen odunc istegi yok."
            items={incoming}
            currentUserId={userId}
            onStatus={handleStatus}
            loading={isUpdating}
          />
          <LoanSection
            title="Gonderdigin istekler"
            empty="Gonderdigin odunc istegi yok."
            items={outgoing}
            currentUserId={userId}
            onStatus={handleStatus}
            loading={isUpdating}
          />
        </>
      )}
    </ScrollView>
  );
}

function LoanSection({
  title,
  empty,
  items,
  currentUserId,
  onStatus,
  loading,
}: {
  title: string;
  empty: string;
  items: LoanRequest[];
  currentUserId?: string;
  onStatus: (loanRequest: LoanRequest, status: LoanRequestStatus) => Promise<void>;
  loading: boolean;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {items.length > 0 ? (
        items.map((item) => <LoanRequestRow key={item.id} loanRequest={item} currentUserId={currentUserId} onStatus={onStatus} loading={loading} />)
      ) : (
        <EmptyState icon="swap-horizontal-outline" title="Kayit yok" body={empty} />
      )}
    </Card>
  );
}

function LoanRequestRow({
  loanRequest,
  currentUserId,
  onStatus,
  loading,
}: {
  loanRequest: LoanRequest;
  currentUserId?: string;
  onStatus: (loanRequest: LoanRequest, status: LoanRequestStatus) => Promise<void>;
  loading: boolean;
}) {
  const isOwner = loanRequest.owner_id === currentUserId;
  const itemLabel = loanRequest.item?.subcategory ?? loanRequest.item?.brand ?? loanRequest.item?.category ?? "Kiyafet";
  const person = isOwner ? loanRequest.requester?.full_name ?? loanRequest.requester?.username ?? "Arkadas" : loanRequest.owner?.full_name ?? loanRequest.owner?.username ?? "Arkadas";
  const dueDateLabel = loanRequest.due_date ? `${formatDate(loanRequest.due_date)} - ${formatRelativeDueDate(loanRequest.due_date)}` : formatRelativeDueDate(null);
  const isOverdue = loanRequest.due_date ? new Date(loanRequest.due_date).getTime() < new Date().setHours(0, 0, 0, 0) : false;

  return (
    <View style={styles.loanRow}>
      <View style={styles.loanIcon}>
        <Ionicons name="shirt-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.loanCopy}>
        <Text variant="label">{itemLabel}</Text>
        <Text variant="caption" color="muted">
          {isOwner ? `${person} istiyor` : `${person} dolabindan`} - {statusLabels[loanRequest.status]}
        </Text>
        {loanRequest.status === "approved" || loanRequest.status === "pending" ? (
          <Text variant="caption" color={isOverdue ? "danger" : "secondary"}>
            Iade: {dueDateLabel}
          </Text>
        ) : null}
        {loanRequest.note ? (
          <Text variant="caption" color="muted">
            Not: {loanRequest.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.loanActions}>
        {isOwner && loanRequest.status === "pending" ? (
          <>
            <Button title="Kabul" variant="secondary" onPress={() => void onStatus(loanRequest, "approved")} loading={loading} disabled={loading} style={styles.smallButton} />
            <Button title="Red" variant="ghost" onPress={() => void onStatus(loanRequest, "declined")} loading={loading} disabled={loading} style={styles.smallButton} />
          </>
        ) : null}
        {isOwner && loanRequest.status === "approved" ? (
          <Button title="Iade" variant="secondary" onPress={() => void onStatus(loanRequest, "returned")} loading={loading} disabled={loading} style={styles.smallButton} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: 56,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 72,
  },
  summary: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  summaryCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  summaryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  summaryPill: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  section: {
    gap: SPACING.md,
  },
  loanRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  loanIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  loanCopy: {
    flex: 1,
    gap: 2,
  },
  loanActions: {
    gap: SPACING.xs,
    width: 88,
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
  },
});
