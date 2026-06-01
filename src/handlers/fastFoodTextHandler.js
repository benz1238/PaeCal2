import { replyTexts, replyFlex } from "../services/line.js";
import { getSession, updateSession, logFood, logFoodTermCandidate } from "../services/db.js";
import { estimateFoodFromText } from "../services/openai.js";
import { findFoodPreset } from "../services/brandFoodPresets.js";
import { safeNumber, DEFAULT_CALORIE_TARGET } from "../utils/helpers.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";
import { buildFoodLogFlexMessage } from "../utils/foodLogFlex.js";

const nowMs = () => Date.now();
const logTiming = (label, start, extra = "") => console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/^กิน\s+/, "");

const BLOCKLIST = ["สรุป", "สรุปวันนี้", "แคลวันนี้", "กินอะไรดี", "กินไรดี", "หิวแล้ว", "ตั้งเป้า", "เปลี่ยนเป้า", "แก้มื้อล่าสุด", "ลบมื้อล่าสุด", "ฉายาวันนี้", "วันนี้อาหารฟ้องว่า"];

const KEYWORD_PATTERN = /(ข้าว|ก๋วยเตี๋ยว|บะหมี่|ราเมง|เส้น|โจ๊ก|หมู|ไก่|ปลา|กุ้ง|เนื้อ|ไข่|เต้าหู้|แซลมอน|ซูชิ|กะเพรา|กระเพรา|ส้มตำ|ลาบ|ยำ|สลัด|ชาบู|หมูกระทะ|หมูทะ|ปิ้งย่าง|ไส้กรอก|ลูกชิ้น|ชีส|ทอด|แซนด์วิช|ขนมปัง|ครัวซองต์|ชาไทย|ชานม|ชาเขียว|มัจฉะ|มัทฉะ|กาแฟ|อเมริกาโน่|ลาเต้|คาปูชิโน่|มอคค่า|โกโก้|นม|น้ำเต้าหู้|น้ำหวาน|น้ำผลไม้|น้ำส้ม|โค้ก|โค๊ก|เป๊ปซี่|เค้ก|ขนม|ป๊อกกี้|โอริโอ้|โอริโอ|คิทแคท|ช็อกโกแลต|คุกกี้|โดนัท|ไอติม|บิงซู|บลิซซาร์ด|บลิดซาด|แดรี่ควีน|เลย์|ผลไม้|กล้วย|แตงโม|มะม่วง|แอปเปิล|ส้ม|ฝรั่ง|สับปะรด|oreo|blizzard|dq|lays|sushi|sashimi|americano|latte)/i;
const QUESTION_PATTERN = /(ไหม|มั้ย|ปะ|ป่ะ|ดีไหม|ดีมั้ย|อะไรดี|กี่แคล|แคลเท่าไร|แคลเท่าไหร่|ควรกิน|กินได้ไหม)/i;

const resolvePorkLegRicePreset = (text = "") => {
  const value = normalize(text).replace(/\s+/g, "");
  if (!/ข้าวขาหมู/.test(value)) return null;

  const isExtra = /(พิเศษ|เพิ่ม|เยอะ|จัมโบ้|ใหญ่)/.test(value);
  const isLean = /(เนื้อล้วน|ล้วน|ไม่เอาหนัง|ไม่หนัง|ไม่มัน|เอาแต่เนื้อ)/.test(value);
  const isSkin = /(เนื้อหนัง|หนัง|ติดหนัง|ติดมัน)/.test(value);
  const isKaki = /(คากิ|ขากิ)/.test(value);

  let profile = { kcal: 800, carb: 85, protein: 36, fat: 35, menuName: "ข้าวขาหมู" };

  if (isLean) profile = { kcal: 700, carb: 82, protein: 40, fat: 22, menuName: "ข้าวขาหมูเนื้อล้วน" };
  else if (isKaki) profile = { kcal: 930, carb: 82, protein: 32, fat: 55, menuName: "ข้าวขาหมูคากิ" };
  else if (isSkin) profile = { kcal: 850, carb: 85, protein: 36, fat: 45, menuName: "ข้าวขาหมูเนื้อหนัง" };

  if (isExtra) {
    profile = {
      ...profile,
      kcal: Math.round(profile.kcal * 1.22),
      carb: Math.round(profile.carb * 1.15),
      protein: Math.round(profile.protein * 1.2),
      fat: Math.round(profile.fat * 1.2),
      menuName: `${profile.menuName}พิเศษ`,
    };
  } else if (/(ธรรมดา|ปกติ)/.test(value)) {
    profile = { ...profile, menuName: `${profile.menuName}ธรรมดา` };
  }

  return {
    ...profile,
    sugar: 5,
    confidence: "high",
    estimateMode: "local_pork_leg_rice",
    items: [{ name: profile.menuName, quantity: isExtra ? "1 จานพิเศษ" : "1 จาน", kcal: profile.kcal }],
  };
};

const FAST_PRESETS = [
  { pattern: /โอริโอ้|โอริโอ|oreo/i, menuName: "โอริโอ", kcal: 260, carb: 38, protein: 3, fat: 11, sugar: 22 },
  { pattern: /บลิซซาร์ด|บลิดซาด|blizzard|dq|แดรี่ควีน/i, menuName: "บลิซซาร์ด", kcal: 350, carb: 52, protein: 8, fat: 12, sugar: 40 },
  { pattern: /โค้ก\s*ซีโร่|โค๊ก\s*ซีโร่|coke\s*zero/i, menuName: "โค้กซีโร่", kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 },
  { pattern: /อเมริกาโน่|อเมริกาโน|americano|กาแฟดำ/i, menuName: "อเมริกาโน่", kcal: 15, carb: 2, protein: 1, fat: 0, sugar: 0 },
  { pattern: /โค้ก|โค๊ก|coke/i, menuName: "โค้กกระป๋อง", kcal: 140, carb: 35, protein: 0, fat: 0, sugar: 35 },
  { pattern: /ป๊อกกี้|pocky/i, menuName: "ป๊อกกี้", kcal: 220, carb: 32, protein: 4, fat: 9, sugar: 18 },
];

const isLikelyShortFoodText = (text = "") => {
  const value = normalize(text);
  if (!value || value.length > 140) return false;
  if (BLOCKLIST.some((word) => value === normalize(word) || value.includes(normalize(word)))) return false;
  if (QUESTION_PATTERN.test(value)) return false;
  return KEYWORD_PATTERN.test(value);
};

const buildGoalFoodGuardReply = (foodText) => [
  ["เอ้า! อันนี้ของกินนะ 👀", "ยังไม่ใช่เป้าหมายอะ", "ถ้าจะให้แปะลงมื้อ", `พิมพ์: กิน ${foodText}`].join("\n"),
  ["หรือส่งรูปมาเลยก็ได้", "เดี๋ยวแปะอ่านทรงให้ 📸", "ถ้าจะตั้งเป้า ลองพิมพ์:", "เป้าหมาย กินให้พอดี", "เป้าหมาย เพิ่มแรง", "เป้าหมาย คุมหวาน"].join("\n"),
];

const resolveTextPortion = ({ kcal = 0 } = {}) => {
  if (kcal >= 750) return { level: "heavy", label: "ค่อนข้างเยอะ", note: "แปะนับเป็น 1 เสิร์ฟแบบร้านทั่วไปก่อนนะ" };
  if (kcal <= 320) return { level: "light", label: "ค่อนข้างเบา", note: "แปะนับเป็น 1 เสิร์ฟเบา ๆ ก่อนนะ" };
  return { level: "normal", label: "พอดี", note: "แปะนับเป็น 1 เสิร์ฟทั่วไปก่อนนะ" };
};

const estimateFastPreset = (text = "") => resolvePorkLegRicePreset(text) || FAST_PRESETS.find((preset) => preset.pattern.test(normalize(text))) || null;

const estimateFood = async (text) => {
  const fastPreset = estimateFastPreset(text);
  if (fastPreset) return { ...fastPreset, estimateMode: fastPreset.estimateMode || "local" };

  const presetStart = nowMs();
  const preset = await findFoodPreset(text);
  if (preset) {
    logTiming("fastFoodText:estimatePreset", presetStart, `mode=${preset.estimateMode || "preset"} text=${text} menu=${preset.menuName || ""}`);
    return preset;
  }

  const aiStart = nowMs();
  const foodData = await estimateFoodFromText(text);
  logTiming("fastFoodText:estimateOpenAI", aiStart, `text=${text} menu=${foodData?.menuName || ""}`);
  return { ...foodData, estimateMode: "openai" };
};

const resolveCurrentTotal = ({ result = {}, session = {}, mealKcal = 0 } = {}) => {
  const sheetTotal = safeNumber(result.todayCalories ?? result.totalToday, 0);
  if (sheetTotal > 0) return sheetTotal;
  const cachedTotal = safeNumber(session.todayCalories ?? session.totalToday ?? session.data?.todayCalories ?? session.data?.totalToday, 0);
  if (cachedTotal > 0) return cachedTotal + safeNumber(mealKcal, 0);
  return safeNumber(mealKcal, 0);
};

const isZeroCalorieFood = (foodData = {}, text = "") => safeNumber(foodData?.kcal, 0) === 0 && /(zero|ซีโร่|ไม่หวาน|ไม่มีน้ำตาล|กาแฟดำ|อเมริกาโน่)/i.test(`${foodData?.menuName || ""} ${text}`);

export const handleFastFoodText = async (event) => {
  const start = nowMs();
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = String(event.message?.text || "").trim();
  if (!userId || !text || !isLikelyShortFoodText(text)) return false;

  const sessionStart = nowMs();
  const session = await getSession(userId);
  logTiming("fastFoodText:getSession", sessionStart, `source=${session.source || "unknown"}`);

  if (session.step === "ASK_GOAL_UPDATE" || session.step === "ASK_GOAL") {
    await updateSession({ userId, step: "READY", sessionData: session.data || {} });
    await replyTexts(replyToken, buildGoalFoodGuardReply(text));
    logTiming("event:goalFoodGuard", start, `text=${text}`);
    return true;
  }
  if (session.step && session.step !== "READY") return false;

  const estimateStart = nowMs();
  const foodData = await estimateFood(text);
  logTiming("fastFoodText:estimate", estimateStart, `mode=${foodData?.estimateMode || "unknown"} text=${text} menu=${foodData?.menuName || ""}`);
  const kcal = safeNumber(foodData?.kcal, 0);
  if (kcal <= 0 && !isZeroCalorieFood(foodData, text)) return false;

  if (foodData?.estimateMode === "openai") logFoodTermCandidate({ term: text, foodData, source: "openai", example: text }).catch(() => {});

  const meal = { menuName: foodData?.menuName || text, kcal, carb: safeNumber(foodData?.carb, 0), protein: safeNumber(foodData?.protein, 0), fat: safeNumber(foodData?.fat, 0), sugar: safeNumber(foodData?.sugar, 0) };
  const portion = resolveTextPortion({ kcal: meal.kcal });
  const requestId = `${event.message?.id || Date.now()}:fast-text-food`;
  invalidateRichMenuSummaryCache(userId);
  const result = await logFood({ userId, name: session.data?.name || "", menuName: meal.menuName, kcal: meal.kcal, carb: meal.carb, protein: meal.protein, fat: meal.fat, sugar: meal.sugar, requestId, source: foodData?.estimateMode === "local" || foodData?.estimateMode === "local_pork_leg_rice" ? "text_fast_local" : foodData?.estimateMode === "brand_preset" || foodData?.estimateMode === "drink_sweetness_preset" ? "text_fast_preset" : "text_fast_openai", portionLevel: portion.level, portionLabel: portion.label, portionNote: portion.note, confidence: foodData?.confidence || "medium" });
  invalidateRichMenuSummaryCache(userId);
  const total = resolveCurrentTotal({ result, session, mealKcal: meal.kcal });
  const target = safeNumber(result.calorieTarget ?? session.calorieTarget ?? session.data?.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyFlex(replyToken, buildFoodLogFlexMessage({ meal: { ...meal, portionLabel: portion.label }, total, target, estimateMode: foodData?.estimateMode }));
  logTiming("event:fastFoodText", start, `estimateMode=${foodData?.estimateMode || "unknown"} source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""} portion=${portion.level}`);
  return true;
};
