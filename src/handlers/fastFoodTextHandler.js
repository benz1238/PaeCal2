import { replyTexts, replyFlex } from "../services/line.js";
import { getSession, updateSession, logFood, logFoodTermCandidate } from "../services/db.js";
import { estimateFoodFromText } from "../services/openai.js";
import { findFoodPreset } from "../services/brandFoodPresets.js";
import { safeNumber, DEFAULT_CALORIE_TARGET } from "../utils/helpers.js";
import { invalidateRichMenuSummaryCache } from "../utils/richMenuSummaryCache.js";
import { buildFoodLogFlexMessage } from "../utils/foodLogFlex.js";
import { resolveLocalFoodEstimate } from "../utils/localFoodEstimates.js";

const nowMs = () => Date.now();
const logTiming = (label, start, extra = "") => console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
const normalize = (text = "") => String(text || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/^กิน\s+/, "");

const BLOCKLIST = ["สรุป", "สรุปวันนี้", "แคลวันนี้", "กินอะไรดี", "กินไรดี", "หิวแล้ว", "ตั้งเป้า", "เปลี่ยนเป้า", "แก้มื้อล่าสุด", "ลบมื้อล่าสุด", "ฉายาวันนี้", "วันนี้อาหารฟ้องว่า"];

const KEYWORD_PATTERN = /(ข้าว|ก๋วยเตี๋ยว|บะหมี่|ราเมง|เส้น|โจ๊ก|หมู|ไก่|ปลา|กุ้ง|เนื้อ|ไข่|เต้าหู้|แซลมอน|ซูชิ|กะเพรา|กระเพรา|ส้มตำ|ลาบ|ยำ|สลัด|ชาบู|หมูกระทะ|หมูทะ|ปิ้งย่าง|ไส้กรอก|ลูกชิ้น|ชีส|โยเกิร์ต|กรีกโยเกิร์ต|บารอน|ทอด|แซนด์วิช|ขนมปัง|ครัวซองต์|ชาไทย|ชานม|ชาเขียว|มัจฉะ|มัทฉะ|กาแฟ|อเมริกาโน่|ลาเต้|คาปูชิโน่|มอคค่า|โกโก้|นม|น้ำเต้าหู้|น้ำหวาน|น้ำผลไม้|น้ำส้ม|โค้ก|โค๊ก|เป๊ปซี่|เค้ก|ขนม|ป๊อกกี้|โอริโอ้|โอริโอ|คิทแคท|ช็อกโกแลต|คุกกี้|โดนัท|ไอติม|บิงซู|บลิซซาร์ด|บลิดซาด|แดรี่ควีน|เลย์|ผลไม้|กล้วย|แตงโม|มะม่วง|แอปเปิล|ส้ม|ฝรั่ง|สับปะรด|oreo|blizzard|dq|lays|sushi|sashimi|americano|latte|yogurt|greek|baron|cheese baron)/i;
const QUESTION_PATTERN = /(ไหม|มั้ย|ปะ|ป่ะ|ดีไหม|ดีมั้ย|อะไรดี|กี่แคล|แคลเท่าไร|แคลเท่าไหร่|ควรกิน|กินได้ไหม)/i;

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const toArabicDigits = (value = "") => String(value || "").replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));
const roundFoodValue = (value = 0) => Math.max(0, Math.round(safeNumber(value, 0)));

const FAST_PRESETS = [
  { pattern: /(the\s*cheese\s*baron|cheese\s*baron|ชีส\s*บารอน|กรีก\s*โยเกิร์ต\s*บารอน|โยเกิร์ต\s*บารอน|บารอน).*(ออริจินัล|original)?|(?:ออริจินัล|original).*(the\s*cheese\s*baron|cheese\s*baron|ชีส\s*บารอน|กรีก\s*โยเกิร์ต\s*บารอน|โยเกิร์ต\s*บารอน|บารอน)/i, menuName: "กรีกโยเกิร์ตบารอน ออริจินัล", kcal: 160, carb: 5, protein: 9, fat: 11, sugar: 2, estimateMode: "local_brand_preset" },
  { pattern: /โอริโอ้|โอริโอ|oreo/i, menuName: "โอริโอ", kcal: 260, carb: 38, protein: 3, fat: 11, sugar: 22, estimateMode: "local" },
  { pattern: /บลิซซาร์ด|บลิดซาด|blizzard|dq|แดรี่ควีน/i, menuName: "บลิซซาร์ด", kcal: 350, carb: 52, protein: 8, fat: 12, sugar: 40, estimateMode: "local" },
  { pattern: /โค้ก\s*ซีโร่|โค๊ก\s*ซีโร่|coke\s*zero/i, menuName: "โค้กซีโร่", kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0, estimateMode: "local" },
  { pattern: /อเมริกาโน่|อเมริกาโน|americano|กาแฟดำ/i, menuName: "อเมริกาโน่", kcal: 15, carb: 2, protein: 1, fat: 0, sugar: 0, estimateMode: "local" },
  { pattern: /โค้ก|โค๊ก|coke/i, menuName: "โค้กกระป๋อง", kcal: 140, carb: 35, protein: 0, fat: 0, sugar: 35, estimateMode: "local" },
  { pattern: /ป๊อกกี้|pocky/i, menuName: "ป๊อกกี้", kcal: 220, carb: 32, protein: 4, fat: 9, sugar: 18, estimateMode: "local" },
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

const resolveTextPortion = ({ kcal = 0, sharedDivisor = 1 } = {}) => {
  if (sharedDivisor > 1) return { level: "shared", label: `หาร ${sharedDivisor} คน`, note: `แปะหารจากทั้งจานเป็นส่วนของลื้อ 1/${sharedDivisor} แล้วนะ` };
  if (kcal >= 750) return { level: "heavy", label: "ค่อนข้างเยอะ", note: "แปะนับเป็น 1 เสิร์ฟแบบร้านทั่วไปก่อนนะ" };
  if (kcal <= 320) return { level: "light", label: "ค่อนข้างเบา", note: "แปะนับเป็น 1 เสิร์ฟเบา ๆ ก่อนนะ" };
  return { level: "normal", label: "พอดี", note: "แปะนับเป็น 1 เสิร์ฟทั่วไปก่อนนะ" };
};

const stripSharedPortionSyntax = (value = "") => normalize(value)
  .replace(/\/\s*\d{1,2}\s*(?:คน)?/i, "")
  .replace(/(?:หาร|แบ่ง|แชร์|กินกัน|กินด้วยกัน)\s*\d{1,2}\s*คน/i, "")
  .replace(/(?:สำหรับ|ของ)\s*\d{1,2}\s*คน/i, "")
  .replace(/\s+/g, " ")
  .trim();

const resolveSharedPortion = (text = "") => {
  const value = toArabicDigits(normalize(text));
  const patterns = [
    /(?:^|\s)\/\s*(\d{1,2})\s*(?:คน)?(?:\s|$)/i,
    /(?:หาร|แบ่ง|แชร์|กินกัน|กินด้วยกัน)\s*(\d{1,2})\s*คน/i,
    /(?:สำหรับ|ของ)\s*(\d{1,2})\s*คน/i,
  ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  const divisor = match ? Number(match[1]) : 1;

  if (!Number.isFinite(divisor) || divisor <= 1 || divisor > 20) {
    return { divisor: 1, estimateText: text, label: "" };
  }

  const estimateText = stripSharedPortionSyntax(value) || normalize(text);
  return { divisor, estimateText, label: `หาร ${divisor} คน` };
};

const applySharedPortion = (meal = {}, shared = {}) => {
  const divisor = safeNumber(shared.divisor, 1);
  if (divisor <= 1) return meal;

  const menuName = meal.menuName || shared.estimateText || "มื้อนี้";
  return {
    ...meal,
    menuName: `${menuName} (${shared.label})`,
    kcal: roundFoodValue(meal.kcal / divisor),
    carb: roundFoodValue(meal.carb / divisor),
    protein: roundFoodValue(meal.protein / divisor),
    fat: roundFoodValue(meal.fat / divisor),
    sugar: roundFoodValue(meal.sugar / divisor),
  };
};

const estimateFastPreset = (text = "") => resolveLocalFoodEstimate(text) || FAST_PRESETS.find((preset) => preset.pattern.test(normalize(text))) || null;

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
const isLocalEstimateMode = (mode = "") => String(mode || "").startsWith("local");

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

  const sharedPortion = resolveSharedPortion(text);
  const estimateText = sharedPortion.estimateText || text;

  const estimateStart = nowMs();
  const foodData = await estimateFood(estimateText);
  logTiming("fastFoodText:estimate", estimateStart, `mode=${foodData?.estimateMode || "unknown"} text=${text} estimateText=${estimateText} menu=${foodData?.menuName || ""} sharedDivisor=${sharedPortion.divisor || 1}`);
  const kcal = safeNumber(foodData?.kcal, 0);
  if (kcal <= 0 && !isZeroCalorieFood(foodData, estimateText)) return false;

  if (foodData?.estimateMode === "openai") logFoodTermCandidate({ term: estimateText, foodData, source: "openai", example: text }).catch(() => {});

  const baseMeal = { menuName: foodData?.menuName || estimateText, kcal, carb: safeNumber(foodData?.carb, 0), protein: safeNumber(foodData?.protein, 0), fat: safeNumber(foodData?.fat, 0), sugar: safeNumber(foodData?.sugar, 0) };
  const meal = applySharedPortion(baseMeal, sharedPortion);
  const portion = resolveTextPortion({ kcal: meal.kcal, sharedDivisor: sharedPortion.divisor });
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
    source: isLocalEstimateMode(foodData?.estimateMode) ? "text_fast_local" : foodData?.estimateMode === "brand_preset" || foodData?.estimateMode === "drink_sweetness_preset" ? "text_fast_preset" : "text_fast_openai",
    portionLevel: portion.level,
    portionLabel: portion.label,
    portionNote: portion.note,
    confidence: foodData?.confidence || "medium",
  });
  invalidateRichMenuSummaryCache(userId);
  const total = resolveCurrentTotal({ result, session, mealKcal: meal.kcal });
  const target = safeNumber(result.calorieTarget ?? session.calorieTarget ?? session.data?.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyFlex(replyToken, buildFoodLogFlexMessage({ meal: { ...meal, portionLabel: portion.label }, total, target, estimateMode: foodData?.estimateMode }));
  logTiming("event:fastFoodText", start, `estimateMode=${foodData?.estimateMode || "unknown"} source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""} portion=${portion.level} sharedDivisor=${sharedPortion.divisor || 1}`);
  return true;
};
