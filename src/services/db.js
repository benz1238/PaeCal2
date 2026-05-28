import axios from "axios";
import { postToSheet } from "./sheet.js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ENABLED = String(process.env.SUPABASE_RICH_MENU_ENABLED || "false").toLowerCase() === "true";

const isSupabaseReady = () => Boolean(SUPABASE_ENABLED && SUPABASE_URL && SUPABASE_KEY);

const bangkokDate = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

const supabase = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY || "",
    Authorization: `Bearer ${SUPABASE_KEY || ""}`,
    "Content-Type": "application/json",
  },
  timeout: Number(process.env.SUPABASE_TIMEOUT_MS || 5000),
});

const sheetFallback = async (payload) => postToSheet(payload);

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const sum = (rows, key) => rows.reduce((total, row) => total + toNumber(row?.[key], 0), 0);

export const dbStatus = () => ({
  supabaseEnabled: SUPABASE_ENABLED,
  supabaseReady: isSupabaseReady(),
});

export const getDailySummary = async (userId) => {
  if (!isSupabaseReady()) {
    return sheetFallback({ action: "GET_DAILY_SUMMARY", userId });
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
  if (!isSupabaseReady()) {
    return sheetFallback({ action: "UPDATE_SESSION", userId, step, sessionData });
  }

  await supabase.post(
    "/users",
    [{ line_user_id: userId }],
    { headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, params: { on_conflict: "line_user_id" } }
  );

  const res = await supabase.post(
    "/user_sessions",
    [{ user_id: userId, step, data: sessionData, updated_at: new Date().toISOString() }],
    { headers: { Prefer: "resolution=merge-duplicates,return=representation" }, params: { on_conflict: "user_id" } }
  );

  return { status: "success", source: "supabase", ...(Array.isArray(res.data) ? res.data[0] : {}) };
};

export const deleteLastMeal = async (userId) => {
  if (!isSupabaseReady()) {
    return sheetFallback({ action: "DELETE_LAST_MEAL", userId });
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
