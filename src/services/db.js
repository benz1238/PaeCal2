import axios from "axios";
import { postToSheet } from "./sheet.js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_READ_ENABLED = String(process.env.SUPABASE_RICH_MENU_ENABLED || "false").toLowerCase() === "true";
const SUPABASE_DUAL_WRITE_ENABLED = String(process.env.SUPABASE_DUAL_WRITE_ENABLED || "true").toLowerCase() !== "false";

const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
const isSupabaseReadReady = () => Boolean(SUPABASE_READ_ENABLED && isSupabaseConfigured());
const isSupabaseWriteReady = () => Boolean(SUPABASE_DUAL_WRITE_ENABLED && isSupabaseConfigured());

const bangkokDate = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

const buildSupabaseClient = () => axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY || "",
    Authorization: `Bearer ${SUPABASE_KEY || ""}`,
    "Content-Type": "application/json",
  },
  timeout: Number(process.env.SUPABASE_TIMEOUT_MS || 5000),
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

const sum = (rows, key) => rows.reduce((total, row) => total + toNumber(row?.[key], 0), 0);

const ensureUser = async ({ userId, name = "", title = "", goal = "", calorieTarget = null } = {}) => {
  if (!userId) throw new Error("Missing userId for ensureUser");

  const payload = {
    line_user_id: userId,
    ...(name ? { display_name: name } : {}),
    ...(title ? { title } : {}),
    ...(goal ? { goal } : {}),
    ...(calorieTarget ? { calorie_target: Math.round(toNumber(calorieTarget, 2050)) } : {}),
  };

  await supabase.post("/users", [payload], {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    params: { on_conflict: "line_user_id" },
  });
};

export const dbStatus = () => ({
  supabaseReadEnabled: SUPABASE_READ_ENABLED,
  supabaseDualWriteEnabled: SUPABASE_DUAL_WRITE_ENABLED,
  supabaseConfigured: isSupabaseConfigured(),
  supabaseReadReady: isSupabaseReadReady(),
  supabaseWriteReady: isSupabaseWriteReady(),
});

export const getDailySummary = async (userId) => {
  if (!isSupabaseReadReady()) {
    const sheet = await sheetFallback({ action: "GET_DAILY_SUMMARY", userId });
    return { ...(sheet || {}), source: "sheet" };
  }

  const today = bangkokDate();
  const [userRes, mealRes] = await Promise.all([
    supabase.get("/users", {
      params: {
        line_user_id: `eq.${userId}`,
        select: "line_user_id,title,goal,calorie_target",
        limit: 1,
      },
    }),
    supabase.get("/meals", {
      params: {
        user_id: `eq.${userId}`,
        meal_date: `eq.${today}`,
        select: "id,menu_name,kcal,carb,protein,fat,sugar,created_at",
        order: "created_at.desc",
      },
    }),
  ]);

  const user = Array.isArray(userRes.data) ? userRes.data[0] : null;
  const meals = Array.isArray(mealRes.data) ? mealRes.data : [];
  const topMeal = [...meals].sort((a, b) => toNumber(b.kcal) - toNumber(a.kcal))[0] || null;

  return {
    status: "success",
    source: "supabase",
    date: today,
    title: user?.title || "ลื้อ",
    goal: user?.goal || "",
    calorieTarget: toNumber(user?.calorie_target, 2050),
    todayCalories: sum(meals, "kcal"),
    totalToday: sum(meals, "kcal"),
    totalCarb: sum(meals, "carb"),
    totalProtein: sum(meals, "protein"),
    totalFat: sum(meals, "fat"),
    totalSugar: sum(meals, "sugar"),
    mealCount: meals.length,
    topMealName: topMeal?.menu_name || "",
    meals,
  };
};

export const updateSession = async ({ userId, step = "READY", sessionData = {} }) => {
  if (!isSupabaseReadReady()) {
    const sheet = await sheetFallback({ action: "UPDATE_SESSION", userId, step, sessionData });
    return { ...(sheet || {}), source: "sheet" };
  }

  await ensureUser({ userId });

  const res = await supabase.post(
    "/user_sessions",
    [{ user_id: userId, step, data: sessionData, updated_at: new Date().toISOString() }],
    { headers: { Prefer: "resolution=merge-duplicates,return=representation" }, params: { on_conflict: "user_id" } }
  );

  return { status: "success", source: "supabase", ...(Array.isArray(res.data) ? res.data[0] : {}) };
};

const writeMealToSupabase = async (payload = {}) => {
  const userId = payload.userId;
  if (!userId) throw new Error("Missing userId for Supabase meal write");

  await ensureUser({
    userId,
    name: payload.name,
    title: payload.title,
    goal: payload.goal,
    calorieTarget: payload.calorieTarget,
  });

  const meal = {
    user_id: userId,
    meal_date: bangkokDate(),
    menu_name: normalizeText(payload.menuName, "อาหาร"),
    kcal: toNumber(payload.kcal, 0),
    carb: toNumber(payload.carb, 0),
    protein: toNumber(payload.protein, 0),
    fat: toNumber(payload.fat, 0),
    sugar: toNumber(payload.sugar, 0),
    source: normalizeText(payload.source, "line"),
    raw: {
      requestId: payload.requestId || "",
      itemsJson: payload.itemsJson || "",
      note: payload.note || "",
    },
  };

  const res = await supabase.post("/meals", [meal], {
    headers: { Prefer: "return=representation" },
  });

  return { status: "success", source: "supabase", meal: Array.isArray(res.data) ? res.data[0] : null };
};

export const logFood = async (payload = {}) => {
  const sheetResult = await sheetFallback({ action: "LOG_FOOD", ...payload });

  if (!isSupabaseWriteReady()) {
    return { ...(sheetResult || {}), source: "sheet", supabaseWrite: "skipped" };
  }

  try {
    const writeResult = await writeMealToSupabase(payload);
    console.log(`[PaeCalDB] LOG_FOOD dual-write ok source=supabase menu=${payload.menuName || ""} kcal=${payload.kcal || 0}`);
    return { ...(sheetResult || {}), source: "sheet+supabase", supabaseWrite: "success", supabaseMealId: writeResult.meal?.id || "" };
  } catch (err) {
    console.error("[PaeCalDB] LOG_FOOD Supabase dual-write failed", err?.response?.data || err.message || err);
    return { ...(sheetResult || {}), source: "sheet", supabaseWrite: "failed" };
  }
};

export const deleteLastMeal = async (userId) => {
  if (!isSupabaseReadReady()) {
    const sheet = await sheetFallback({ action: "DELETE_LAST_MEAL", userId });
    return { ...(sheet || {}), source: "sheet" };
  }

  const today = bangkokDate();
  const lastMealRes = await supabase.get("/meals", {
    params: {
      user_id: `eq.${userId}`,
      meal_date: `eq.${today}`,
      select: "id,menu_name,kcal",
      order: "created_at.desc",
      limit: 1,
    },
  });

  const lastMeal = Array.isArray(lastMealRes.data) ? lastMealRes.data[0] : null;
  if (!lastMeal?.id) {
    return { status: "not_found", source: "supabase" };
  }

  await supabase.delete("/meals", { params: { id: `eq.${lastMeal.id}` } });
  const summary = await getDailySummary(userId);

  return {
    ...summary,
    status: "success",
    source: "supabase",
    deletedMeal: {
      id: lastMeal.id,
      menuName: lastMeal.menu_name,
      kcal: lastMeal.kcal,
    },
  };
};
