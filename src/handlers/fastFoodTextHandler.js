import { replyTexts, replyText } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { logFood } from "../services/db.js";
import { estimateFoodFromText } from "../services/openai.js";
import { safeNumber, DEFAULT_CALORIE_TARGET } from "../utils/helpers.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";

const nowMs = () => Date.now();

const logTiming = (label, start, extra = "") => {
  console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
};

const FOOD_KEYWORDS = [
  "ข้าว", "ก๋วยเตี๋ยว", "บะหมี่", "ราเมง", "เส้น", "โจ๊ก", "ข้าวต้ม", "ผัดไทย", "มาม่า",
  "หมู", "ไก่", "ปลา", "กุ้ง", "เนื้อ", "ไข่", "เต้าหู้", "แซลมอน", "ทะเล",
  "กะเพรา", "กระเพรา", "ข้าวมันไก่", "ข้าวขาหมู", "ข้าวหมูกรอบ", "ข้าวหมูแดง", "ข้าวผัด",
  "ส้มตำ", "ลาบ", "น้ำตก", "ยำ", "สุกี้", "ชาบู", "หมูกระทะ", "ปิ้งย่าง", "บุฟเฟต์",
  "ชาไทย", "ชานม", "ชาเขียว", "กาแฟ", "โกโก้", "นม", "น้ำหวาน", "โค้ก", "โค๊ก", "เป๊ปซี่",
  "เค้ก", "ขนม", "คุกกี้", "โดนัท", "ไอติม", "บิงซู", "ผลไม้", "กล้วย", "แตงโม", "มะม่วง",
];

const BLOCKLIST = [
  "สรุป", "สรุปวันนี้", "แคลวันนี้", "กินอะไรดี", "กินไรดี", "หิวแล้ว", "ตั้งเป้า", "เปลี่ยนเป้า",
  "แก้มื้อล่าสุด", "ลบมื้อล่าสุด", "ฉายาวันนี้", "วันนี้อาหารฟ้องว่า",
];

const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

const hasFoodKeyword = (text = "") => {
  const value = normalize(text);
  return FOOD_KEYWORDS.some((word) => value.includes(word));
};

const isQuestionOrAdviceText = (text = "") => /(ไหม|มั้ย|ปะ|ป่ะ|ดีไหม|ดีมั้ย|อะไรดี|กี่แคล|แคลเท่าไร|แคลเท่าไหร่|ควรกิน|กินได้ไหม)/i.test(text);

const isLikelyShortFoodText = (text = "") => {
  const value = normalize(text);
  if (!value || value.length > 80) return false;
  if (BLOCKLIST.some((word) => value === normalize(word) || value.includes(normalize(word)))) return false;
  if (isQuestionOrAdviceText(value)) return false;
  return hasFoodKeyword(value);
};

const getSession = async (userId) => {
  const session = await postToSheet({ action: "GET_SESSION", userId });
  return { step: session?.step || "READY", data: session?.data || {}, ...session };
};

const updateSession = async ({ userId, step, sessionData }) => postToSheet({ action: "UPDATE_SESSION", userId, step, sessionData });

const buildGoalFoodGuardReply = (foodText) => [
  "อันนี้ดูเป็นอาหารนะ ไม่ใช่เป้าหมายจ้า 👀",
  `ถ้าจะให้แปะนับ พิมพ์ว่า: กิน ${foodText}`,
  "หรือส่งรูปมาเลยก็ได้ 📸",
  "ถ้าจะตั้งเป้า พิมพ์แบบ: เป้าหมาย ลดไขมัน",
].join("\n");

const buildLoggedReply = ({ meal, total, target }) => {
  const left = Math.max(target - total, 0);
  return [
    [
      `โอเค แปะจดให้แล้ว 😋`,
      `🍽️ ${meal.menuName}`,
      `🔥 ~${Math.round(meal.kcal)} kcal`,
      `🍚 คาร์บ ${Math.round(meal.carb)}g / 💪 โปรตีน ${Math.round(meal.protein)}g / 🥑 ไขมัน ${Math.round(meal.fat)}g`,
      `📏 ปริมาณ: ${meal.portionLabel}`,
    ].join("\n"),
    [
      `📊 วันนี้ ${Math.round(total)} / ${Math.round(target)} kcal`,
      left > 0 ? `🟢 เหลือประมาณ ${Math.round(left)} kcal` : `🔴 วันนี้เกินเป้าแล้วนิดนึงนะ 👀`,
      "กดดูแคลวันนี้ต่อได้เลย",
    ].join("\n"),
  ];
};

const resolveTextPortion = ({ kcal = 0 } = {}) => {
  if (kcal >= 750) return { level: "heavy", label: "ค่อนข้างเยอะ", note: "พิมพ์มาเป็นชื่อเมนู แปะนับเป็น 1 เสิร์ฟแบบร้านทั่วไปก่อนนะ" };
  if (kcal <= 320) return { level: "light", label: "ค่อนข้างเบา", note: "พิมพ์มาเป็นชื่อเมนู แปะนับเป็น 1 เสิร์ฟเบา ๆ ก่อนนะ" };
  return { level: "normal", label: "พอดี", note: "พิมพ์มาเป็นชื่อเมนู แปะนับเป็น 1 เสิร์ฟทั่วไปก่อนนะ" };
};

export const handleFastFoodText = async (event) => {
  const start = nowMs();
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = String(event.message?.text || "").trim();

  if (!userId || !text) return false;

  const looksFood = isLikelyShortFoodText(text);
  if (!looksFood) return false;

  const session = await getSession(userId);

  if (session.step === "ASK_GOAL_UPDATE" || session.step === "ASK_GOAL") {
    await updateSession({ userId, step: "READY", sessionData: session.data || {} });
    await replyText(replyToken, buildGoalFoodGuardReply(text));
    logTiming("event:goalFoodGuard", start, `text=${text}`);
    return true;
  }

  if (session.step && session.step !== "READY") return false;

  const aiStart = nowMs();
  const foodData = await estimateFoodFromText(text);
  logTiming("fastFoodText:estimate", aiStart, `text=${text} menu=${foodData?.menuName || ""}`);

  const kcal = safeNumber(foodData?.kcal, 0);
  if (kcal <= 0) return false;

  const meal = {
    menuName: foodData?.menuName || text,
    kcal,
    carb: safeNumber(foodData?.carb, 0),
    protein: safeNumber(foodData?.protein, 0),
    fat: safeNumber(foodData?.fat, 0),
    sugar: safeNumber(foodData?.sugar, 0),
  };
  const portion = resolveTextPortion({ kcal: meal.kcal });
  const requestId = `${event.message?.id || Date.now()}:fast-text-food`;

  invalidateRichMenuSummaryCache(userId);
  const result = await logFood({
    userId,
    name: session.data?.name || "",
    menuName: meal.menuName,
    kcal: meal.kcal,
    carb: meal.carb,
    protein: meal.protein,
    fat: meal.fat,
    sugar: meal.sugar,
    requestId,
    source: "text_fast",
    portionLevel: portion.level,
    portionLabel: portion.label,
    portionNote: portion.note,
    confidence: foodData?.confidence || "medium",
  });
  invalidateRichMenuSummaryCache(userId);

  const total = safeNumber(result.todayCalories ?? result.totalToday, meal.kcal);
  const target = safeNumber(result.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyTexts(replyToken, buildLoggedReply({ meal: { ...meal, portionLabel: portion.label }, total, target }));

  logTiming("event:fastFoodText", start, `source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""} portion=${portion.level}`);
  return true;
};
