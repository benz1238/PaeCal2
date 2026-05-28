import { logFood } from "../services/db.js";
import { replyTexts } from "../services/line.js";
import { safeNumber } from "../utils/helpers.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";

const nowMs = () => Date.now();

const logTiming = (label, start, extra = "") => {
  console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
};

const MENU_PRESETS = [
  { pattern: /โจ๊กหมู/i, menuName: "โจ๊กหมู + ไข่", kcal: 330, carb: 42, protein: 20, fat: 9, sugar: 2 },
  { pattern: /โยเกิร์ต.*กล้วย/i, menuName: "โยเกิร์ต + กล้วย", kcal: 220, carb: 38, protein: 9, fat: 4, sugar: 22 },
  { pattern: /ข้าวอกไก่ไข่ต้ม/i, menuName: "ข้าวอกไก่ไข่ต้ม", kcal: 520, carb: 62, protein: 42, fat: 10, sugar: 3 },
  { pattern: /ข้าวไก่ย่าง/i, menuName: "ข้าวไก่ย่าง", kcal: 550, carb: 60, protein: 40, fat: 15, sugar: 4 },
  { pattern: /ข้าวกะเพราไข่ดาว|ข้าวกระเพราไข่ดาว/i, menuName: "ข้าวกะเพราไข่ดาว", kcal: 800, carb: 75, protein: 35, fat: 40, sugar: 5 },
  { pattern: /สุกี้น้ำ/i, menuName: "สุกี้น้ำ", kcal: 420, carb: 45, protein: 28, fat: 12, sugar: 8 },
  { pattern: /ไข่ต้ม.*ผลไม้/i, menuName: "ไข่ต้ม + ผลไม้", kcal: 250, carb: 28, protein: 14, fat: 9, sugar: 18 },
  { pattern: /สลัดอกไก่/i, menuName: "สลัดอกไก่", kcal: 350, carb: 22, protein: 38, fat: 12, sugar: 7 },
  { pattern: /ซุปใส|เกาเหลา/i, menuName: "ซุปใส / เกาเหลา", kcal: 320, carb: 18, protein: 28, fat: 12, sugar: 3 },
  { pattern: /ข้าวปลา|ไก่ย่าง/i, menuName: "ข้าวปลา/ไก่ย่าง", kcal: 520, carb: 55, protein: 38, fat: 14, sugar: 4 },
  { pattern: /นมจืด|โยเกิร์ต/i, menuName: "นมจืด / โยเกิร์ต", kcal: 170, carb: 18, protein: 10, fat: 6, sugar: 12 },
  { pattern: /ไข่ต้ม/i, menuName: "ไข่ต้ม 1–2 ฟอง", kcal: 160, carb: 1, protein: 13, fat: 11, sugar: 0 },
];

const parseMealChoice = (text = "") => {
  const raw = String(text || "").trim();
  const match = raw.match(/^วันนี้ขอกิน\s+(.+)$/i);
  if (!match) return null;

  const picked = match[1].trim();
  const preset = MENU_PRESETS.find((item) => item.pattern.test(picked));
  if (preset) return preset;

  return { menuName: picked, kcal: 450, carb: 50, protein: 20, fat: 15, sugar: 5 };
};

export const handleMealChoiceText = async (event) => {
  const meal = parseMealChoice(event.message?.text || "");
  if (!meal) return false;

  const start = nowMs();
  const userId = event.source.userId;
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
  });
  invalidateRichMenuSummaryCache(userId);

  const total = safeNumber(result.todayCalories ?? result.totalToday, meal.kcal);
  const target = safeNumber(result.calorieTarget, 2050);
  const left = Math.max(target - total, 0);

  await replyTexts(event.replyToken, [
    [
      "โอเค แปะจดให้แล้ว 😋",
      `เมนู: ${meal.menuName}`,
      `🔥 ประมาณ ${Math.round(meal.kcal)} kcal`,
      `🍚 คาร์บ ${Math.round(meal.carb)}g / 💪 โปรตีน ${Math.round(meal.protein)}g / 🥑 ไขมัน ${Math.round(meal.fat)}g`,
      `🍬 น้ำตาล ${Math.round(meal.sugar || 0)}g`,
    ].join("\n"),
    [
      `วันนี้ ${Math.round(total)} / ${Math.round(target)} kcal`,
      left > 0 ? `เหลือประมาณ ${Math.round(left)} kcal` : "วันนี้เกินเป้าแล้วนิดนึงนะ 👀",
      "กดดูแคลวันนี้ต่อได้เลย",
    ].join("\n"),
  ]);

  logTiming("event:mealChoiceFast", start, `source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""}`);
  return true;
};
