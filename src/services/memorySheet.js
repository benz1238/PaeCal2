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

export const upsertDailyMemorySnapshot = async (snapshot) => {
  if (!snapshot?.userId || !snapshot?.date) {
    return { status: "skipped", reason: "missing_user_or_date" };
  }

  return await postToSheet({
    action: MEMORY_SHEET_ACTIONS.upsertDaily,
    ...snapshot,
  });
};

export const getMemorySnapshotsLast7Days = async (userId) => {
  if (!userId) return [];

  const res = await postToSheet({
    action: MEMORY_SHEET_ACTIONS.getLast7Days,
    userId,
  });

  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.memoryRows)) return res.memoryRows;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

export const get7DayMemorySummary = async (userId) => {
  try {
    const rows = await getMemorySnapshotsLast7Days(userId);
    return build7DayMemorySummary(rows);
  } catch (error) {
    console.warn("[memory] GET_MEMORY_LAST_7_DAYS failed", error?.message || error);
    return build7DayMemorySummary([]);
  }
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
    return { status: "success", snapshot, result };
  } catch (error) {
    console.warn("[memory] refreshDailyMemorySnapshot failed", error?.message || error);
    return { status: "failed", error: error?.message || String(error) };
  }
};
