import { logFood } from "../services/db.js";
import { replyFlex } from "../services/line.js";
import { safeNumber, DEFAULT_CALORIE_TARGET } from "../utils/helpers.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";
import { buildFoodLogFlexMessage } from "../utils/foodLogFlex.js";

const nowMs = () => Date.now();
const logTiming = (label, start, extra = "") => console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);

const MENU_PRESETS = [
  { keyword: "โจ๊กหมู", menuName: "โจ๊กหมู + ไข่", kcal: 330, carb: 42, protein: 20, fat: 9, sugar: 2 },
  { keyword: "โยเกิร์ต", menuName: "โยเกิร์ต + กล้วย", kcal: 220, carb: 38, protein: 9, fat: 4, sugar: 22 },
  { keyword: "ข้าวอกไก่ไข่ต้ม", menuName: "ข้าวอกไก่ไข่ต้ม", kcal: 520, carb: 62, protein: 42, fat: 10, sugar: 3 },
  { keyword: "ข้าวไก่ย่าง", menuName: "ข้าวไก่ย่าง", kcal: 550, carb: 60, protein: 40, fat: 15, sugar: 4 },
  { keyword: "ข้าวกะเพราไข่ดาว", menuName: "ข้าวกะเพราไข่ดาว", kcal: 800, carb: 75, protein: 35, fat: 40, sugar: 5 },
  { keyword: "สุกี้น้ำ", menuName: "สุกี้น้ำ", kcal: 420, carb: 45, protein: 28, fat: 12, sugar: 8 },
  { keyword: "สลัดอกไก่", menuName: "สลัดอกไก่", kcal: 350, carb: 22, protein: 38, fat: 12, sugar: 7 },
  { keyword: "เกาเหลา", menuName: "ซุปใส / เกาเหลา", kcal: 320, carb: 18, protein: 28, fat: 12, sugar: 3 },
  { keyword: "ไข่ต้ม", menuName: "ไข่ต้ม", kcal: 160, carb: 1, protein: 13, fat: 11, sugar: 0 },
];

const portionFor = (kcal = 0) => {
  if (safeNumber(kcal, 0) >= 750) return { level: "heavy", label: "ค่อนข้างเยอะ" };
  if (safeNumber(kcal, 0) <= 320) return { level: "light", label: "ค่อนข้างเบา" };
  return { level: "normal", label: "พอดี" };
};

const parseMealChoice = (text = "") => {
  const raw = String(text || "").trim();
  const match = raw.match(/^วันนี้ขอกิน\s+(.+)$/i);
  if (!match) return null;
  const picked = match[1].trim();
  return MENU_PRESETS.find((item) => picked.includes(item.keyword)) || { menuName: picked, kcal: 450, carb: 50, protein: 20, fat: 15, sugar: 5 };
};

export const handleMealChoiceText = async (event) => {
  const meal = parseMealChoice(event.message?.text || "");
  if (!meal) return false;

  const start = nowMs();
  const userId = event.source.userId;
  const portion = portionFor(meal.kcal);
  const requestId = `${event.message?.id || Date.now()}:meal-choice`;
  invalidateRichMenuSummaryCache(userId);

  const result = await logFood({
    userId,
    name: "",
    menuName: meal.menuName,
    kcal: meal.kcal,
    carb: meal.carb,
    protein: meal.protein,
    fat: meal.fat,
    sugar: meal.sugar,
    requestId,
    source: "meal_suggestion_card",
    portionLevel: portion.level,
    portionLabel: portion.label,
    confidence: "medium",
  });
  invalidateRichMenuSummaryCache(userId);

  const total = safeNumber(result.todayCalories ?? result.totalToday, meal.kcal);
  const target = safeNumber(result.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyFlex(event.replyToken, buildFoodLogFlexMessage({ meal: { ...meal, portionLabel: portion.label }, total, target, estimateMode: "meal_suggestion_card" }));

  logTiming("event:mealChoiceFast", start, `source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""}`);
  return true;
};
