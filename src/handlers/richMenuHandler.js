import { handleTextMessage } from "./textHandler.js";
import {
  replyFlex,
  replyPaeLaewGuideCard,
  replySendPhotoGuide,
  replyTypeFoodPrompt,
} from "../services/line.js";
import { deleteLastMeal, getDailySummary, updateSession } from "../services/db.js";
import { buildMealSuggestionCarouselFlexMessage } from "../utils/mealSuggestionFlex.js";
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

const SUMMARY_CACHE_TTL_MS = Number(process.env.RICH_MENU_SUMMARY_CACHE_TTL_MS || 60000);
const ACTION_LOCK_TTL_MS = Number(process.env.RICH_MENU_ACTION_LOCK_TTL_MS || 3500);
const summaryCache = new Map();
const actionLocks = new Map();

const SILENT_RICH_MENU_ACTIONS = new Set([
  "SWITCH_TO_VIBE_MENU",
  "SWITCH_TO_CAL_MENU",
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

const shouldSkipDuplicateAction = (userId, action) => {
  if (!userId || !action) return false;
  if (SILENT_RICH_MENU_ACTIONS.has(action)) return false;

  const now = nowMs();
  const key = `${userId}:${action}`;
  const lockedUntil = actionLocks.get(key) || 0;
  if (lockedUntil > now) return true;

  actionLocks.set(key, now + ACTION_LOCK_TTL_MS);
  return false;
};

const clearExpiredCaches = () => {
  const now = nowMs();
  for (const [key, value] of summaryCache.entries()) {
    if (!value || value.expiresAt <= now) summaryCache.delete(key);
  }
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

const invalidateUserSummaryCache = (userId) => {
  if (userId) summaryCache.delete(userId);
};

const getDailySummaryForRichMenu = async (userId, action) => {
  clearExpiredCaches();
  const cached = summaryCache.get(userId);
  if (cached && cached.expiresAt > nowMs()) {
    console.log(`[PaeCalTiming] cache:GET_DAILY_SUMMARY 0ms action=${action} hit=true`);
    return cached.summary || {};
  }

  const summary = await dbAction(`GET_DAILY_SUMMARY action=${action}`, () => getDailySummary(userId));
  summaryCache.set(userId, { summary: summary || {}, expiresAt: nowMs() + SUMMARY_CACHE_TTL_MS });
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

const replyMealSuggestionFast = async ({ replyToken }) => {
  const start = nowMs();
  await replyFlex(replyToken, buildMealSuggestionCarouselFlexMessage());
  logTiming("richMenu:mealSuggestionCarousel", start);
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

const replyDeleteLastMealFast = async ({ replyToken, userId }) => {
  const start = nowMs();
  const deleted = await dbAction("DELETE_LAST_MEAL:richMenu", () => deleteLastMeal(userId));
  invalidateUserSummaryCache(userId);
  const notFound = deleted.status === "not_found";
  await replyFlex(replyToken, buildDeleteMealFlexMessage({ deleted, notFound }));
  logTiming("richMenu:deleteLastMealFast", start, notFound ? "status=not_found" : "status=deleted");
};

export const handleRichMenuPostback = async ({ event, postback, eventStart }) => {
  const userId = event.source.userId;
  const action = postback.action;

  if (shouldSkipDuplicateAction(userId, action)) {
    logTiming("richMenu:debounced", eventStart, `action=${action}`);
    return true;
  }

  if (SILENT_RICH_MENU_ACTIONS.has(action)) {
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
