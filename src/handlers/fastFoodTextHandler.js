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
  "ส้มตำ", "ลาบ", "น้ำตก", "ยำ", "สุกี้", "ชาบู", "หมูกระทะ", "หมูทะ", "ปิ้งย่าง", "บุฟเฟต์",
  "ไส้กรอก", "ลูกชิ้น", "ลูกชิ้นปลาระเบิด", "ชีส", "ทอด", "ของทอด",
  "ชาไทย", "ชานม", "ชาเขียว", "มัจฉะ", "มัทฉะ", "กาแฟ", "โกโก้", "นม", "น้ำหวาน", "โค้ก", "โค๊ก", "เป๊ปซี่",
  "เค้ก", "ขนม", "คุกกี้", "โดนัท", "ไอติม", "บิงซู", "ผลไม้", "กล้วย", "แตงโม", "มะม่วง",
];

const BLOCKLIST = [
  "สรุป", "สรุปวันนี้", "แคลวันนี้", "กินอะไรดี", "กินไรดี", "หิวแล้ว", "ตั้งเป้า", "เปลี่ยนเป้า",
  "แก้มื้อล่าสุด", "ลบมื้อล่าสุด", "ฉายาวันนี้", "วันนี้อาหารฟ้องว่า",
];

const LOCAL_FOOD_PRESETS = [
  { pattern: /ชาบู|สุกี้|hot\s*pot/i, menuName: "ชาบู", kcal: 650, carb: 45, protein: 35, fat: 32, sugar: 10 },
  { pattern: /หมูกระทะ|หมูทะ|ปิ้งย่าง|บุฟเฟต์/i, menuName: "หมูกระทะ", kcal: 850, carb: 55, protein: 42, fat: 48, sugar: 12 },
  { pattern: /ไส้กรอกชีส/i, menuName: "ไส้กรอกชีส", kcal: 260, carb: 10, protein: 10, fat: 20, sugar: 2 },
  { pattern: /ไส้กรอก/i, menuName: "ไส้กรอก", kcal: 180, carb: 7, protein: 8, fat: 13, sugar: 2 },
  { pattern: /ลูกชิ้นปลาระเบิด|ลูกชิ้นทอด/i, menuName: "ลูกชิ้นปลาระเบิด", kcal: 280, carb: 28, protein: 12, fat: 14, sugar: 4 },
  { pattern: /ชาเขียวมัจฉะ|ชาเขียวมัทฉะ|มัจฉะ|มัทฉะ|matcha/i, menuName: "ชาเขียวมัจฉะ", kcal: 180, carb: 28, protein: 4, fat: 5, sugar: 22 },
  { pattern: /ชาไทย/i, menuName: "ชาไทย", kcal: 220, carb: 35, protein: 3, fat: 6, sugar: 30 },
  { pattern: /ชานม/i, menuName: "ชานม", kcal: 280, carb: 45, protein: 4, fat: 8, sugar: 36 },
  { pattern: /ข้าวขาหมู/i, menuName: "ข้าวขาหมู", kcal: 780, carb: 82, protein: 32, fat: 34, sugar: 8 },
  { pattern: /ข้าวมันไก่/i, menuName: "ข้าวมันไก่", kcal: 650, carb: 70, protein: 32, fat: 26, sugar: 5 },
  { pattern: /ข้าวหมูกรอบ/i, menuName: "ข้าวหมูกรอบ", kcal: 820, carb: 75, protein: 30, fat: 42, sugar: 8 },
  { pattern: /กะเพรา|กระเพรา/i, menuName: "ข้าวกะเพรา", kcal: 650, carb: 70, protein: 30, fat: 28, sugar: 6 },
  { pattern: /มาม่า|บะหมี่|ก๋วยเตี๋ยว|ราเมง|เส้น/i, menuName: "เมนูเส้น", kcal: 480, carb: 65, protein: 20, fat: 14, sugar: 5 },
  { pattern: /เค้ก|ขนม|คุกกี้|โดนัท|ไอติม|บิงซู/i, menuName: "ของหวาน", kcal: 350, carb: 50, protein: 5, fat: 14, sugar: 34 },
];

const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

const hasFoodKeyword = (text = "") => {
  const value = normalize(text);
  return FOOD_KEYWORDS.some((word) => value.includes(word));
};

const isQuestionOrAdviceText = (text = "") => /(ไหม|มั้ย|ปะ|ป่ะ|ดีไหม|ดีมั้ย|อะไรดี|กี่แคล|แคลเท่าไร|แคลเท่าไหร่|ควรกิน|กินได้ไหม)/i.test(text);

const isLikelyShortFoodText = (text = "") => {
  const value = normalize(text).replace(/^กิน\s+/, "");
  if (!value || value.length > 140) return false;
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

const buildLoggedReply = ({ meal, total, target, estimateMode }) => {
  const left = Math.max(target - total, 0);
  const estimateNote = estimateMode === "local" ? "แปะนับแบบเร็วคร่าว ๆ ให้นะ 👀" : "แปะประเมินให้แล้ว 😋";
  return [
    [
      `โอเค แปะจดให้แล้ว 😋`,
      `🍽️ ${meal.menuName}`,
      `🔥 ~${Math.round(meal.kcal)} kcal`,
      `🍚 คาร์บ ${Math.round(meal.carb)}g / 💪 โปรตีน ${Math.round(meal.protein)}g / 🥑 ไขมัน ${Math.round(meal.fat)}g`,
      `📏 ปริมาณ: ${meal.portionLabel}`,
      `🧾 ${estimateNote}`,
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

const splitFoodText = (text = "") => normalize(text)
  .replace(/^กิน\s+/, "")
  .split(/\s*(?:\+|,|และ|กับ|\n)\s*/i)
  .map((item) => item.trim())
  .filter(Boolean);

const estimateFoodLocally = (text = "") => {
  const normalized = normalize(text).replace(/^กิน\s+/, "");
  const matched = [];

  for (const preset of LOCAL_FOOD_PRESETS) {
    if (preset.pattern.test(normalized)) matched.push(preset);
  }

  const parts = splitFoodText(text);
  const isComplex = parts.length >= 2 || matched.length >= 2 || normalized.length >= 28;
  if (!isComplex || matched.length === 0) return null;

  const totals = matched.reduce((acc, item) => ({
    kcal: acc.kcal + item.kcal,
    carb: acc.carb + item.carb,
    protein: acc.protein + item.protein,
    fat: acc.fat + item.fat,
    sugar: acc.sugar + item.sugar,
  }), { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });

  const menuName = matched.map((item) => item.menuName).filter(Boolean).join(" + ");
  return {
    menuName: menuName || normalized,
    ...totals,
    confidence: "medium",
    estimateMode: "local",
  };
};

const estimateFood = async (text) => {
  const local = estimateFoodLocally(text);
  if (local) return local;

  const aiStart = nowMs();
  const foodData = await estimateFoodFromText(text);
  logTiming("fastFoodText:estimateOpenAI", aiStart, `text=${text} menu=${foodData?.menuName || ""}`);
  return { ...foodData, estimateMode: "openai" };
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

  const estimateStart = nowMs();
  const foodData = await estimateFood(text);
  logTiming("fastFoodText:estimate", estimateStart, `mode=${foodData?.estimateMode || "unknown"} text=${text} menu=${foodData?.menuName || ""}`);

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
    source: foodData?.estimateMode === "local" ? "text_fast_local" : "text_fast_openai",
    portionLevel: portion.level,
    portionLabel: portion.label,
    portionNote: portion.note,
    confidence: foodData?.confidence || "medium",
  });
  invalidateRichMenuSummaryCache(userId);

  const total = safeNumber(result.todayCalories ?? result.totalToday, meal.kcal);
  const target = safeNumber(result.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyTexts(replyToken, buildLoggedReply({ meal: { ...meal, portionLabel: portion.label }, total, target, estimateMode: foodData?.estimateMode }));

  logTiming("event:fastFoodText", start, `estimateMode=${foodData?.estimateMode || "unknown"} source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""} portion=${portion.level}`);
  return true;
};
