import { handleTextMessage } from "./textHandler.js";
import {
  replyFlex,
  replyPaeLaewGuideCard,
  replySendPhotoGuide,
  replyText,
  replyTypeFoodPrompt,
} from "../services/line.js";
import { deleteLastMeal, getDailySummary, updateSession } from "../services/db.js";
import { postToSheet } from "../services/sheet.js";
import {
  buildCalorieSummaryFlexMessage,
  buildFoodAuraFlexMessage,
  buildFoodWrappedFlexMessage,
  buildNutritionFlexMessage,
} from "../utils/richMenuFlex.js";
import {
  buildDeleteMealFlexMessage,
  buildEditMealFlexMessage,
  buildSetGoalFlexMessage,
} from "../utils/richMenuUtilityFlex.js";
import {
  clearExpiredRichMenuSummaryCache,
  getCachedRichMenuSummary,
  invalidateRichMenuSummaryCache,
  setCachedRichMenuSummary,
} from "../utils/richMenuSummaryCache.js";

const ACTION_LOCK_TTL_MS = Number(process.env.RICH_MENU_ACTION_LOCK_TTL_MS || 3500);
const SWITCH_MENU_ACTION_LOCK_TTL_MS = Number(process.env.RICH_MENU_SWITCH_LOCK_TTL_MS || 1000);
const DELETE_LAST_MEAL_LOCK_TTL_MS = Number(process.env.RICH_MENU_DELETE_LOCK_TTL_MS || 1000);
const actionLocks = new Map();

const SWITCH_RICH_MENU_ACTIONS = new Set([
  "SWITCH_TO_VIBE_MENU",
  "SWITCH_TO_CAL_MENU",
]);

const SILENT_RICH_MENU_ACTIONS = new Set([
  "open_keyboard",
]);

const nowMs = () => Date.now();
export const logTiming = (label, start, extra = "") => {
  console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
};

export const parsePostbackData = (data) => {
  const raw = String(data || "").trim();
  try {
    const params = new URLSearchParams(raw);
    return { raw, action: params.get("action") || "", params };
  } catch {
    return { raw, action: "", params: new URLSearchParams() };
  }
};

const getActionLockTtlMs = (action) => {
  if (SWITCH_RICH_MENU_ACTIONS.has(action)) return SWITCH_MENU_ACTION_LOCK_TTL_MS;
  if (action === "DELETE_LAST_MEAL") return DELETE_LAST_MEAL_LOCK_TTL_MS;
  return ACTION_LOCK_TTL_MS;
};

const shouldSkipDuplicateAction = (userId, action) => {
  if (!userId || !action) return false;
  if (SILENT_RICH_MENU_ACTIONS.has(action)) return false;

  const now = nowMs();
  const key = `${userId}:${action}`;
  const lockedUntil = actionLocks.get(key) || 0;
  if (lockedUntil > now) return true;

  actionLocks.set(key, now + getActionLockTtlMs(action));
  return false;
};

const clearExpiredActionLocks = () => {
  const now = nowMs();
  for (const [key, value] of actionLocks.entries()) {
    if (value <= now) actionLocks.delete(key);
  }
};

const dbAction = async (label, fn) => {
  const start = nowMs();
  const result = await fn();
  logTiming(`db:${label}`, start, result?.source ? `source=${result.source}` : "");
  return result || {};
};

const getDailySummaryForRichMenu = async (userId, action) => {
  clearExpiredRichMenuSummaryCache();
  clearExpiredActionLocks();

  const cached = getCachedRichMenuSummary(userId);
  if (cached) {
    console.log(`[PaeCalTiming] cache:GET_DAILY_SUMMARY 0ms action=${action} hit=true source=${cached.source || "unknown"}`);
    return cached;
  }

  const summary = await dbAction(`GET_DAILY_SUMMARY action=${action}`, () => getDailySummary(userId));
  setCachedRichMenuSummary(userId, summary || {});
  return summary || {};
};

export const routeTextAction = async (event, text) => {
  const start = nowMs();
  await handleTextMessage({ ...event, type: "message", message: { type: "text", text } });
  logTiming("richMenu:routeTextAction", start, `text=${text}`);
};

const replyFoodWrapped = async ({ replyToken, userId, action }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, action);
  const flex = action === "FOOD_AURA"
    ? buildFoodAuraFlexMessage({ summary })
    : buildFoodWrappedFlexMessage({ summary });
  await replyFlex(replyToken, flex);
  logTiming("richMenu:replyVibeFlex", start, `action=${action}`);
};

const replyNutrition = async ({ replyToken, userId }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, "TODAY_NUTRITION");
  await replyFlex(replyToken, buildNutritionFlexMessage({ summary }));
  logTiming("richMenu:replyNutritionFlex", start);
};

const replyCalorieSummary = async ({ replyToken, userId }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, "TODAY_CALORIES");
  await replyFlex(replyToken, buildCalorieSummaryFlexMessage({ summary }));
  logTiming("richMenu:replyCalorieSummaryFlex", start);
};

const getBangkokHour = () => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value || 12);
  } catch {
    return 12;
  }
};

const buildMealSuggestionText = () => {
  const hour = getBangkokHour();

  if (hour >= 5 && hour < 10) {
    return `โอเค เช้า ๆ แบบนี้แปะว่าเอาอุ่น ๆ อยู่ท้องก่อน 👀

เลือกทางนี้ได้อยู่:
1. โจ๊กหมู + ไข่
2. ข้าวต้มปลา/ไก่
3. โยเกิร์ต + กล้วย

เริ่มวันแบบไม่ตีกับท้อง แปะว่าโอเค 😄`;
  }

  if (hour >= 10 && hour < 14) {
    return `ไอหยา เที่ยงพอดี หิวจริงแล้วมั้ง 👀

แปะว่าเอาอิ่ม แต่ไม่ต้องมันจัด:
1. ข้าวไก่ย่าง + ผัก
2. สุกี้น้ำ
3. กะเพราไก่ไม่มัน + ไข่ต้ม

กินให้อิ่มแบบไม่ง่วงบ่ายนะ`;
  }

  if (hour >= 14 && hour < 17) {
    return `เอ้า บ่ายแล้ว ถ้าหิวตอนนี้อย่าเพิ่งเปิดเกมใหญ่ 555

เอาแบบกันหลุดก่อน:
1. ไข่ต้ม + ผลไม้
2. ซุปใส / เกาเหลา
3. โยเกิร์ตไม่หวาน

ประคองไว้ก่อน มื้อเย็นจะได้ไม่ต่อยาก 😅`;
  }

  if (hour >= 17 && hour < 21) {
    return `โอเค เย็นแล้วนะ มื้อนี้เอาอิ่มพอดีดีกว่า 👀

แปะเลือกให้ 3 ทาง:
1. สุกี้น้ำ
2. เกาเหลา + ข้าวนิดเดียว
3. ข้าวปลา/ไก่ย่าง + ผัก

ไม่ต้องเล่นใหญ่ คืนนี้ท้องจะได้ไม่ทำงานโอที`;
  }

  return `ไอหยา ดึกแล้วนะ ถ้ายังหิวจริง ๆ เบา ๆ ก็พอ 👀

เอาแค่นี้พอแหละ:
1. นมจืด / โยเกิร์ตไม่หวาน
2. ไข่ต้ม 1 ฟอง
3. ซุปใสถ้วยเล็ก

กินกันวูบพอ แล้วไปพักนะ 😴`;
};

const replyMealSuggestionFast = async ({ replyToken }) => {
  const start = nowMs();
  await replyText(replyToken, buildMealSuggestionText());
  logTiming("richMenu:mealSuggestionText", start);
};

const replySetGoalFast = async ({ replyToken, userId }) => {
  const start = nowMs();
  await dbAction("UPDATE_SESSION:setGoal", () => updateSession({ userId, step: "ASK_GOAL_UPDATE", sessionData: {} }));
  await replyFlex(replyToken, buildSetGoalFlexMessage());
  logTiming("richMenu:setGoalFast", start);
};

const replyEditMealFast = async ({ replyToken }) => {
  const start = nowMs();
  await replyFlex(replyToken, buildEditMealFlexMessage());
  logTiming("richMenu:editMealFast", start);
};

const normalizeDeletedMeal = (result = {}) => result.deletedMeal || result.meal || (
  result.menuName || result.kcal
    ? { menuName: result.menuName || result.name || "มื้อล่าสุด", kcal: result.kcal || result.calories || 0 }
    : null
);

const deleteLastMealAnySource = async (userId) => {
  const primary = await deleteLastMeal(userId);
  if (primary?.status === "success" || normalizeDeletedMeal(primary)) return primary;

  try {
    const sheet = await postToSheet({ action: "DELETE_LAST_MEAL", userId });
    const sheetDeletedMeal = normalizeDeletedMeal(sheet);
    if (sheet?.status === "success" || sheetDeletedMeal) {
      return {
        ...(sheet || {}),
        status: "success",
        source: `sheet_delete_fallback_after_${primary?.source || primary?.status || "unknown"}`,
        deletedMeal: sheetDeletedMeal || { menuName: "มื้อล่าสุด", kcal: 0 },
      };
    }
  } catch (err) {
    console.warn("[PaeCalDB] DELETE_LAST_MEAL direct sheet fallback failed", err?.response?.data || err.message || err);
  }

  return primary || { status: "not_found", source: "delete_unknown" };
};

const replyDeleteLastMealFast = async ({ replyToken, userId }) => {
  const start = nowMs();
  const deleted = await dbAction("DELETE_LAST_MEAL:anySource", () => deleteLastMealAnySource(userId));
  invalidateRichMenuSummaryCache(userId);
  const deletedMeal = normalizeDeletedMeal(deleted);
  const notFound = !(deleted?.status === "success" || deletedMeal);

  let summary = {};
  if (!notFound) {
    const allowSheetFallback = String(deleted?.source || "").includes("sheet");
    summary = await dbAction("GET_DAILY_SUMMARY:afterDelete", () => getDailySummary(userId, { allowSheetFallback }));
    if (summary?.status === "success") setCachedRichMenuSummary(userId, summary || {});
  }

  const deletedForCard = {
    ...(summary || {}),
    ...deleted,
    todayCalories: summary.todayCalories ?? summary.totalToday ?? deleted.todayCalories ?? deleted.totalToday ?? 0,
    totalToday: summary.totalToday ?? summary.todayCalories ?? deleted.totalToday ?? deleted.todayCalories ?? 0,
    calorieTarget: summary.calorieTarget || deleted.calorieTarget || 2050,
    deletedMeal,
  };

  await replyFlex(replyToken, buildDeleteMealFlexMessage({ deleted: deletedForCard, notFound }));
  logTiming("richMenu:deleteLastMealFast", start, notFound ? `status=not_found source=${deleted?.source || "unknown"}` : `status=deleted source=${deleted?.source || "unknown"} total=${deletedForCard.todayCalories || 0}`);
};

export const handleRichMenuPostback = async ({ event, postback, eventStart }) => {
  const userId = event.source.userId;
  const action = postback.action;

  if (shouldSkipDuplicateAction(userId, action)) {
    const label = SWITCH_RICH_MENU_ACTIONS.has(action) ? "richMenu:switchDebounced" : "richMenu:debounced";
    logTiming(label, eventStart, `action=${action}`);
    return true;
  }

  if (SWITCH_RICH_MENU_ACTIONS.has(action) || SILENT_RICH_MENU_ACTIONS.has(action)) {
    logTiming("richMenu:silent", eventStart, `action=${action}`);
    return true;
  }

  if (action === "OPEN_PAELAEW_GUIDE") {
    await replyPaeLaewGuideCard(event.replyToken);
    logTiming("richMenu:guideCard", eventStart, `action=${action}`);
    return true;
  }

  if (action === "TYPE_FOOD_PROMPT") {
    await replyTypeFoodPrompt(event.replyToken);
    logTiming("richMenu:typeFoodPrompt", eventStart);
    return true;
  }

  if (action === "SEND_PHOTO_GUIDE") {
    await replySendPhotoGuide(event.replyToken);
    logTiming("richMenu:sendPhotoGuide", eventStart);
    return true;
  }

  if (action === "DAILY_FOOD_WRAPPED" || action === "FOOD_AURA" || action === "DAILY_SUMMARY") {
    await replyFoodWrapped({ replyToken: event.replyToken, userId, action });
    logTiming("richMenu:vibeAction", eventStart, `action=${action}`);
    return true;
  }

  if (action === "TODAY_CALORIES") {
    await replyCalorieSummary({ replyToken: event.replyToken, userId });
    logTiming("richMenu:calorieAction", eventStart);
    return true;
  }

  if (action === "TODAY_NUTRITION") {
    await replyNutrition({ replyToken: event.replyToken, userId });
    logTiming("richMenu:nutritionAction", eventStart);
    return true;
  }

  if (action === "SET_GOAL") {
    await replySetGoalFast({ replyToken: event.replyToken, userId });
    logTiming("richMenu:setGoalAction", eventStart);
    return true;
  }

  if (action === "EDIT_LAST_MEAL") {
    await replyEditMealFast({ replyToken: event.replyToken });
    logTiming("richMenu:editMealAction", eventStart);
    return true;
  }

  if (action === "DELETE_LAST_MEAL") {
    await replyDeleteLastMealFast({ replyToken: event.replyToken, userId });
    logTiming("richMenu:deleteMealAction", eventStart);
    return true;
  }

  if (action === "MEAL_SUGGESTION") {
    await replyMealSuggestionFast({ replyToken: event.replyToken });
    logTiming("richMenu:mealSuggestionAction", eventStart);
    return true;
  }

  return false;
};
