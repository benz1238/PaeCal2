import { postToSheet } from "./sheet.js";
import { build7DayMemorySummary, buildDailyMemorySnapshot } from "../utils/memory.js";

const MEMORY_SHEET_ACTIONS = {
  upsertDaily: "UPSERT_DAILY_MEMORY",
  getLast7Days: "GET_MEMORY_LAST_7_DAYS",
};

export const getTodayDateString = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const warnMemoryFailure = (label, error) => {
  console.warn(`[memory] ${label} skipped`, {
    action: error?.action,
    message: error?.message || String(error),
    preview: error?.preview,
  });
};

export const upsertDailyMemorySnapshot = async (snapshot) => {
  if (!snapshot?.userId || !snapshot?.date) {
    return { status: "skipped", reason: "missing_user_or_date" };
  }

  try {
    return await postToSheet({
      action: MEMORY_SHEET_ACTIONS.upsertDaily,
      ...snapshot,
    });
  } catch (error) {
    warnMemoryFailure("UPSERT_DAILY_MEMORY", error);
    return { status: "skipped", reason: "sheet_unavailable" };
  }
};

export const getMemorySnapshotsLast7Days = async (userId) => {
  if (!userId) return [];

  try {
    const res = await postToSheet({
      action: MEMORY_SHEET_ACTIONS.getLast7Days,
      userId,
    });

    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.rows)) return res.rows;
    if (Array.isArray(res?.memoryRows)) return res.memoryRows;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  } catch (error) {
    warnMemoryFailure("GET_MEMORY_LAST_7_DAYS", error);
    return [];
  }
};

export const get7DayMemorySummary = async (userId) => {
  const rows = await getMemorySnapshotsLast7Days(userId);
  return build7DayMemorySummary(rows);
};

export const refreshDailyMemorySnapshot = async ({ userId, summary = {}, meals = [], fallbackMeal = null } = {}) => {
  try {
    const snapshot = buildDailyMemorySnapshot({
      userId,
      date: getTodayDateString(),
      summary,
      meals,
      fallbackMeal,
    });

    if (!snapshot.mealCount && !snapshot.totalKcal) {
      return { status: "skipped", reason: "no_food_data", snapshot };
    }

    const result = await upsertDailyMemorySnapshot(snapshot);
    return { status: result?.status === "skipped" ? "skipped" : "success", snapshot, result };
  } catch (error) {
    warnMemoryFailure("refreshDailyMemorySnapshot", error);
    return { status: "skipped", reason: "memory_build_failed" };
  }
};
