import { replyFlex } from "../services/line.js";
import { getSession, logFood } from "../services/db.js";
import { DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import { buildFoodLogFlexMessage } from "../utils/foodLogFlex.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";

const normalize = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/^กิน\s*/i, "")
  .replace(/\s+/g, "");

const EXACT_FOODS = [
  { pattern: /^อกไก่ย่าง$/, menuName: "อกไก่ย่าง", kcal: 200, carb: 0, protein: 38, fat: 6, sugar: 0 },
  { pattern: /^อกไก่ทอด$/, menuName: "อกไก่ทอด", kcal: 320, carb: 15, protein: 35, fat: 15, sugar: 0 },
  { pattern: /^(อกไก่|อกไก่ต้ม|อกไก่นึ่ง)$/, menuName: "อกไก่ต้ม", kcal: 180, carb: 0, protein: 38, fat: 4, sugar: 0 },
  { pattern: /^สะโพกไก่ย่าง$/, menuName: "สะโพกไก่ย่าง", kcal: 300, carb: 0, protein: 30, fat: 18, sugar: 0 },
  { pattern: /^สะโพกไก่ทอด$/, menuName: "สะโพกไก่ทอด", kcal: 420, carb: 20, protein: 30, fat: 26, sugar: 0 },
  { pattern: /^(สะโพกไก่|สะโพกไก่ต้ม|สะโพกไก่นึ่ง)$/, menuName: "สะโพกไก่ต้ม", kcal: 260, carb: 0, protein: 28, fat: 16, sugar: 0 },
];

const findExactFood = (text = "") => {
  const value = normalize(text);
  return EXACT_FOODS.find((food) => food.pattern.test(value)) || null;
};

const resolveCurrentTotal = ({ result = {}, session = {}, mealKcal = 0 } = {}) => {
  const total = safeNumber(result.todayCalories ?? result.totalToday, 0);
  if (total > 0) return total;
  const cached = safeNumber(session.todayCalories ?? session.totalToday ?? session.data?.todayCalories ?? session.data?.totalToday, 0);
  if (cached > 0) return cached + safeNumber(mealKcal, 0);
  return safeNumber(mealKcal, 0);
};

export const handleExactFoodText = async (event) => {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = String(event.message?.text || "").trim();
  const mealPreset = findExactFood(text);
  if (!userId || !replyToken || !mealPreset) return false;

  const session = await getSession(userId);
  if (session.step && session.step !== "READY") return false;

  const meal = { ...mealPreset };
  invalidateRichMenuSummaryCache(userId);
  const result = await logFood({
    userId,
    name: session.data?.name || "",
    ...meal,
    requestId: `${event.message?.id || Date.now()}:exact-text-food`,
    source: "text_exact_local",
    portionLevel: "light",
    portionLabel: "ค่อนข้างเบา",
    portionNote: "แปะนับเป็น 1 เสิร์ฟเบา ๆ ก่อนนะ",
    confidence: "high",
  });
  invalidateRichMenuSummaryCache(userId);

  const total = resolveCurrentTotal({ result, session, mealKcal: meal.kcal });
  const target = safeNumber(result.calorieTarget ?? session.calorieTarget ?? session.data?.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyFlex(replyToken, buildFoodLogFlexMessage({ meal: { ...meal, portionLabel: "ค่อนข้างเบา" }, total, target, estimateMode: "local_exact" }));
  return true;
};
