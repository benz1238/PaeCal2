import axios from "axios";
import { postToSheet } from "./sheet.js";
import { extractFoodTermCandidates, normalizeFoodText } from "../utils/foodTermNormalizer.js";

const normalizeSupabaseUrl = (value = "") => String(value || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1\/?$/, "");

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_READ_ENABLED = String(process.env.SUPABASE_RICH_MENU_ENABLED ?? "true").toLowerCase() !== "false";
const SUPABASE_DUAL_WRITE_ENABLED = String(process.env.SUPABASE_DUAL_WRITE_ENABLED ?? "true").toLowerCase() !== "false";
const SHEET_DUAL_WRITE_ENABLED = String(process.env.SHEET_DUAL_WRITE_ENABLED ?? "false").toLowerCase() === "true";
const SHEET_READ_FALLBACK_ENABLED = String(process.env.SHEET_READ_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";
const SHEET_DELETE_FALLBACK_ENABLED = String(process.env.SHEET_DELETE_FALLBACK_ENABLED ?? "false").toLowerCase() === "true";
const FOOD_TERM_LEARNING_ENABLED = String(process.env.FOOD_TERM_LEARNING_ENABLED ?? "true").toLowerCase() !== "false";

const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
const isSupabaseReadReady = () => Boolean(SUPABASE_READ_ENABLED && isSupabaseConfigured());
const isSupabaseWriteReady = () => Boolean(SUPABASE_DUAL_WRITE_ENABLED && isSupabaseConfigured());
const isSupabaseDeleteReady = () => isSupabaseConfigured();

const bangkokDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const buildSupabaseClient = () => axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY || "",
    Authorization: `Bearer ${SUPABASE_KEY || ""}`,
    "Content-Type": "application/json",
  },
  timeout: Number(process.env.SUPABASE_TIMEOUT_MS || 3500),
});

const supabase = buildSupabaseClient();
const sheetFallback = async (payload) => postToSheet(payload);

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const parseJsonSafely = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const sum = (rows, key) => rows.reduce((total, row) => total + toNumber(row?.[key], 0), 0);

const isMissingColumnError = (err) => {
  const data = err?.response?.data || {};
  const message = String(data.message || err?.message || "");
  return (
    data.code === "PGRST204" ||
    data.code === "42703" ||
    /Could not find .* column|schema cache|column .* does not exist/i.test(message)
  );
};

const fireAndForgetSheet = (payload, label = "sheetBackup") => {
  if (!SHEET_DUAL_WRITE_ENABLED) return;
  sheetFallback(payload)
    .then(() => console.log(`[PaeCalDB] ${label} ok`))
    .catch((err) => console.warn(`[PaeCalDB] ${label} failed`, err?.message || err));
};

const ensureUser = async ({ userId, name = "", title = "", goal = "", calorieTarget = null, stats = "" } = {}) => {
  if (!userId) throw new Error("Missing userId for ensureUser");
  const profileRaw = stats ? { stats } : undefined;
  const payload = {
    line_user_id: userId,
    ...(name ? { display_name: name } : {}),
    ...(title ? { title } : {}),
    ...(goal ? { goal } : {}),
    ...(calorieTarget ? { calorie_target: Math.round(toNumber(calorieTarget, 2050)) } : {}),
    ...(profileRaw ? { profile: profileRaw } : {}),
  };
  try {
    await supabase.post("/users", [payload], {
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      params: { on_conflict: "line_user_id" },
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const minimalPayload = { ...payload };
    delete minimalPayload.profile;
    await supabase.post("/users", [minimalPayload], {
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      params: { on_conflict: "line_user_id" },
    });
  }
};

export const dbStatus = () => ({
  supabaseReadEnabled: SUPABASE_READ_ENABLED,
  supabaseDualWriteEnabled: SUPABASE_DUAL_WRITE_ENABLED,
  supabaseConfigured: isSupabaseConfigured(),
  supabaseReadReady: isSupabaseReadReady(),
  supabaseWriteReady: isSupabaseWriteReady(),
  supabaseDeleteReady: isSupabaseDeleteReady(),
  sheetDualWriteEnabled: SHEET_DUAL_WRITE_ENABLED,
  sheetReadFallbackEnabled: SHEET_READ_FALLBACK_ENABLED,
  sheetDeleteFallbackEnabled: SHEET_DELETE_FALLBACK_ENABLED,
  foodTermLearningEnabled: FOOD_TERM_LEARNING_ENABLED,
});

export const getSession = async (userId) => {
  if (isSupabaseConfigured()) {
    try {
      const res = await supabase.get("/user_sessions", {
        params: { user_id: `eq.${userId}`, select: "user_id,step,data,updated_at", limit: 1 },
      });
      const row = Array.isArray(res.data) ? res.data[0] : null;
      if (row) return { status: "success", source: "supabase", step: row.step || "READY", data: row.data || {}, updatedAt: row.updated_at };
      await ensureUser({ userId });
      return { status: "not_found", source: "supabase", step: "READY", data: {} };
    } catch (err) {
      console.warn("[PaeCalDB] GET_SESSION Supabase failed", err?.response?.data || err.message || err);
    }
  }
  const sheet = await sheetFallback({ action: "GET_SESSION", userId });
  return { step: sheet?.step || "READY", data: sheet?.data || {}, ...(sheet || {}), source: "sheet" };
};

export const updateSession = async ({ userId, step = "READY", sessionData = {} }) => {
  if (isSupabaseConfigured()) {
    try {
      await ensureUser({ userId, name: sessionData?.name, title: sessionData?.title, goal: sessionData?.goal, calorieTarget: sessionData?.calorieTarget, stats: sessionData?.stats });
      const res = await supabase.post(
        "/user_sessions",
        [{ user_id: userId, step, data: sessionData, updated_at: new Date().toISOString() }],
        { headers: { Prefer: "resolution=merge-duplicates,return=representation" }, params: { on_conflict: "user_id" } }
      );
      fireAndForgetSheet({ action: "UPDATE_SESSION", userId, step, sessionData }, "UPDATE_SESSION sheetBackup");
      return { status: "success", source: "supabase", ...(Array.isArray(res.data) ? res.data[0] : {}) };
    } catch (err) {
      console.error("[PaeCalDB] UPDATE_SESSION Supabase failed", err?.response?.data || err.message || err);
    }
  }
  const sheet = await sheetFallback({ action: "UPDATE_SESSION", userId, step, sessionData });
  return { ...(sheet || {}), source: "sheet" };
};

export const getProfile = async (userId) => {
  if (isSupabaseConfigured()) {
    try {
      let res;
      try {
        res = await supabase.get("/users", {
          params: { line_user_id: `eq.${userId}`, select: "line_user_id,display_name,title,goal,calorie_target,profile", limit: 1 },
        });
      } catch (err) {
        if (!isMissingColumnError(err)) throw err;
        console.warn("[PaeCalDB] GET_PROFILE using minimal users select because profile column is missing");
        res = await supabase.get("/users", {
          params: { line_user_id: `eq.${userId}`, select: "line_user_id,display_name,title,goal,calorie_target", limit: 1 },
        });
      }
      const row = Array.isArray(res.data) ? res.data[0] : null;
      if (row) return { status: "success", source: "supabase", name: row.display_name || "", title: row.title || "", stats: row.profile?.stats || "", goal: row.goal || "", calorieTarget: toNumber(row.calorie_target, 2050) };
      return { status: "not_found", source: "supabase" };
    } catch (err) {
      console.warn("[PaeCalDB] GET_PROFILE Supabase failed", err?.response?.data || err.message || err);
      return { status: "not_found", source: "supabase_error" };
    }
  }
  const sheet = await sheetFallback({ action: "GET_PROFILE", userId });
  return { ...(sheet || {}), source: "sheet" };
};

export const saveProfile = async ({ userId, name = "", title = "", stats = "", goal = "", calorieTarget = 2050 } = {}) => {
  if (isSupabaseConfigured()) {
    try {
      await ensureUser({ userId, name, title, stats, goal, calorieTarget });
      await updateSession({ userId, step: "READY", sessionData: { name, title, stats, goal, calorieTarget } });
      fireAndForgetSheet({ action: "SAVE_PROFILE", userId, name, title, stats, goal, calorieTarget }, "SAVE_PROFILE sheetBackup");
      return { status: "success", source: "supabase", name, title, stats, goal, calorieTarget };
    } catch (err) {
      console.warn("[PaeCalDB] SAVE_PROFILE Supabase failed", err?.response?.data || err.message || err);
    }
  }
  const sheet = await sheetFallback({ action: "SAVE_PROFILE", userId, name, title, stats, goal, calorieTarget });
  return { ...(sheet || {}), source: "sheet" };
};

const fetchMealsFull = async (userId, today) => supabase.get("/meals", {
  params: { user_id: `eq.${userId}`, meal_date: `eq.${today}`, select: "id,menu_name,kcal,carb,protein,fat,sugar,portion_level,portion_label,portion_note,confidence,source,created_at,raw", order: "created_at.desc" },
});

const fetchMealsMinimal = async (userId, today) => supabase.get("/meals", {
  params: { user_id: `eq.${userId}`, meal_date: `eq.${today}`, select: "id,menu_name,kcal,carb,protein,fat,sugar,source,created_at,raw", order: "created_at.desc" },
});

export const getDailySummary = async (userId, { allowSheetFallback = true } = {}) => {
  if (!isSupabaseReadReady()) {
    if (!allowSheetFallback) return { status: "error", source: "supabase_read_disabled" };
    const sheet = await sheetFallback({ action: "GET_DAILY_SUMMARY", userId });
    return { ...(sheet || {}), source: "sheet" };
  }
  try {
    const today = bangkokDate();
    const userPromise = supabase.get("/users", { params: { line_user_id: `eq.${userId}`, select: "line_user_id,display_name,title,goal,calorie_target", limit: 1 } });
    let mealRes;
    try { mealRes = await fetchMealsFull(userId, today); }
    catch (err) {
      if (!isMissingColumnError(err)) throw err;
      console.warn("[PaeCalDB] GET_DAILY_SUMMARY using minimal meals select because migration is incomplete");
      mealRes = await fetchMealsMinimal(userId, today);
    }
    const userRes = await userPromise;
    const user = Array.isArray(userRes.data) ? userRes.data[0] : null;
    const meals = Array.isArray(mealRes.data) ? mealRes.data : [];
    const topMeal = [...meals].sort((a, b) => toNumber(b.kcal) - toNumber(a.kcal))[0] || null;
    if (meals.length === 0 && SHEET_READ_FALLBACK_ENABLED && allowSheetFallback) {
      const sheet = await sheetFallback({ action: "GET_DAILY_SUMMARY", userId });
      const sheetTotal = toNumber(sheet?.todayCalories ?? sheet?.totalToday, 0);
      const sheetMealCount = toNumber(sheet?.mealCount, 0);
      if (sheetTotal > 0 || sheetMealCount > 0) return { ...(sheet || {}), source: "supabase_empty_sheet_fallback" };
    }
    return {
      status: "success", source: "supabase", date: today, userId,
      name: user?.display_name || "", displayName: user?.display_name || "", title: user?.title || user?.display_name || "ลื้อ", goal: user?.goal || "", calorieTarget: toNumber(user?.calorie_target, 2050),
      todayCalories: sum(meals, "kcal"), totalToday: sum(meals, "kcal"), totalCarb: sum(meals, "carb"), totalProtein: sum(meals, "protein"), totalFat: sum(meals, "fat"), totalSugar: sum(meals, "sugar"), mealCount: meals.length,
      topMealName: topMeal?.menu_name || "", topMealKcal: topMeal?.kcal || 0,
      meals: meals.map((meal) => ({ id: meal.id, menuName: meal.menu_name, kcal: meal.kcal, carb: meal.carb, protein: meal.protein, fat: meal.fat, sugar: meal.sugar, portionLevel: meal.portion_level || meal.raw?.portionLevel || "normal", portionLabel: meal.portion_label || meal.raw?.portionLabel || "พอดี", portionNote: meal.portion_note || meal.raw?.portionNote || "", confidence: meal.confidence || meal.raw?.confidence || "medium", source: meal.source, createdAt: meal.created_at, raw: meal.raw })),
    };
  } catch (err) {
    console.error("[PaeCalDB] GET_DAILY_SUMMARY Supabase failed", err?.response?.data || err.message || err);
    if (!SHEET_READ_FALLBACK_ENABLED || !allowSheetFallback) return { status: "error", source: "supabase_read_failed" };
    const sheet = await sheetFallback({ action: "GET_DAILY_SUMMARY", userId });
    return { ...(sheet || {}), source: "sheet" };
  }
};

const buildMealPayload = (payload = {}, { minimal = false } = {}) => {
  const items = parseJsonSafely(payload.itemsJson, []);
  const raw = { requestId: payload.requestId || "", items, itemsJson: payload.itemsJson || "", note: payload.note || "", imageSubject: payload.imageSubject || "", imageCaption: payload.imageCaption || "", portionLevel: normalizeText(payload.portionLevel, "normal"), portionLabel: normalizeText(payload.portionLabel, "พอดี"), portionNote: normalizeText(payload.portionNote, ""), confidence: normalizeText(payload.confidence, "medium") };
  const base = { user_id: payload.userId, meal_date: bangkokDate(), menu_name: normalizeText(payload.menuName, "อาหาร"), kcal: toNumber(payload.kcal, 0), carb: toNumber(payload.carb, 0), protein: toNumber(payload.protein, 0), fat: toNumber(payload.fat, 0), sugar: toNumber(payload.sugar, 0), source: normalizeText(payload.source, "line"), raw };
  if (minimal) return base;
  return { ...base, portion_level: raw.portionLevel, portion_label: raw.portionLabel, portion_note: raw.portionNote, confidence: raw.confidence };
};

const writeMealToSupabase = async (payload = {}) => {
  const userId = payload.userId;
  if (!userId) throw new Error("Missing userId for Supabase meal write");
  await ensureUser({ userId, name: payload.name, title: payload.title, goal: payload.goal, calorieTarget: payload.calorieTarget });
  try {
    const res = await supabase.post("/meals", [buildMealPayload(payload)], { headers: { Prefer: "return=representation" } });
    return { status: "success", source: "supabase", schemaMode: "full", meal: Array.isArray(res.data) ? res.data[0] : null };
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    console.warn("[PaeCalDB] LOG_FOOD using minimal meal payload because migration is incomplete");
    const res = await supabase.post("/meals", [buildMealPayload(payload, { minimal: true })], { headers: { Prefer: "return=representation" } });
    return { status: "success", source: "supabase", schemaMode: "minimal", meal: Array.isArray(res.data) ? res.data[0] : null };
  }
};

export const logFood = async (payload = {}) => {
  if (isSupabaseWriteReady()) {
    try {
      const writeResult = await writeMealToSupabase(payload);
      fireAndForgetSheet({ action: "LOG_FOOD", ...payload }, "LOG_FOOD sheetBackup");
      const summary = await getDailySummary(payload.userId);
      console.log(`[PaeCalDB] LOG_FOOD supabase-first ok menu=${payload.menuName || ""} kcal=${payload.kcal || 0} portion=${payload.portionLevel || ""} schema=${writeResult.schemaMode}`);
      return { ...(summary || {}), source: "supabase", supabaseWrite: "success", supabaseSchemaMode: writeResult.schemaMode, supabaseMealId: writeResult.meal?.id || "" };
    } catch (err) { console.error("[PaeCalDB] LOG_FOOD Supabase-first failed", err?.response?.data || err.message || err); }
  }
  const sheetResult = await sheetFallback({ action: "LOG_FOOD", ...payload });
  return { ...(sheetResult || {}), source: "sheet", supabaseWrite: "failed_or_skipped" };
};

export const getLastMeal = async (userId) => {
  if (isSupabaseConfigured()) {
    try {
      const today = bangkokDate();
      const res = await supabase.get("/meals", {
        params: { user_id: `eq.${userId}`, meal_date: `eq.${today}`, select: "id,menu_name,kcal,carb,protein,fat,sugar,created_at,raw", order: "created_at.desc", limit: 1 },
      });
      const row = Array.isArray(res.data) ? res.data[0] : null;
      if (!row) return { status: "not_found", source: "supabase", meal: null };
      return { status: "success", source: "supabase", meal: { id: row.id, menuName: row.menu_name, kcal: row.kcal, carb: row.carb, protein: row.protein, fat: row.fat, sugar: row.sugar, createdAt: row.created_at, raw: row.raw } };
    } catch (err) {
      console.warn("[PaeCalDB] GET_LAST_MEAL Supabase failed", err?.response?.data || err.message || err);
    }
  }
  const sheet = await sheetFallback({ action: "GET_LAST_MEAL", userId });
  return { ...(sheet || {}), source: "sheet" };
};

export const updateLastMeal = async (payload = {}) => {
  const userId = payload.userId;
  if (isSupabaseConfigured() && userId) {
    try {
      const latest = await getLastMeal(userId);
      const mealId = latest?.meal?.id;
      if (!mealId) return { status: "not_found", source: "supabase" };
      const updatePayload = {};
      if (payload.menuName) updatePayload.menu_name = payload.menuName;
      if (payload.kcal !== undefined) updatePayload.kcal = toNumber(payload.kcal, 0);
      if (payload.carb !== undefined) updatePayload.carb = toNumber(payload.carb, 0);
      if (payload.protein !== undefined) updatePayload.protein = toNumber(payload.protein, 0);
      if (payload.fat !== undefined) updatePayload.fat = toNumber(payload.fat, 0);
      if (payload.sugar !== undefined) updatePayload.sugar = toNumber(payload.sugar, 0);
      if (!Object.keys(updatePayload).length) return { status: "skipped", source: "supabase", reason: "empty_update" };
      await supabase.patch("/meals", updatePayload, { params: { id: `eq.${mealId}` } });
      return { status: "success", source: "supabase", meal: { ...latest.meal, ...payload } };
    } catch (err) {
      console.warn("[PaeCalDB] UPDATE_LAST_MEAL Supabase failed", err?.response?.data || err.message || err);
    }
  }
  const sheet = await sheetFallback({ action: "UPDATE_LAST_MEAL", ...payload });
  return { ...(sheet || {}), source: "sheet" };
};

const upsertCandidate = async ({ candidate, foodData = {}, source = "openai", example = "", itemCount = 1 }) => {
  const key = candidate.canonicalKey || candidate.normalized;
  const existedRes = await supabase.get("/food_term_candidates", { params: { term: `eq.${key}`, select: "term,hit_count,examples,matched_aliases", limit: 1 } });
  const existed = Array.isArray(existedRes.data) ? existedRes.data[0] : null;
  const previousExamples = Array.isArray(existed?.examples) ? existed.examples : [];
  const previousAliases = Array.isArray(existed?.matched_aliases) ? existed.matched_aliases : [];
  const nextAliases = [...new Set([...previousAliases, ...(candidate.matchedAliases || [])])].slice(0, 20);
  const payload = {
    term: key,
    normalized_term: candidate.normalized,
    raw_term: candidate.raw || example || key,
    canonical_key: key,
    matched_aliases: nextAliases,
    item_count: itemCount,
    hit_count: existed ? toNumber(existed.hit_count, 0) + 1 : 1,
    last_menu_name: normalizeText(foodData.menuName, key),
    last_kcal: toNumber(foodData.kcal, 0),
    last_carb: toNumber(foodData.carb, 0),
    last_protein: toNumber(foodData.protein, 0),
    last_fat: toNumber(foodData.fat, 0),
    last_sugar: toNumber(foodData.sugar, 0),
    last_confidence: normalizeText(foodData.confidence, "medium"),
    last_source: source,
    examples: [...previousExamples.slice(-4), { text: example || candidate.raw || key, at: new Date().toISOString() }],
    last_seen_at: new Date().toISOString(),
  };
  await supabase.post("/food_term_candidates", [payload], { headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, params: { on_conflict: "term" } });
  console.log(`[PaeCalDB] foodTermCandidate logged key=${key} hits=${payload.hit_count}`);
};

export const logFoodTermCandidate = async ({ term, foodData = {}, source = "openai", example = "" } = {}) => {
  if (!FOOD_TERM_LEARNING_ENABLED || !isSupabaseConfigured()) return { status: "skipped", source: "disabled" };
  const candidates = extractFoodTermCandidates(term);
  if (!candidates.length) return { status: "skipped", source: "empty" };
  try {
    await Promise.all(candidates.slice(0, 8).map((candidate) => upsertCandidate({ candidate, foodData, source, example: example || term, itemCount: candidates.length })));
    return { status: "success", source: "supabase", count: candidates.length };
  } catch (err) {
    if (isMissingColumnError(err)) {
      console.warn("[PaeCalDB] foodTermCandidate skipped because migration 004 is not run yet");
      return { status: "skipped", source: "missing_migration" };
    }
    console.warn("[PaeCalDB] foodTermCandidate failed", err?.response?.data || err.message || err);
    return { status: "failed", source: "supabase" };
  }
};

export const deleteLastMeal = async (userId) => {
  if (isSupabaseDeleteReady()) {
    try {
      const today = bangkokDate();
      const lastMealRes = await supabase.get("/meals", { params: { user_id: `eq.${userId}`, meal_date: `eq.${today}`, select: "id,menu_name,kcal", order: "created_at.desc", limit: 1 } });
      const lastMeal = Array.isArray(lastMealRes.data) ? lastMealRes.data[0] : null;
      if (!lastMeal?.id) return { status: "not_found", source: "supabase" };
      await supabase.delete("/meals", { params: { id: `eq.${lastMeal.id}` } });
      return { status: "success", source: "supabase_fast_delete", deletedMeal: { id: lastMeal.id, menuName: lastMeal.menu_name, kcal: lastMeal.kcal } };
    } catch (err) {
      console.error("[PaeCalDB] DELETE_LAST_MEAL Supabase failed", err?.response?.data || err.message || err);
      if (!SHEET_DELETE_FALLBACK_ENABLED) return { status: "error", source: "supabase_delete_failed" };
    }
  }
  if (!SHEET_DELETE_FALLBACK_ENABLED) return { status: "not_found", source: "no_sheet_delete_fallback" };
  const sheet = await sheetFallback({ action: "DELETE_LAST_MEAL", userId });
  return { ...(sheet || {}), source: "sheet" };
};