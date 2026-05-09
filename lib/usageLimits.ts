import AsyncStorage from "@react-native-async-storage/async-storage";

import { captureError } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { formatDateOnly } from "@/utils/formatters";

const dailyOutfitSuggestionPrefix = "shipirio:daily-outfit-suggestions";
const monthlyBuyDecisionPrefix = "shipirio:monthly-buy-decisions";
const dailyOutfitMetric = "daily_outfit_suggestions";
const monthlyBuyDecisionMetric = "monthly_buy_decisions";

interface DailyUsageRecord {
  date: string;
  count: number;
}

interface MonthlyUsageRecord {
  month: string;
  count: number;
}

export async function getDailyOutfitSuggestionCount(userId: string): Promise<number> {
  const remoteCount = await getRemoteUsageCount(userId, dailyOutfitMetric, getTodayKey());
  if (remoteCount !== null) {
    return remoteCount;
  }

  const record = await getDailyUsageRecord(userId);
  return record.count;
}

export async function incrementDailyOutfitSuggestionCount(userId: string): Promise<number> {
  const remoteCount = await incrementRemoteUsageCount(userId, dailyOutfitMetric, getTodayKey());
  if (remoteCount !== null) {
    await AsyncStorage.setItem(getDailyOutfitSuggestionKey(userId), JSON.stringify({ date: getTodayKey(), count: remoteCount }));
    return remoteCount;
  }

  const record = await getDailyUsageRecord(userId);
  const nextCount = record.count + 1;
  await AsyncStorage.setItem(getDailyOutfitSuggestionKey(userId), JSON.stringify({ date: getTodayKey(), count: nextCount }));
  return nextCount;
}

export async function getMonthlyBuyDecisionCount(userId: string): Promise<number> {
  const remoteCount = await getRemoteUsageCount(userId, monthlyBuyDecisionMetric, getMonthKey());
  if (remoteCount !== null) {
    return remoteCount;
  }

  const record = await getMonthlyUsageRecord(userId);
  return record.count;
}

export async function incrementMonthlyBuyDecisionCount(userId: string): Promise<number> {
  const remoteCount = await incrementRemoteUsageCount(userId, monthlyBuyDecisionMetric, getMonthKey());
  if (remoteCount !== null) {
    await AsyncStorage.setItem(getMonthlyBuyDecisionKey(userId), JSON.stringify({ month: getMonthKey(), count: remoteCount }));
    return remoteCount;
  }

  const record = await getMonthlyUsageRecord(userId);
  const nextCount = record.count + 1;
  await AsyncStorage.setItem(getMonthlyBuyDecisionKey(userId), JSON.stringify({ month: getMonthKey(), count: nextCount }));
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

    if (typeof data !== "number") {
      captureError(new Error("Usage counter read returned a non-number value."), { area: "usage_counter_read", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    return data;
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

    if (typeof data !== "number") {
      captureError(new Error("Usage counter increment returned a non-number value."), { area: "usage_counter_increment", metric, period_key: periodKey, user_id: userId });
      return null;
    }

    return data;
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
    if (parsed.date !== today || typeof parsed.count !== "number") {
      return fallback;
    }

    return { date: today, count: parsed.count };
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
    if (parsed.month !== month || typeof parsed.count !== "number") {
      return fallback;
    }

    return { month, count: parsed.count };
  } catch {
    return fallback;
  }
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
