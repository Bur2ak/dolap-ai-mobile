import AsyncStorage from "@react-native-async-storage/async-storage";

import { captureError } from "@/lib/observability";
import { isUuid } from "@/lib/routeParams";
import { supabase } from "@/lib/supabase";
import { formatDateOnly } from "@/utils/formatters";

const dailyOutfitSuggestionPrefix = "shipirio:daily-outfit-suggestions";
const monthlyBuyDecisionPrefix = "shipirio:monthly-buy-decisions";
const dailyOutfitMetric = "daily_outfit_suggestions";
const monthlyBuyDecisionMetric = "monthly_buy_decisions";
const maxLocalUsageCount = 10_000;

interface DailyUsageRecord {
  date: string;
  count: number;
}

interface MonthlyUsageRecord {
  month: string;
  count: number;
}

export async function getDailyOutfitSuggestionCount(userId: string): Promise<number> {
  assertUserId(userId);
  const remoteCount = await getRemoteUsageCount(userId, dailyOutfitMetric, getTodayKey());
  if (remoteCount !== null) {
    return remoteCount;
  }

  const record = await getDailyUsageRecord(userId);
  return record.count;
}

export async function incrementDailyOutfitSuggestionCount(userId: string): Promise<number> {
  assertUserId(userId);
  const remoteCount = await incrementRemoteUsageCount(userId, dailyOutfitMetric, getTodayKey());
  if (remoteCount !== null) {
    await writeUsageRecord(getDailyOutfitSuggestionKey(userId), { date: getTodayKey(), count: remoteCount }, {
      area: "usage_counter_daily_cache_write",
      metric: dailyOutfitMetric,
      user_id: userId,
    });
    return remoteCount;
  }

  const record = await getDailyUsageRecord(userId);
  const nextCount = normalizeUsageCount(record.count + 1) ?? maxLocalUsageCount;
  await writeUsageRecord(getDailyOutfitSuggestionKey(userId), { date: getTodayKey(), count: nextCount }, {
    area: "usage_counter_daily_local_write",
    metric: dailyOutfitMetric,
    user_id: userId,
  });
  return nextCount;
}

export async function getMonthlyBuyDecisionCount(userId: string): Promise<number> {
  assertUserId(userId);
  const remoteCount = await getRemoteUsageCount(userId, monthlyBuyDecisionMetric, getMonthKey());
  if (remoteCount !== null) {
    return remoteCount;
  }

  const record = await getMonthlyUsageRecord(userId);
  return record.count;
}

export async function incrementMonthlyBuyDecisionCount(userId: string): Promise<number> {
  assertUserId(userId);
  const remoteCount = await incrementRemoteUsageCount(userId, monthlyBuyDecisionMetric, getMonthKey());
  if (remoteCount !== null) {
    await writeUsageRecord(getMonthlyBuyDecisionKey(userId), { month: getMonthKey(), count: remoteCount }, {
      area: "usage_counter_monthly_cache_write",
      metric: monthlyBuyDecisionMetric,
      user_id: userId,
    });
    return remoteCount;
  }

  const record = await getMonthlyUsageRecord(userId);
  const nextCount = normalizeUsageCount(record.count + 1) ?? maxLocalUsageCount;
  await writeUsageRecord(getMonthlyBuyDecisionKey(userId), { month: getMonthKey(), count: nextCount }, {
    area: "usage_counter_monthly_local_write",
    metric: monthlyBuyDecisionMetric,
    user_id: userId,
  });
  return nextCount;
}

async function getRemoteUsageCount(userId: string, metric: string, periodKey: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc("get_usage_count", {
      input_metric: metric,
      input_period_key: periodKey,
    });

    if (error) {
      captureError(error, { area: "usage_counter_read", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    const count = normalizeUsageCount(data);
    if (count === null) {
      captureError(new Error("Usage counter read returned a non-number value."), { area: "usage_counter_read", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    return count;
  } catch (error) {
    captureError(error, { area: "usage_counter_read", metric, period_key: periodKey, user_id: userId });
    return null;
  }
}

async function incrementRemoteUsageCount(userId: string, metric: string, periodKey: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc("increment_usage_counter", {
      input_metric: metric,
      input_period_key: periodKey,
    });

    if (error) {
      captureError(error, { area: "usage_counter_increment", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    const count = normalizeUsageCount(data);
    if (count === null) {
      captureError(new Error("Usage counter increment returned a non-number value."), { area: "usage_counter_increment", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    return count;
  } catch (error) {
    captureError(error, { area: "usage_counter_increment", metric, period_key: periodKey, user_id: userId });
    return null;
  }
}

async function getDailyUsageRecord(userId: string): Promise<DailyUsageRecord> {
  const today = getTodayKey();
  const fallback = { date: today, count: 0 };
  const rawValue = await AsyncStorage.getItem(getDailyOutfitSuggestionKey(userId));
  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DailyUsageRecord>;
    const count = normalizeUsageCount(parsed.count);
    if (parsed.date !== today || count === null) {
      return fallback;
    }

    return { date: today, count };
  } catch {
    return fallback;
  }
}

async function getMonthlyUsageRecord(userId: string): Promise<MonthlyUsageRecord> {
  const month = getMonthKey();
  const fallback = { month, count: 0 };
  const rawValue = await AsyncStorage.getItem(getMonthlyBuyDecisionKey(userId));
  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<MonthlyUsageRecord>;
    const count = normalizeUsageCount(parsed.count);
    if (parsed.month !== month || count === null) {
      return fallback;
    }

    return { month, count };
  } catch {
    return fallback;
  }
}

async function writeUsageRecord(
  key: string,
  value: DailyUsageRecord | MonthlyUsageRecord,
  context: Record<string, string | number | boolean | null | undefined>,
) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    captureError(error, context);
  }
}

function normalizeUsageCount(value: unknown) {
  const count = typeof value === "number" ? value : typeof value === "string" && value.trim().length > 0 ? Number(value) : NaN;
  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.min(maxLocalUsageCount, Math.floor(count));
}

function getDailyOutfitSuggestionKey(userId: string) {
  return `${dailyOutfitSuggestionPrefix}:${userId}`;
}

function getMonthlyBuyDecisionKey(userId: string) {
  return `${monthlyBuyDecisionPrefix}:${userId}`;
}

function getTodayKey() {
  return formatDateOnly(new Date());
}

function getMonthKey() {
  return formatDateOnly(new Date()).slice(0, 7);
}

function assertUserId(value: string) {
  if (!isUuid(value)) {
    throw new Error("Oturum bilgisi gecersiz. Tekrar giris yapmayi dene.");
  }
}
