import axios from "axios";
import { postToSheet } from "./sheet.js";
import { build7DayMemorySummary, buildDailyMemorySnapshot } from "../utils/memory.js";

const normalizeSupabaseUrl = (value = "") => String(value || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1\/?$/, "");

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MEMORY_SUPABASE_ENABLED = String(process.env.MEMORY_SUPABASE_ENABLED ?? "true").toLowerCase() !== "false";
const MEMORY_SHEET_FALLBACK_ENABLED = String(process.env.MEMORY_SHEET_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";
const MEMORY_SHEET_BACKUP_ENABLED = String(process.env.MEMORY_SHEET_BACKUP_ENABLED ?? "false").toLowerCase() === "true";

const MEMORY_SHEET_ACTIONS = {
  upsertDaily: "UPSERT_DAILY_MEMORY",
  getLast7Days: "GET_MEMORY_LAST_7_DAYS",
};

const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: Number(process.env.SUPABASE_TIMEOUT_MS || 3500),
});

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
    data: error?.response?.data,
  });
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const ensureUser = async (userId) => {
  await supabase.post("/users", [{ line_user_id: userId }], {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    params: { on_conflict: "line_user_id" },
  });
};

const toMemoryRow = (snapshot = {}) => ({
  user_id: snapshot.userId,
  memory_date: snapshot.date,
  meal_count: toNumber(snapshot.mealCount, 0),
  total_kcal: toNumber(snapshot.totalKcal, 0),
  total_carb: toNumber(snapshot.totalCarb, 0),
  total_protein: toNumber(snapshot.totalProtein, 0),
  total_fat: toNumber(snapshot.totalFat, 0),
  total_sugar: toNumber(snapshot.totalSugar, 0),
  summary: snapshot.summary || snapshot || {},
  meals: Array.isArray(snapshot.meals) ? snapshot.meals : [],
  updated_at: new Date().toISOString(),
});

const fromMemoryRow = (row = {}) => ({
  userId: row.user_id,
  date: row.memory_date,
  mealCount: toNumber(row.meal_count, 0),
  totalKcal: toNumber(row.total_kcal, 0),
  totalCarb: toNumber(row.total_carb, 0),
  totalProtein: toNumber(row.total_protein, 0),
  totalFat: toNumber(row.total_fat, 0),
  totalSugar: toNumber(row.total_sugar, 0),
  summary: row.summary || {},
  meals: Array.isArray(row.meals) ? row.meals : [],
});

const backupToSheet = (payload) => {
  if (!MEMORY_SHEET_BACKUP_ENABLED) return;
  postToSheet(payload).catch((error) => warnMemoryFailure("sheetBackup", error));
};

export const upsertDailyMemorySnapshot = async (snapshot) => {
  if (!snapshot?.userId || !snapshot?.date) {
    return { status: "skipped", reason: "missing_user_or_date" };
  }

  if (MEMORY_SUPABASE_ENABLED && isSupabaseConfigured()) {
    try {
      await ensureUser(snapshot.userId);
      const row = toMemoryRow(snapshot);
      await supabase.post("/memory_snapshots", [row], {
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        params: { on_conflict: "user_id,memory_date" },
      });
      backupToSheet({ action: MEMORY_SHEET_ACTIONS.upsertDaily, ...snapshot });
      return { status: "success", source: "supabase" };
    } catch (error) {
      warnMemoryFailure("UPSERT_DAILY_MEMORY_SUPABASE", error);
      if (!MEMORY_SHEET_FALLBACK_ENABLED) return { status: "skipped", reason: "supabase_unavailable" };
    }
  }

  if (!MEMORY_SHEET_FALLBACK_ENABLED) return { status: "skipped", reason: "sheet_disabled" };

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

  if (MEMORY_SUPABASE_ENABLED && isSupabaseConfigured()) {
    try {
      const res = await supabase.get("/memory_snapshots", {
        params: {
          user_id: `eq.${userId}`,
          select: "user_id,memory_date,meal_count,total_kcal,total_carb,total_protein,total_fat,total_sugar,summary,meals",
          order: "memory_date.desc",
          limit: 7,
        },
      });
      return Array.isArray(res.data) ? res.data.map(fromMemoryRow) : [];
    } catch (error) {
      warnMemoryFailure("GET_MEMORY_LAST_7_DAYS_SUPABASE", error);
      if (!MEMORY_SHEET_FALLBACK_ENABLED) return [];
    }
  }

  if (!MEMORY_SHEET_FALLBACK_ENABLED) return [];

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
