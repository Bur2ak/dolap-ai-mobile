import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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

type LoanFilter = "all" | "incoming" | "outgoing" | "overdue";

const filterOptions: Array<{ value: LoanFilter; label: string }> = [
  { value: "all", label: "Tumu" },
  { value: "incoming", label: "Gelen" },
  { value: "outgoing", label: "Giden" },
  { value: "overdue", label: "Geciken" },
];

export default function LoansScreen() {
  const { loanRequests, error, isLoading, isRefetching, refetch, updateLoanRequestStatus, isUpdating, userId } = useLoanRequests();
  const [filter, setFilter] = useState<LoanFilter>("all");
  const [activeStatusAction, setActiveStatusAction] = useState<{ id: string; status: LoanRequestStatus } | null>(null);
  const incoming = loanRequests.filter((request) => request.owner_id === userId);
  const outgoing = loanRequests.filter((request) => request.requester_id === userId);
  const pendingCount = loanRequests.filter((request) => request.status === "pending").length;
  const activeCount = loanRequests.filter((request) => request.status === "approved").length;
  const overdueCount = loanRequests.filter(isLoanOverdue).length;
  const filteredIncoming = filter === "outgoing" ? [] : filterLoanRequests(incoming, filter);
  const filteredOutgoing = filter === "incoming" ? [] : filterLoanRequests(outgoing, filter);

  useEffect(() => {
    captureEvent("loan_requests_screen_viewed", {
      total_count: loanRequests.length,
      incoming_count: incoming.length,
      outgoing_count: outgoing.length,
      pending_count: pendingCount,
      active_count: activeCount,
      filter,
      overdue_count: overdueCount,
    });
  }, [activeCount, filter, incoming.length, loanRequests.length, outgoing.length, overdueCount, pendingCount]);

  function handleFilter(nextFilter: LoanFilter) {
    if (activeStatusAction || isUpdating) {
      return;
    }

    setFilter(nextFilter);
    captureEvent("loan_requests_filter_selected", { filter: nextFilter });
  }

  function handleRefetch() {
    captureEvent("loan_requests_refetch_requested");
    void refetch();
  }

  async function handleStatus(loanRequest: LoanRequest, status: LoanRequestStatus) {
    if (activeStatusAction || isUpdating) {
      return;
    }

    setActiveStatusAction({ id: loanRequest.id, status });
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
    } finally {
      setActiveStatusAction(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button title="Geri" variant="ghost" onPress={() => router.back()} disabled={Boolean(activeStatusAction) || isUpdating} />
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
            <View style={[styles.summaryPill, overdueCount > 0 && styles.summaryPillWarning]}>
              <Text variant="caption" color={overdueCount > 0 ? "danger" : "primary"}>
                Geciken {overdueCount}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.filterRow}>
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            title={option.label}
            variant={filter === option.value ? "primary" : "secondary"}
            onPress={() => handleFilter(option.value)}
            disabled={Boolean(activeStatusAction) || isUpdating}
            style={styles.filterButton}
          />
        ))}
      </View>

      {isLoading ? (
        <EmptyState icon="sync-outline" title="Odunc kayitlari yukleniyor" body="Odunc isteklerin hazirlaniyor." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Odunc kayitlari yuklenemedi"
          body="Baglanti veya Supabase tarafinda gecici bir sorun olabilir."
          actionLabel="Tekrar Dene"
          loading={isRefetching}
          onAction={handleRefetch}
        />
      ) : (
        <>
          <LoanSection
            title="Sana gelen istekler"
            empty="Sana gelen odunc istegi yok."
            items={filteredIncoming}
            currentUserId={userId}
            onStatus={handleStatus}
            activeStatusAction={activeStatusAction}
            isUpdating={isUpdating}
          />
          <LoanSection
            title="Gonderdigin istekler"
            empty="Gonderdigin odunc istegi yok."
            items={filteredOutgoing}
            currentUserId={userId}
            onStatus={handleStatus}
            activeStatusAction={activeStatusAction}
            isUpdating={isUpdating}
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
  activeStatusAction,
  isUpdating,
}: {
  title: string;
  empty: string;
  items: LoanRequest[];
  currentUserId?: string;
  onStatus: (loanRequest: LoanRequest, status: LoanRequestStatus) => Promise<void>;
  activeStatusAction: { id: string; status: LoanRequestStatus } | null;
  isUpdating: boolean;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="h3">{title}</Text>
      {items.length > 0 ? (
        items.map((item) => (
          <LoanRequestRow
            key={item.id}
            loanRequest={item}
            currentUserId={currentUserId}
            onStatus={onStatus}
            activeStatusAction={activeStatusAction}
            isUpdating={isUpdating}
          />
        ))
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
  activeStatusAction,
  isUpdating,
}: {
  loanRequest: LoanRequest;
  currentUserId?: string;
  onStatus: (loanRequest: LoanRequest, status: LoanRequestStatus) => Promise<void>;
  activeStatusAction: { id: string; status: LoanRequestStatus } | null;
  isUpdating: boolean;
}) {
  const isOwner = loanRequest.owner_id === currentUserId;
  const itemLabel = loanRequest.item?.subcategory ?? loanRequest.item?.brand ?? loanRequest.item?.category ?? "Kiyafet";
  const person = isOwner ? loanRequest.requester?.full_name ?? loanRequest.requester?.username ?? "Arkadas" : loanRequest.owner?.full_name ?? loanRequest.owner?.username ?? "Arkadas";
  const dueDateLabel = loanRequest.due_date ? `${formatDate(loanRequest.due_date)} - ${formatRelativeDueDate(loanRequest.due_date)}` : formatRelativeDueDate(null);
  const isOverdue = isLoanOverdue(loanRequest);
  const isRowUpdating = activeStatusAction?.id === loanRequest.id;
  const isActionDisabled = Boolean(activeStatusAction) || isUpdating;

  return (
    <View style={[styles.loanRow, isOverdue && styles.loanRowOverdue]}>
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
            <Button
              title="Kabul"
              variant="secondary"
              onPress={() => void onStatus(loanRequest, "approved")}
              loading={isRowUpdating && activeStatusAction?.status === "approved"}
              disabled={isActionDisabled}
              style={styles.smallButton}
            />
            <Button
              title="Red"
              variant="ghost"
              onPress={() => void onStatus(loanRequest, "declined")}
              loading={isRowUpdating && activeStatusAction?.status === "declined"}
              disabled={isActionDisabled}
              style={styles.smallButton}
            />
          </>
        ) : null}
        {isOwner && loanRequest.status === "approved" ? (
          <Button
            title="Iade"
            variant="secondary"
            onPress={() => void onStatus(loanRequest, "returned")}
            loading={isRowUpdating && activeStatusAction?.status === "returned"}
            disabled={isActionDisabled}
            style={styles.smallButton}
          />
        ) : null}
      </View>
    </View>
  );
}

function filterLoanRequests(items: LoanRequest[], filter: LoanFilter) {
  if (filter === "incoming" || filter === "outgoing") {
    return items;
  }

  if (filter === "overdue") {
    return items.filter(isLoanOverdue);
  }

  return items;
}

function isLoanOverdue(loanRequest: LoanRequest) {
  return loanRequest.status === "approved" && loanRequest.due_date ? new Date(loanRequest.due_date).getTime() < new Date().setHours(0, 0, 0, 0) : false;
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
  summaryPillWarning: {
    backgroundColor: COLORS.dangerSoft,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
  },
  section: {
    gap: SPACING.md,
  },
  loanRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  loanRowOverdue: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 8,
    padding: SPACING.xs,
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
