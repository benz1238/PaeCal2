import { replyTexts, replyText } from "../services/line.js";
import { getSession, updateSession, logFood, logFoodTermCandidate } from "../services/db.js";
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
  "ซูชิ", "ซูชิโระ", "ซาชิมิ", "มากิ", "sushi", "sashimi", "sushiro",
  "กะเพรา", "กระเพรา", "ข้าวมันไก่", "ข้าวขาหมู", "ข้าวหมูกรอบ", "ข้าวหมูแดง", "ข้าวผัด", "ข้าวไข่เจียว", "หมูทอด", "ข้าวหมูทอด", "ข้าวเหนียว",
  "ส้มตำ", "ลาบ", "น้ำตก", "ยำ", "สุกี้", "ชาบู", "หมูกระทะ", "หมูทะ", "ปิ้งย่าง", "บุฟเฟต์",
  "ไส้กรอก", "ลูกชิ้น", "ชีส", "ทอด", "ของทอด",
  "ชาไทย", "ชานม", "ชาเขียว", "มัจฉะ", "มัทฉะ", "กาแฟ", "อเมริกาโน่", "ลาเต้", "โกโก้", "นม", "น้ำเต้าหู้", "น้ำหวาน", "โค้ก", "โค๊ก", "เป๊ปซี่",
  "เค้ก", "ขนม", "คุกกี้", "โดนัท", "ไอติม", "บิงซู", "เลย์", "lays", "ผลไม้", "กล้วย", "แตงโม", "มะม่วง", "แอปเปิล", "แอปเปิ้ล", "ส้ม", "ส้มโอ",
];

const BLOCKLIST = [
  "สรุป", "สรุปวันนี้", "แคลวันนี้", "กินอะไรดี", "กินไรดี", "หิวแล้ว", "ตั้งเป้า", "เปลี่ยนเป้า",
  "แก้มื้อล่าสุด", "ลบมื้อล่าสุด", "ฉายาวันนี้", "วันนี้อาหารฟ้องว่า",
];

const LOCAL_FOOD_PRESETS = [
  { pattern: /ซูชิโระ|ซูชิ|ซาชิมิ|มากิ|sushiro|sushi|sashimi/i, menuName: "ซูชิ", kcal: 450, carb: 58, protein: 22, fat: 12, sugar: 8 },
  { pattern: /ชาบู|สุกี้|hot\s*pot/i, menuName: "ชาบู", kcal: 650, carb: 45, protein: 35, fat: 32, sugar: 10 },
  { pattern: /หมูกระทะ|หมูทะ|ปิ้งย่าง|บุฟเฟต์/i, menuName: "หมูกระทะ", kcal: 850, carb: 55, protein: 42, fat: 48, sugar: 12 },
  { pattern: /ข้าวไข่เจียว|ไข่เจียว/i, menuName: "ข้าวไข่เจียว", kcal: 520, carb: 62, protein: 18, fat: 22, sugar: 3 },
  { pattern: /ข้าวหมูทอด|หมูทอด/i, menuName: "ข้าวหมูทอด", kcal: 680, carb: 72, protein: 30, fat: 30, sugar: 5 },
  { pattern: /ข้าวเหนียว.*หมูปิ้ง|หมูปิ้ง.*ข้าวเหนียว/i, menuName: "ข้าวเหนียวหมูปิ้ง", kcal: 520, carb: 72, protein: 22, fat: 18, sugar: 10 },
  { pattern: /เลย์|lays?|มันฝรั่งทอด|โปเตโต้ชิป/i, menuName: "เลย์/มันฝรั่งทอด", kcal: 320, carb: 36, protein: 4, fat: 18, sugar: 2 },
  { pattern: /อเมริกาโน่|อเมริกาโน|americano|กาแฟดำ/i, menuName: "อเมริกาโน่", kcal: 15, carb: 2, protein: 1, fat: 0, sugar: 0 },
  { pattern: /ลาเต้|latte/i, menuName: "ลาเต้", kcal: 180, carb: 18, protein: 8, fat: 8, sugar: 14 },
  { pattern: /น้ำเต้าหู้|นมถั่วเหลือง/i, menuName: "น้ำเต้าหู้", kcal: 140, carb: 16, protein: 8, fat: 4, sugar: 10 },
  { pattern: /กล้วย/i, menuName: "กล้วย", kcal: 100, carb: 26, protein: 1, fat: 0, sugar: 14 },
  { pattern: /แอปเปิล|แอปเปิ้ล|apple/i, menuName: "แอปเปิล", kcal: 80, carb: 21, protein: 0, fat: 0, sugar: 16 },
  { pattern: /ส้มโอ/i, menuName: "ส้มโอ", kcal: 90, carb: 22, protein: 1, fat: 0, sugar: 14 },
  { pattern: /ส้ม/i, menuName: "ส้ม", kcal: 70, carb: 17, protein: 1, fat: 0, sugar: 12 },
  { pattern: /ไส้กรอกชีส/i, menuName: "ไส้กรอกชีส", kcal: 260, carb: 10, protein: 10, fat: 20, sugar: 2 },
  { pattern: /ไส้กรอก/i, menuName: "ไส้กรอก", kcal: 180, carb: 7, protein: 8, fat: 13, sugar: 2 },
  { pattern: /ลูกชิ้นทอด/i, menuName: "ลูกชิ้นทอด", kcal: 280, carb: 28, protein: 12, fat: 14, sugar: 4 },
  { pattern: /ชาเขียวมัจฉะ|ชาเขียวมัทฉะ|มัจฉะ|มัทฉะ|matcha/i, menuName: "ชาเขียวมัจฉะ", kcal: 180, carb: 28, protein: 4, fat: 5, sugar: 22 },
  { pattern: /ชาไทย/i, menuName: "ชาไทย", kcal: 220, carb: 35, protein: 3, fat: 6, sugar: 30 },
  { pattern: /ชานม/i, menuName: "ชานม", kcal: 280, carb: 45, protein: 4, fat: 8, sugar: 36 },
  { pattern: /ข้าวแกง\s*(สอง|2)\s*อย่าง|ข้าวราดแกง/i, menuName: "ข้าวแกงสองอย่าง", kcal: 650, carb: 82, protein: 24, fat: 24, sugar: 8 },
  { pattern: /ไก่ทอด/i, menuName: "ไก่ทอด", kcal: 420, carb: 30, protein: 24, fat: 24, sugar: 4 },
  { pattern: /หมูปิ้ง/i, menuName: "หมูปิ้ง", kcal: 320, carb: 18, protein: 18, fat: 20, sugar: 8 },
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

const buildGoalFoodGuardReply = (foodText) => [
  [
    "เอ้า! อันนี้ของกินนะ 👀",
    "ยังไม่ใช่เป้าหมายอะ",
    "ถ้าจะให้แปะลงมื้อ",
    `พิมพ์: กิน ${foodText}`,
  ].join("\n"),
  [
    "หรือส่งรูปมาเลยก็ได้",
    "เดี๋ยวแปะอ่านทรงให้ 📸",
    "ถ้าจะตั้งเป้า ลองพิมพ์:",
    "เป้าหมาย กินให้พอดี",
    "เป้าหมาย เพิ่มแรง",
    "เป้าหมาย คุมหวาน",
  ].join("\n"),
];

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
      left > 0 ? "ยังมีพื้นที่อยู่ แต่อย่าเจี๊ยะเพลินเกินนะ" : "มื้อถัดไปเบาลงหน่อย แปะว่าเอากลับมาได้",
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
  for (const preset of LOCAL_FOOD_PRESETS) if (preset.pattern.test(normalized)) matched.push(preset);
  if (matched.length === 0) return null;

  const parts = splitFoodText(text);
  const isSimpleSinglePreset = matched.length === 1 && parts.length <= 1 && normalized.length <= 40;
  const isComplex = parts.length >= 2 || matched.length >= 2 || normalized.length >= 28;
  if (!isSimpleSinglePreset && !isComplex) return null;

  const totals = matched.reduce((acc, item) => ({ kcal: acc.kcal + item.kcal, carb: acc.carb + item.carb, protein: acc.protein + item.protein, fat: acc.fat + item.fat, sugar: acc.sugar + item.sugar }), { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 });
  const menuName = isSimpleSinglePreset ? matched[0].menuName : matched.map((item) => item.menuName).filter(Boolean).join(" + ");
  return { menuName: menuName || normalized, ...totals, confidence: "medium", estimateMode: "local" };
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
  if (!isLikelyShortFoodText(text)) return false;

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
  if (kcal <= 0) return false;

  if (foodData?.estimateMode === "openai") {
    logFoodTermCandidate({ term: text, foodData, source: "openai", example: text }).catch(() => {});
  }

  const meal = { menuName: foodData?.menuName || text, kcal, carb: safeNumber(foodData?.carb, 0), protein: safeNumber(foodData?.protein, 0), fat: safeNumber(foodData?.fat, 0), sugar: safeNumber(foodData?.sugar, 0) };
  const portion = resolveTextPortion({ kcal: meal.kcal });
  const requestId = `${event.message?.id || Date.now()}:fast-text-food`;
  invalidateRichMenuSummaryCache(userId);
  const result = await logFood({ userId, name: session.data?.name || "", menuName: meal.menuName, kcal: meal.kcal, carb: meal.carb, protein: meal.protein, fat: meal.fat, sugar: meal.sugar, requestId, source: foodData?.estimateMode === "local" ? "text_fast_local" : "text_fast_openai", portionLevel: portion.level, portionLabel: portion.label, portionNote: portion.note, confidence: foodData?.confidence || "medium" });
  invalidateRichMenuSummaryCache(userId);
  const total = safeNumber(result.todayCalories ?? result.totalToday, meal.kcal);
  const target = safeNumber(result.calorieTarget, DEFAULT_CALORIE_TARGET);
  await replyTexts(replyToken, buildLoggedReply({ meal: { ...meal, portionLabel: portion.label }, total, target, estimateMode: foodData?.estimateMode }));
  logTiming("event:fastFoodText", start, `estimateMode=${foodData?.estimateMode || "unknown"} source=${result.source || "unknown"} supabaseWrite=${result.supabaseWrite || ""} portion=${portion.level}`);
  return true;
};
