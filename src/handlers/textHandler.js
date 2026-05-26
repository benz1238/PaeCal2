import { pushDailyRecapCardWithBubbles, pushTexts, replyDailyRecapCardWithBubbles, replyText, replyTexts } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { estimateFoodFromText, parseUserIntent, reviseFoodEstimateFromCorrection } from "../services/openai.js";
import {
  calculateTDEE,
  DEFAULT_CALORIE_TARGET,
  safeNumber,
} from "../utils/helpers.js";
import {
  buildTitleFromProfile,
  getDisplayTitle,
  getProfile,
  getTitle,
  syncSessionFromProfile,
} from "../utils/profile.js";
import {
  buildProgressBar,
  getMealSuggestionText,
  getSummaryText,
} from "../utils/advice.js";
import {
  decideDailyRecap,
  decideFoodLog,
  decideMealSuggestion,
} from "../utils/decision.js";
import {
  renderDailyRecapMessages,
  renderDailyRecapReply,
  renderFoodLogMessages,
  renderFoodLogReply,
  renderMealSuggestionReply,
} from "../utils/personality.js";

const getSession = async (userId) => {
  const session = await postToSheet({ action: "GET_SESSION", userId });

  return {
    step: session?.step || "READY",
    data: session?.data || {},
    ...session,
  };
};


const nowMs = () => Date.now();

const logTiming = (scope, step, startedAt, extra = "") => {
  const ms = Date.now() - startedAt;
  console.log(`[PaeCalTiming] ${scope}:${step} ${ms}ms${extra ? ` ${extra}` : ""}`);
  return ms;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryOnce = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    await wait(350);
    return fn();
  }
};

const getMessageRequestId = (event, suffix = "text") => {
  const messageId = event?.message?.id || `${event?.source?.userId || "user"}-${Date.now()}`;
  return `${messageId}:${suffix}`;
};

const saveProfile = async (payload) => postToSheet({ action: "SAVE_PROFILE", ...payload });
const updateSession = async (payload) => postToSheet({ action: "UPDATE_SESSION", ...payload });
const logFood = async (payload) => postToSheet({ action: "LOG_FOOD", ...payload });
const batchLogFood = async (payload) => postToSheet({ action: "BATCH_LOG_FOOD", ...payload });
const getDailySummary = async (userId) => {
  const t = nowMs();
  try {
    return await postToSheet({ action: "GET_DAILY_SUMMARY", userId });
  } finally {
    logTiming("text", "getDailySummary", t);
  }
};

const getDailySummaryFresh = async (userId) => {
  const t = nowMs();
  try {
    return await postToSheet({ action: "GET_DAILY_SUMMARY", userId, forceRebuild: true });
  } finally {
    logTiming("text", "getDailySummaryFresh", t);
  }
};
const getLastMeal = async (userId) => postToSheet({ action: "GET_LAST_MEAL", userId });
const updateLastMeal = async (payload) => retryOnce(() => postToSheet({ action: "UPDATE_LAST_MEAL", ...payload }));
const updateMealByRequestId = async (payload) => retryOnce(() => postToSheet({ action: "UPDATE_MEAL_BY_REQUEST_ID", ...payload }));
const deleteLastMeal = async (userId) => retryOnce(() => postToSheet({ action: "DELETE_LAST_MEAL", userId }));

const exactTexts = (list, text) => list.includes(String(text || "").trim());

const normalizeText = (text) => String(text || "").trim().toLowerCase();

const hasAnyText = (text, words = []) => {
  const value = normalizeText(text);
  return words.some((word) => value.includes(word));
};

const getLocalIntent = (text) => {
  const value = normalizeText(text);

  if (!value) return null;

  if (/^(กินไรดี|กินอะไรดี|กินไรดี\?|กินอะไรดี\?|หิวแล้ว|หาไรกินดี|เอาไรกินดี)$/.test(value)) {
    return { intent: "meal_suggestion", confidence: 1, action: "suggest_meal", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (!hasFoodKeyword(value) && hasAnyText(value, ["กินไรดี", "กินอะไรดี", "หาไรกินดี", "เอาไรกินดี", "แนะนำเมนู", "เมนูสุขภาพ", "หิว"])) {
    return { intent: "meal_suggestion", confidence: 0.95, action: "suggest_meal", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (hasAnyText(value, ["สรุปวันนี้", "แคลวันนี้", "เหลือกี่แคล", "กินไปเท่าไหร่", "กินไปเท่าไร", "วันนี้กินอะไรไปบ้าง"])) {
    return { intent: "daily_summary", confidence: 0.98, action: "daily_summary", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (hasAnyText(value, ["ลบมื้อล่าสุด", "ลบมื้อเมื่อกี้", "ลบอันเมื่อกี้", "ส่งผิด", "ไม่เอามื้อนี้"])) {
    return { intent: "delete_last_meal", confidence: 0.98, action: "delete_last_meal", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (/^(แก้มื้อล่าสุด|แก้ไขมื้อล่าสุด|แก้มื้อเมื่อกี้|แก้เมนูล่าสุด)$/.test(value)) {
    return { intent: "meal_edit_help", confidence: 1, action: "ask_edit_detail", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (hasAnyText(value, ["แก้มื้อล่าสุดเป็น", "แก้ไขมื้อล่าสุดเป็น", "แก้เมนูล่าสุดเป็น", "ไม่ใช่", "เปลี่ยนเป็น", "แก้เป็น"])) {
    const kcal = extractKcalFromText(value);
    const foodText = extractMenuFromEditText(text);
    return { intent: "edit_last_meal", confidence: 0.9, action: foodText ? "update_menu" : "update_kcal", multiplier: 0, foodText, kcal, source: "local" };
  }

  if (hasAnyText(value, ["อีกจาน", "อีกกล่อง", "เบิ้ล", "เพิ่มอีก", "ครึ่งเดียว", "กินครึ่ง", "กินไม่หมด", "เหลือครึ่ง"])) {
    const multiplier = hasAnyText(value, ["ครึ่งเดียว", "กินครึ่ง", "กินไม่หมด", "เหลือครึ่ง"]) ? -0.5 : 1;
    return { intent: "adjust_last_meal", confidence: 0.9, action: "adjust_amount", multiplier, foodText: "", kcal: null, source: "local" };
  }

  if (hasAnyText(value, ["ตั้งเป้า", "เปลี่ยนเป้า", "ลดไขมัน", "เพิ่มกล้าม", "คุมแคล", "คุมน้ำหนัก", "กินสุขภาพดี"])) {
    return { intent: "health_goal", confidence: 0.9, action: "update_goal", multiplier: 0, foodText: "", kcal: null, source: "local" };
  }

  if (EAT_LOG_PREFIX_PATTERN.test(value) && hasFoodKeyword(stripEatLogPrefix(text))) {
    return { intent: "log_food_text", confidence: 0.88, action: "log_food", multiplier: 0, foodText: stripEatLogPrefix(text), kcal: null, source: "local" };
  }

  return null;
};


const FOOD_ADVICE_QUESTION_WORDS = [
  "ดีไหม", "ดีมั้ย", "ดีปะ", "ดีป่ะ", "ดีป่าว", "ดีเปล่า",
  "โอเคไหม", "โอเคมั้ย", "โอเคปะ", "โอเคป่ะ",
  "ได้ไหม", "ได้มั้ย", "ได้ปะ", "ได้ป่ะ", "ได้ป่าว",
  "เหมาะไหม", "เหมาะมั้ย", "ควรไหม", "ควรมั้ย", "ควรปะ", "ควรป่ะ",
  "กินได้ไหม", "กินได้มั้ย", "กินดีไหม", "กินดีมั้ย", "กินดีปะ", "กินดีป่ะ",
  "อ้วนไหม", "อ้วนมั้ย", "หนักไหม", "หนักมั้ย", "พังไหม", "พังมั้ย", "พังปะ", "พังป่ะ"
];

const FOOD_ADVICE_KEYWORDS = [
  "ข้าว", "ก๋วยเตี๋ยว", "สุกี้", "เกาเหลา", "ต้ม", "แกง", "ยำ", "สลัด", "ซุป", "โจ๊ก", "ข้าวต้ม",
  "ไก่", "หมู", "ปลา", "กุ้ง", "ไข่", "เต้าหู้", "เนื้อ", "อกไก่", "ทะเล",
  "ทอด", "ย่าง", "นึ่ง", "ลวก", "ผัด", "มัน", "หวาน", "น้ำหวาน", "ชานม", "กาแฟ", "โกโก้",
  "ขนม", "เค้ก", "คุกกี้", "เบเกอรี่", "โยเกิร์ต", "นม", "หมูกระทะ", "ชาบู", "พิซซ่า", "เบอร์เกอร์",
  "มาม่า", "บะหมี่", "ราเมง", "ซูชิ", "แซลมอน", "ส้มตำ", "ลาบ", "น้ำตก", "กะเพรา", "กระเพรา",
  "ข้าวมันไก่", "ข้าวหมูแดง", "ข้าวหมูกรอบ", "ข้าวผัด", "ผัดไทย", "ชาไทย", "มัทฉะ", "ไอติม", "บิงซู"
];

const FOOD_STOP_WORD_PATTERN = /(ดีไหม|ดีมั้ย|ดีปะ|ดีป่ะ|ดีป่าว|ดีเปล่า|โอเคไหม|โอเคมั้ย|โอเคปะ|โอเคป่ะ|ได้ไหม|ได้มั้ย|ได้ปะ|ได้ป่ะ|ได้ป่าว|เหมาะไหม|เหมาะมั้ย|ควรไหม|ควรมั้ย|ควรปะ|ควรป่ะ|กินได้ไหม|กินได้มั้ย|กินดีไหม|กินดีมั้ย|กินดีปะ|กินดีป่ะ|อ้วนไหม|อ้วนมั้ย|หนักไหม|หนักมั้ย|พังไหม|พังมั้ย|พังปะ|พังป่ะ|อันไหนดี|อะไรดี|ไหนดี|ดีกว่า|เลือกอะไร|กี่แคล|กี่ kcal|แคลเท่าไหร่|แคลเท่าไร).*/i;

const hasFoodKeyword = (text) => FOOD_ADVICE_KEYWORDS.some((word) => normalizeText(text).includes(word));

const EAT_LOG_PREFIX_PATTERN = /^(กิน|เมื่อกี้กิน|วันนี้กิน|มื้อเช้ากิน|มื้อเที่ยงกิน|มื้อเย็นกิน)\s*/i;

const stripEatLogPrefix = (text) => String(text || "").trim().replace(EAT_LOG_PREFIX_PATTERN, "").trim();

const cleanFoodText = (text) => {
  let value = String(text || "").trim();
  value = value.replace(/^(วันนี้|มื้อนี้|เย็นนี้|คืนนี้|พรุ่งนี้|ตอนนี้)\s*/i, "");
  value = value.replace(/^(ถ้ากิน|กิน|จะกิน|อยากกิน|ควรกิน|ขอถามหน่อย)\s*/i, "");
  value = value.replace(FOOD_STOP_WORD_PATTERN, "");
  value = value.replace(/[?？!！~]+/g, "").replace(/นะ+$/i, "").trim();
  return value || String(text || "").trim();
};

const getFoodProfile = (foodText) => {
  const value = normalizeText(foodText);
  return {
    name: cleanFoodText(foodText),
    isSoupLight: hasAnyText(value, ["สุกี้", "ต้ม", "เกาเหลา", "ซุป", "แกงจืด", "ลวก", "นึ่ง", "ข้าวต้ม"]),
    isFriedHeavy: hasAnyText(value, ["ทอด", "หมูกรอบ", "ไก่กรอบ", "เฟรนช์ฟราย", "ของทอด", "กรอบ"]),
    isSweet: hasAnyText(value, ["หวาน", "ชานม", "น้ำหวาน", "โกโก้", "เค้ก", "ขนม", "คุกกี้", "เบเกอรี่", "ไอติม"]),
    isBigSocialMeal: hasAnyText(value, ["หมูกระทะ", "บุฟเฟต์", "ชาบู", "ปิ้งย่าง", "พิซซ่า", "เบอร์เกอร์"]),
    hasProtein: hasAnyText(value, ["ไก่", "หมู", "ปลา", "กุ้ง", "ไข่", "เต้าหู้", "เนื้อ", "อกไก่", "ทะเล"]),
    hasCarb: hasAnyText(value, ["ข้าว", "เส้น", "ก๋วยเตี๋ยว", "บะหมี่", "โจ๊ก", "ข้าวต้ม"]),
  };
};

const scoreFoodChoice = (foodText) => {
  const food = getFoodProfile(foodText);
  let score = 0;
  if (food.isSoupLight) score += 3;
  if (food.hasProtein) score += 2;
  if (food.hasCarb) score -= 0.5;
  if (food.isFriedHeavy) score -= 3;
  if (food.isSweet) score -= 3;
  if (food.isBigSocialMeal) score -= 2;
  return score;
};

const getDayBudget = (summary) => {
  const total = Number(summary?.todayCalories ?? summary?.totalToday ?? 0) || 0;
  const target = Number(summary?.calorieTarget || DEFAULT_CALORIE_TARGET);
  return { total, target, left: Math.max(target - total, 0), isOver: total > target, isNear: target - total <= 350 };
};

const getGoalTextFromContext = ({ session, profile }) => String(session?.data?.goal || profile?.goal || "").trim();

const getGoalSignals = (goalText = "") => {
  const value = normalizeText(goalText);
  return {
    hasGoal: Boolean(value && !["ไม่มี", "ยังไม่มี", "ไม่รู้", "ไม่แน่ใจ"].includes(value)),
    sweetControl: hasAnyText(value, ["คุมหวาน", "ลดหวาน", "น้ำตาล", "ชานม", "น้ำหวาน", "ของหวาน"]),
    fatLoss: hasAnyText(value, ["ลดไขมัน", "ลดน้ำหนัก", "คุมน้ำหนัก", "ลดพุง", "lean", "ลีน"]),
    muscleGain: hasAnyText(value, ["เพิ่มกล้าม", "สร้างกล้าม", "กล้าม", "โปรตีน", "เวท", "ออกกำลัง"]),
    lateControl: hasAnyText(value, ["ไม่กินดึก", "งดดึก", "กินดึก", "ดึก", "นอน"]),
    healthyEating: hasAnyText(value, ["สุขภาพ", "กินดี", "กินคลีน", "กินให้ดี", "บาลานซ์", "ผัก"]),
    relaxed: hasAnyText(value, ["ไม่เครียด", "ชิล", "ไม่กดดัน", "ค่อยเป็นค่อยไป"]),
  };
};

const getGoalAwareLine = ({ goalText = "", foodText = "", context = "general", isLate = false }) => {
  const goal = getGoalSignals(goalText);
  if (!goal.hasGoal) return "";

  const food = getFoodProfile(foodText || "");

  if (goal.sweetControl && (food.isSweet || context === "sweet")) {
    return "เป้าคุมหวานของลื้อ แปะยังจำได้อยู่ เอาหวานน้อยไว้ก่อนนะ 😄";
  }

  if (goal.fatLoss && (food.isFriedHeavy || context === "heavy")) {
    return "เป้าลดไขมันยังอยู่ในใจแปะนะ รอบนี้เอาไม่มันจัดไว้ก่อนจะสวยกว่า 👀";
  }

  if (goal.muscleGain && !food.hasProtein && context !== "sweet") {
    return "ถ้าอยากดันโปรตีนด้วย รอบนี้มีไข่/ไก่/เต้าหู้ติดมาหน่อยจะดีเลย 💪";
  }

  if (goal.lateControl && isLate) {
    return "เป้าไม่กินดึกของลื้อ แปะขอเชียร์แบบเบา ๆ พอคืนนี้นะ 😅";
  }

  if (goal.healthyEating && (food.isFriedHeavy || food.isSweet)) {
    return "ถ้าจะบาลานซ์สุขภาพ รอบหน้าสลับต้ม/ย่าง/ผักบ้าง แปะว่าเวิร์ก 😄";
  }

  if (goal.relaxed) {
    return "แปะจำได้ว่าเอาแบบไม่กดดันนะ ค่อย ๆ คุมก็พอ 😄";
  }

  return "";
};

const getPaeGuideMessages = (title) => [
  `${title} แปะเลย กินอะไรมา? 🍚

ส่งรูปอาหารก็ได้
หรือพิมพ์บอกแปะสั้น ๆ ก็ได้`,
  `พิมพ์ประมาณนี้ได้เลย:

- ข้าวมันไก่ 1 จาน
- ชาไทยหวานน้อย
- ขนมเลย์ 1 ห่อ
- มื้อเที่ยงกินสุกี้น้ำกับไข่ต้ม

ถ้าหลายอย่าง พิมพ์แยกบรรทัดมาได้เลย
แปะจะแยกแคลคร่าว ๆ แล้วรวมของวันนี้ให้เอง 😄`,
  `ไม่รู้เรียกเมนูว่าอะไร ก็ส่งรูปมาได้
เดี๋ยวแปะดูให้เอง 👀`,
];

const PAE_GUIDE_TEXTS = [
  "แปะเลย",
  "ส่งให้แปะดู",
  "บอกแปะ",
  "แปะมื้ออาหาร",
  "แปะอาหาร",
  "แปะรูปอาหาร",
  "ส่งรูปอาหาร",
  "ส่งรูป",
  "เริ่มแปะ",
];

const isPaeGuideText = (text) => exactTexts(PAE_GUIDE_TEXTS, text);

const COMPARISON_CUE_PATTERN = /(ระหว่าง|อันไหนดี|อะไรดี|เลือกอะไร|เลือกอันไหน|ดีกว่า|เทียบ|vs|VS|ไหนดี)/i;

const extractComparisonFoods = (text) => {
  const raw = String(text || "").trim();

  // อย่าให้ประโยคบันทึกอาหารธรรมดา เช่น
  // “กินข้าวเปล่ากับหมูทอด” ถูกตีความเป็นการเปรียบเทียบ
  if (!COMPARISON_CUE_PATTERN.test(raw)) return null;

  const match = raw.match(/(?:ระหว่าง\s*)?(.+?)\s*(?:กับ|หรือ|vs|VS)\s*(.+?)(?:\s*(?:อันไหนดี|อะไรดี|เลือกอะไร|เลือกอันไหน|ดีกว่า|ไหนดี|ดีไหม|ดีมั้ย|ได้ไหม|ได้มั้ย))?$/i);
  if (!match) return null;

  const a = cleanFoodText(match[1]);
  const b = cleanFoodText(match[2]);
  if (!a || !b || a.length > 40 || b.length > 40) return null;
  if (!hasFoodKeyword(a) && !hasFoodKeyword(b)) return null;

  return [a, b];
};

const isFoodCompareText = (text) => Boolean(extractComparisonFoods(text));

const isFoodKcalQuestionText = (text) => {
  const value = normalizeText(text);
  return hasFoodKeyword(value) && hasAnyText(value, ["กี่แคล", "กี่ kcal", "แคลเท่าไหร่", "แคลเท่าไร"]);
};

const isNextMealAfterFoodText = (text) => {
  const value = normalizeText(text);
  return hasFoodKeyword(value) && hasAnyText(value, [
    "แล้วเย็นนี้", "แล้วคืนนี้", "แล้วมื้อต่อไป",
    "ต่อไปกิน", "มื้อต่อไปกิน", "มื้อต่อไปควรกิน",
    "เย็นนี้กินอะไร", "เย็นนี้จะกินอะไร", "คืนนี้กินอะไร", "คืนนี้จะกินอะไร"
  ]);
};

const isFoodDesireAdviceText = (text) => {
  const value = normalizeText(text);
  if (!hasFoodKeyword(value)) return false;

  return /^(อยากกิน|อยากลอง|ว่าจะกิน|กำลังจะกิน|เย็นนี้อยากกิน|คืนนี้อยากกิน|ขอกิน|กิน)\s*/i.test(value)
    || hasAnyText(value, [
      "อยากกิน", "กินดี", "กินได้", "กินปะ", "กินป่ะ", "กินดีปะ", "กินดีไหม", "กินดีมั้ย",
      "กินได้ปะ", "กินได้ไหม", "ดีปะ", "ดีไหม", "ดีมั้ย", "พังไหม", "พังมั้ย", "โอเคไหม", "โอเคมั้ย"
    ]);
};

const isFoodAdviceText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 120) return false;
  if (isFoodCompareText(value) || isFoodKcalQuestionText(value) || isNextMealAfterFoodText(value)) return true;
  if (isFoodDesireAdviceText(value)) return true;
  const hasQuestion = FOOD_ADVICE_QUESTION_WORDS.some((word) => value.includes(word));
  return hasQuestion && hasFoodKeyword(value);
};

const buildFoodCompareReply = ({ title, text, summary }) => {
  const foods = extractComparisonFoods(text);
  if (!foods) return "";
  const [a, b] = foods;
  const scoreA = scoreFoodChoice(a);
  const scoreB = scoreFoodChoice(b);
  const winner = scoreA >= scoreB ? a : b;
  const loser = scoreA >= scoreB ? b : a;
  const budget = getDayBudget(summary);

  return `${title} ถ้าให้แปะเลือกนะ 👀

แปะเชียร์: ${winner}
มากกว่า ${loser}

เหตุผลสั้น ๆ คือมันคุมง่ายกว่า
ไม่ลากแคลไปไกลเท่าไหร่

${budget.isOver ? "แต่วันนี้เกินเป้าแล้ว เอาไซซ์พอดี ๆ พอนะ 😅" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal เลือกดี ๆ ได้อยู่ 😄`}`;
};

const buildFoodKcalReply = ({ title, foodData, foodText }) => {
  const menuName = foodData.menuName || cleanFoodText(foodText);
  const kcal = safeNumber(foodData.kcal, 0);
  const protein = safeNumber(foodData.protein, 0);
  const carb = safeNumber(foodData.carb, 0);
  const fat = safeNumber(foodData.fat, 0);

  return `${title} แปะตีให้คร่าว ๆ นะ 🔥

${menuName}
ประมาณ ${kcal} kcal

คร่าว ๆ:
🍚 คาร์บ ${carb} g
💪 โปรตีน ${protein} g
💧 ไขมัน ${fat} g

ตัวเลขอาจแกว่งตามร้านกับปริมาณนะ
แต่ใช้กะทางได้อยู่ 😄`;
};

const isPronounKcalQuestionText = (text) => {
  const value = normalizeText(text);
  if (!hasAnyText(value, ["กี่แคล", "กี่ kcal", "แคลเท่าไหร่", "แคลเท่าไร"])) return false;
  return /^(มัน|อันนี้|อันนั้น|มื้อนี้|มื้อเมื่อกี้|เมื่อกี้|ที่กินไป|เมนูนี้)/i.test(value);
};

const getLatestMealForFollowUp = async ({ userId, session }) => {
  if (session?.data?.lastMeal?.menuName) return session.data.lastMeal;

  try {
    const latest = await getLastMeal(userId);
    return latest?.meal || null;
  } catch {
    return null;
  }
};


const roundKcal = (value) => Math.max(0, Math.round((Number(value) || 0) / 10) * 10);

const splitFoodItemsFromText = (text) => {
  let value = String(text || "").trim();
  value = stripEatLogPrefix(value);
  value = value.replace(/\s*(?:ไป|มา|แล้ว|นะ|คับ|ครับ|ค่ะ|จ้า)\s*$/i, "").trim();

  const lineParts = value
    .split(/[\n,，;；]+/g)
    .map((part) => cleanFoodText(part))
    .filter((part) => part && hasFoodKeyword(part));

  if (lineParts.length > 1) return lineParts.slice(0, 8);

  const plusParts = value
    .split(/\s*(?:\+|และ|พร้อม|,|，)\s*/g)
    .map((part) => cleanFoodText(part))
    .filter((part) => part && hasFoodKeyword(part));

  return plusParts.length > 1 ? plusParts.slice(0, 8) : [];
};

const getFallbackItemWeight = (label) => {
  const value = normalizeText(label);
  let weight = 1;
  if (hasAnyText(value, ["ข้าวมันไก่", "ข้าวหมูกรอบ", "กะเพรา", "กระเพรา", "ข้าวผัด", "ผัดไทย", "หมูกระทะ", "ชาบู", "พิซซ่า", "เบอร์เกอร์"])) weight += 2.2;
  if (hasAnyText(value, ["ข้าว", "เส้น", "บะหมี่", "มาม่า"])) weight += 1.2;
  if (hasAnyText(value, ["ทอด", "กรอบ", "หมูทอด", "ไก่ทอด", "เลย์", "ขนม"])) weight += 1.4;
  if (hasAnyText(value, ["ชาไทย", "ชานม", "น้ำหวาน", "โกโก้", "กาแฟเย็น", "หวาน"])) weight += 0.9;
  if (hasAnyText(value, ["ครึ่ง", "นิดหน่อย", "นิดนึง"])) weight *= 0.55;
  return Math.max(weight, 0.3);
};

const allocateFallbackItemKcals = (labels, totalKcal) => {
  const total = Math.max(Number(totalKcal) || 0, labels.length * 80);
  const weights = labels.map(getFallbackItemWeight);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let used = 0;

  return labels.map((label, index) => {
    const isLast = index === labels.length - 1;
    const kcal = isLast
      ? Math.max(0, roundKcal(total - used))
      : roundKcal((total * weights[index]) / weightTotal);
    used += kcal;
    return { name: label, quantity: "", kcal };
  });
};

const normalizeEstimatedItems = (foodData = {}, originalText = "") => {
  const totalKcal = safeNumber(foodData?.kcal, 0);
  const rawItems = Array.isArray(foodData?.items) ? foodData.items : [];
  let items = rawItems
    .map((item) => ({
      name: cleanFoodText(item?.name || ""),
      quantity: String(item?.quantity || "").trim(),
      kcal: roundKcal(item?.kcal),
    }))
    .filter((item) => item.name && item.kcal > 0)
    .slice(0, 8);

  if (items.length <= 1) {
    const labels = splitFoodItemsFromText(originalText);
    if (labels.length > 1) items = allocateFallbackItemKcals(labels, totalKcal);
  }

  if (items.length <= 1) return [];

  const itemTotal = items.reduce((sum, item) => sum + item.kcal, 0);
  if (totalKcal > 0 && itemTotal > 0 && Math.abs(itemTotal - totalKcal) / totalKcal > 0.18) {
    let used = 0;
    items = items.map((item, index) => {
      const isLast = index === items.length - 1;
      const kcal = isLast ? roundKcal(totalKcal - used) : roundKcal((item.kcal / itemTotal) * totalKcal);
      used += kcal;
      return { ...item, kcal: Math.max(kcal, 0) };
    });
  }

  return items;
};

const formatFoodItemLine = (item) => {
  const label = [item.name, item.quantity].filter(Boolean).join(" ").trim();
  return `- ${label} ~ ${safeNumber(item.kcal, 0)} kcal`;
};

const buildPronounKcalReply = ({ title, meal }) => {
  if (!meal) {
    return `${title} แปะยังไม่เจอมื้อก่อนหน้าให้เทียบน้า 😅

พิมพ์ชื่อเมนูมาอีกทีได้เลย
เช่น “ข้าวหมูทอดกี่แคล”`;
  }

  const menuName = meal.menuName || "มื้อเมื่อกี้";
  const kcal = safeNumber(meal.kcal, 0);
  const carb = safeNumber(meal.carb, 0);
  const protein = safeNumber(meal.protein, 0);
  const fat = safeNumber(meal.fat, 0);
  const items = Array.isArray(meal?.items) ? meal.items : [];

  if (items.length > 1) {
    return `${title} อันเมื่อกี้แปะตีไว้ประมาณนี้นะ 🔥

${menuName}
รวมประมาณ ${kcal} kcal

แยกให้คร่าว ๆ:
${items.map(formatFoodItemLine).join("\n")}

ถ้าปริมาณไม่ตรง พิมพ์ “แก้มื้อล่าสุดเป็น ...” ได้เลยจ้า`;
  }

  return `${title} อันเมื่อกี้แปะตีไว้ประมาณนี้นะ 🔥

${menuName}
ประมาณ ${kcal} kcal

คร่าว ๆ:
🍚 คาร์บ ${carb} g
💪 โปรตีน ${protein} g
💧 ไขมัน ${fat} g

ถ้าปริมาณไม่ตรง พิมพ์ “แก้มื้อล่าสุดเป็น ...” ได้เลยจ้า`;
};


const serializeMealItems = (items = []) => JSON.stringify(
  Array.isArray(items)
    ? items
      .map((item) => ({
        name: String(item?.name || "").trim(),
        quantity: String(item?.quantity || "").trim(),
        kcal: safeNumber(item?.kcal, 0),
      }))
      .filter((item) => item.name || item.kcal > 0)
      .slice(0, 12)
    : []
);

const SMART_MEAL_CORRECTION_PATTERN = /(ไม่ใช่|แก้|เปลี่ยน|ปรับ|เป็นแก้วเล็ก|แก้วเล็ก|ไซซ์เล็ก|ไซส์เล็ก|ครึ่งห่อ|ครึ่งเดียว|กินครึ่ง|เอาหนังออก|ไม่เอาหนัง|เอา.*ออก|ลดหวาน|หวานน้อยกว่า|ไม่หวาน|เพิ่ม|ลด|เมื่อกี้|มื้อก่อน|มื้อก่อนหน้า|อันก่อน|รายการก่อน)/i;

const normalizeMealRecord = (meal = {}, extra = {}) => {
  const menuName = meal.menuName || meal.name || "อาหาร";
  return {
    menuName,
    kcal: safeNumber(meal.kcal, 0),
    carb: safeNumber(meal.carb, 0),
    protein: safeNumber(meal.protein, 0),
    fat: safeNumber(meal.fat, 0),
    items: Array.isArray(meal.items) ? meal.items : [],
    requestId: meal.requestId || extra.requestId || "",
    loggedAt: meal.loggedAt || extra.loggedAt || new Date().toISOString(),
  };
};

const getRecentMealsFromSession = (session) => {
  const recent = Array.isArray(session?.data?.recentMeals) ? session.data.recentMeals : [];
  const fallback = session?.data?.lastMeal?.menuName ? [session.data.lastMeal] : [];
  return (recent.length ? recent : fallback)
    .filter((meal) => meal?.menuName)
    .map((meal) => normalizeMealRecord(meal))
    .slice(0, 5);
};

const upsertRecentMealList = (recentMeals = [], meal = {}) => {
  const normalized = normalizeMealRecord(meal);
  const key = normalized.requestId || normalized.loggedAt || normalized.menuName;
  const withoutDuplicate = recentMeals.filter((item) => {
    const itemKey = item.requestId || item.loggedAt || item.menuName;
    return itemKey !== key;
  });
  return [normalized, ...withoutDuplicate].slice(0, 5);
};

const normalizeTokenText = (text) => normalizeText(text)
  .replace(/[ๆ~!！?？.。…。、,，:：;；\-_=+*()\[\]{}"'“”‘’`]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const extractFoodTokensForMealMatch = (text) => {
  const value = normalizeTokenText(text);
  const tokens = FOOD_ADVICE_KEYWORDS
    .filter((word) => value.includes(normalizeText(word)))
    .sort((a, b) => b.length - a.length);

  const customTokens = value
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && hasFoodKeyword(token));

  return [...new Set([...tokens, ...customTokens])].slice(0, 8);
};

const scoreMealForCorrection = (meal, tokens = []) => {
  const haystack = normalizeTokenText([
    meal.menuName,
    ...(Array.isArray(meal.items) ? meal.items.map((item) => `${item.name || ""} ${item.quantity || ""}`) : []),
  ].join(" "));

  return tokens.reduce((score, token) => {
    const cleanToken = normalizeText(token);
    if (!cleanToken) return score;
    return haystack.includes(cleanToken) ? score + Math.max(cleanToken.length, 2) : score;
  }, 0);
};

const selectMealForCorrection = ({ text, session }) => {
  const recentMeals = getRecentMealsFromSession(session);
  if (!recentMeals.length) return { selectedMeal: null, recentMeals, reason: "no_meal" };

  const value = normalizeText(text);
  if (/(มื้อก่อนหน้า|มื้อก่อน|อันก่อน|รายการก่อน|ก่อนหน้านี้)/i.test(value) && recentMeals[1]) {
    return { selectedMeal: recentMeals[1], recentMeals, reason: "previous_meal" };
  }

  if (/(มื้อล่าสุด|เมื่อกี้|อันเมื่อกี้|รายการล่าสุด)/i.test(value)) {
    return { selectedMeal: recentMeals[0], recentMeals, reason: "latest_meal" };
  }

  const tokens = extractFoodTokensForMealMatch(text);
  if (tokens.length) {
    const ranked = recentMeals
      .map((meal) => ({ meal, score: scoreMealForCorrection(meal, tokens) }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0]?.score > 0) {
      return { selectedMeal: ranked[0].meal, recentMeals, reason: "matched_food" };
    }
  }

  return { selectedMeal: recentMeals[0], recentMeals, reason: "latest_fallback" };
};

const replaceRecentMeal = (recentMeals = [], selectedMeal = {}, updatedMeal = {}) => {
  const selectedKey = selectedMeal.requestId || selectedMeal.loggedAt || selectedMeal.menuName;
  return recentMeals.map((meal) => {
    const key = meal.requestId || meal.loggedAt || meal.menuName;
    return key === selectedKey ? normalizeMealRecord({ ...meal, ...updatedMeal }) : meal;
  }).slice(0, 5);
};

const isSmartMealCorrectionText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 220) return false;
  if (isExactSummaryText(text) || isDeleteMealText(text) || isEditMealHelpText(text)) return false;
  if (isFoodCompareText(text) || isNextMealAfterFoodText(text) || isFoodKcalQuestionText(text)) return false;
  return SMART_MEAL_CORRECTION_PATTERN.test(value);
};

const getCorrectionTargetLabel = (reason) => {
  if (reason === "previous_meal") return "มื้อก่อนหน้า";
  if (reason === "matched_food") return "มื้อที่แปะหาเจอ";
  return "มื้อล่าสุด";
};

const buildSmartCorrectionReplyMessages = ({ title, oldMeal, updatedMeal, summary, targetLabel }) => {
  const total = summary.todayCalories ?? summary.totalToday ?? updatedMeal.kcal ?? 0;
  const target = summary.calorieTarget || DEFAULT_CALORIE_TARGET;
  const progress = buildProgressBar(total, target);
  const items = Array.isArray(updatedMeal?.items) ? updatedMeal.items : [];
  const itemLines = items.length > 1 ? items.map(formatFoodItemLine).join("\n") : "";

  const mealBubble = items.length > 1
    ? `${title} โอเค แปะปรับ${targetLabel || "มื้อล่าสุด"}ให้แล้วนะ 🧾\n\nจากเดิม:\n${oldMeal?.menuName || "มื้อก่อนหน้า"}\n\nปรับใหม่รวมประมาณ ${updatedMeal.kcal} kcal\n\nแยกให้คร่าว ๆ:\n${itemLines}`
    : `${title} โอเค แปะปรับ${targetLabel || "มื้อล่าสุด"}ให้แล้วนะ 🧾\n\nจากเดิม:\n${oldMeal?.menuName || "มื้อก่อนหน้า"}\n\nเป็น:\n${updatedMeal.menuName || "อาหาร"}\nประมาณ ${updatedMeal.kcal} kcal`;

  const progressBubble = `📊 วันนี้กินไปแล้ว\n${total} / ${target} kcal\n(${progress})`;

  const commentBubble = `แบบนี้ชัดขึ้นละ 👀\nถ้ามีอะไรคลาดอีก บอกแปะต่อได้เลย`;

  return [mealBubble, progressBubble, commentBubble];
};

const buildTextFoodLogMessages = ({ title, meal, summary, decision, goalText = "" }) => {
  const menuName = meal?.menuName || "อาหาร";
  const kcal = safeNumber(meal?.kcal, 0);
  const carb = safeNumber(meal?.carb, 0);
  const protein = safeNumber(meal?.protein, 0);
  const fat = safeNumber(meal?.fat, 0);
  const total = safeNumber(summary?.todayCalories ?? summary?.totalToday, kcal);
  const target = safeNumber(summary?.calorieTarget, DEFAULT_CALORIE_TARGET);
  const progress = buildProgressBar(total, target);
  const left = Math.max(target - total, 0);
  const over = Math.max(total - target, 0);
  const items = Array.isArray(meal?.items) ? meal.items : [];
  const itemLines = items.length > 1 ? items.map(formatFoodItemLine).join("\n") : "";

  const mealBubble = items.length > 1
    ? `${title} แปะบันทึกให้แล้วนะ 🍽️

มื้อนี้รวมประมาณ ${kcal} kcal

แยกให้คร่าว ๆ:
${itemLines}`
    : `${title} แปะบันทึกให้แล้วนะ 🍽️

${menuName}
🔥 ประมาณ ${kcal} kcal

คร่าว ๆ:
🍚 คาร์บ ${carb} g
💪 โปรตีน ${protein} g
💧 ไขมัน ${fat} g`;

  const progressBubble = over > 0
    ? `📊 วันนี้กินไปแล้ว
${total} / ${target} kcal
🔴 เกินเป้าไปประมาณ ${over} kcal
(${progress})`
    : `📊 วันนี้กินไปแล้ว
${total} / ${target} kcal
🟢 เหลือประมาณ ${left} kcal
(${progress})`;

  const tone = String(decision?.tone || decision?.level || "");
  const commentBubble = over > 0
    ? `วันนี้เกินเป้าแล้วนิดนึงนะ 👀
ถ้ายังหิวจริง ๆ เอาเบา ๆ พอ
พรุ่งนี้ค่อยดึงกลับ ชิล ๆ 😄`
    : tone.includes("warn") || kcal >= 700
      ? `มื้อนี้ตัวเลขขึ้นไวอยู่ 👀
แต่บันทึกไว้แล้ว จะได้คุมเกมต่อถูก
มื้อต่อไปเอาเบาลงนิดก็พอ 😄`
      : `ได้อยู่ มื้อนี้แปะให้ผ่าน 😄
ถ้ามีอะไรเพิ่ม ส่งมาได้เลย`;

  return [mealBubble, progressBubble, commentBubble];
};

const isLikelyFoodLogText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 160) return false;
  if (!EAT_LOG_PREFIX_PATTERN.test(value)) return false;
  if (isNextMealAfterFoodText(value)) return false;
  if (isFoodKcalQuestionText(value)) return false;
  if (isFoodCompareText(value)) return false;
  return hasFoodKeyword(value);
};

const buildNextMealAfterFoodReply = ({ title, text, summary, goalText = "" }) => {
  const budget = getDayBudget(summary);
  const beforeNextMeal = String(text || "").split(/แล้ว|จากนั้น|ต่อไป/i)[0];
  const food = cleanFoodText(beforeNextMeal);

  if (budget.isOver) {
    return `${title} ถ้ากิน ${food} ไปแล้ว
มื้อต่อไปเอาเบา ๆ พอเลยนะ 👀

แปะแนะนำ:
- ต้มจืด / ซุปใส
- เกาเหลาไม่กระเทียมเจียว
- ไข่ต้ม + ผัก
- ปลา/ไก่ย่างไม่มัน

วันนี้ไม่ต้องแก้โหด
แค่ไม่เติมหนักต่อก็พอ 😄`;
  }

  if (budget.isNear) {
    return `${title} ถ้ากิน ${food} ไปแล้ว
วันนี้เหลือพื้นที่ไม่เยอะละ 🟠

มื้อต่อไปเอาแนวนี้พอ:
- สุกี้น้ำ
- ต้มจืดเต้าหู้หมูสับ
- ไข่ต้ม + โยเกิร์ตไม่หวาน
- เกาเหลา + ข้าวนิดเดียว

แปะว่าเอาให้จบสวย ๆ พอ 😄`;
  }

  return `${title} ถ้ากิน ${food} ไปแล้ว
มื้อต่อไปบาลานซ์ง่าย ๆ ก็พอ 😄

เลือกทางนี้ได้:
- เพิ่มโปรตีนดี ๆ
- ผัก/ซุปติดมา
- ของทอดกับน้ำหวานพักก่อนหนึ่งรอบ

วันนี้ยังพอคุมเกมได้อยู่`;
};


const isFoodHeavyQuestionLike = (text) => {
  const value = normalizeText(text);
  return hasAnyText(value, [
    "หนักไปไหม", "หนักไปมั้ย", "หนักไหม", "หนักมั้ย",
    "เยอะไปไหม", "เยอะไปมั้ย", "พังไหม", "พังมั้ย",
    "อ้วนไหม", "อ้วนมั้ย", "แคลสูงไหม", "แคลสูงมั้ย"
  ]);
};

const buildNamedFoodHeavyReply = ({ title, food, profile, summary, goalText = "" }) => {
  const budget = getDayBudget(summary);
  const goalLine = getGoalAwareLine({
    goalText,
    foodText: food,
    context: profile.isSweet ? "sweet" : profile.isFriedHeavy || profile.isBigSocialMeal ? "heavy" : "general",
    isLate: new Date().getHours() >= 21 || new Date().getHours() < 2,
  });
  const goalBlock = goalLine ? `\n\n${goalLine}` : "";

  if (profile.isBigSocialMeal) {
    return `${title} หนักได้ง่ายนะ 👀

${food} ตัวมันไม่ได้ผิด
แต่แคลชอบไหลเพราะกินเพลิน น้ำจิ้ม ของทอด น้ำหวาน แล้วก็นั่งยาว

ถ้าจะกิน แปะให้ผ่านแบบมีลิมิต:
- เน้นหมู/ไก่/ทะเลก่อน
- ผักกับซุปช่วยคุมเกม
- น้ำจิ้มไม่ต้องว่ายน้ำ
- น้ำหวานพักก่อนรอบนี้

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาแค่พอหายอยากพอนะ 😮‍💨🍃" : "กินได้ แต่เอาไซซ์พอดี ๆ ไม่ต้องบุฟเฟต์ยาว 😄"}${goalBlock}`;
  }

  if (profile.isFriedHeavy || profile.isSweet) {
    return `${title} ค่อนข้างหนักอยู่นะ 👀

${food} แคลขึ้นไว
ถ้าจะกิน เอาไซซ์พอดี ๆ ไม่ต้องอัปเพิ่ม

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาแค่พอหายอยากพอนะ 😮‍💨🍃" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal อยู่ ยังพอจัดได้`}${goalBlock}`;
  }

  return `${title} ไม่ได้หนักเกินนะ 😄

${food} ยังพอจัดได้
แค่ดูปริมาณกับของที่กินคู่กันนิดนึง

${budget.isOver ? "แต่วันนี้เกินเป้าแล้ว มื้อต่อไปเอาเบา ๆ พอ" : "ถ้าเพิ่มโปรตีน/ผักติดมาด้วย แปะว่าโอเคเลย"}${goalBlock}`;
};

const buildFoodAdviceReply = ({ title, text, summary, goalText = "" }) => {
  const food = getFoodProfile(text).name;
  const profile = getFoodProfile(food);
  const budget = getDayBudget(summary);
  const asksHeavy = isFoodHeavyQuestionLike(text);

  if (asksHeavy) {
    return buildNamedFoodHeavyReply({ title, food, profile, summary, goalText });
  }

  const goalLine = getGoalAwareLine({
    goalText,
    foodText: food,
    context: profile.isSweet ? "sweet" : profile.isFriedHeavy || profile.isBigSocialMeal ? "heavy" : "general",
    isLate: new Date().getHours() >= 21 || new Date().getHours() < 2,
  });
  const goalBlock = goalLine ? `\n\n${goalLine}` : "";

  if (profile.isBigSocialMeal) {
    return `${title} กินได้ แต่แปะขอให้คุมเกมนิดนึงนะ 👀

${food} ชอบลากยาวโดยไม่รู้ตัว
ถ้าจะกิน เอาให้พอดี ไม่ต้องจัดเต็มทุกอย่าง

ทริคแปะ:
- เริ่มจากโปรตีนก่อน
- ผัก/ซุปช่วยเบรก
- น้ำจิ้มไม่ต้องเยอะ
- น้ำหวานพักไว้ก่อน

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาแค่พอสนุกพอนะ 😅" : "กินได้ แต่อย่าให้กลายเป็นประชุมยาว 😄"}${goalBlock}`;
  }

  if (profile.isFriedHeavy || profile.isSweet) {
    return `${title} ได้ แต่แปะให้ผ่านแบบมีเงื่อนไขนะ 👀

${food} ตัวนี้แคลขึ้นไว
ถ้าจะกิน เอาไซซ์พอดี ๆ ไม่ต้องอัปเพิ่ม

${budget.isOver ? "วันนี้เกินเป้าแล้วด้วย เอาแค่พอหายอยากพอนะ 😅" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal อยู่ ยังพอจัดได้`}

แปะว่าได้ แต่อย่าให้มันลากยาว 😄${goalBlock}`;
  }

  if (profile.isSoupLight) {
    return `${title} ดีเลย อันนี้แปะเชียร์ 🍲

${food} ถือว่าโอเคนะ
มีน้ำ ๆ ไม่หนักเกิน คุมง่ายกว่าเมนูมัน ๆ

ถ้าเลือกได้:
- เพิ่มไข่ / ไก่ / ทะเล
- น้ำจิ้มแยกหรือน้อยหน่อย
- ไม่ต้องเบิ้ลเส้นเยอะ

${budget.isOver ? "วันนี้แคลเกินแล้ว เอาชามพอดี ๆ พอนะ 😅" : "แปะให้ผ่าน 😄"}${goalBlock}`;
  }

  return `${title} กินได้จ้า แต่อยู่ที่ปริมาณนิดนึง 👀

${food} ถ้าไม่มันจัด ไม่หวานจัด ก็โอเคอยู่
ลองให้มีโปรตีน + ผักติดมาด้วยจะสวยกว่า

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาเบา ๆ พอนะ 😅" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal แปะว่าเลือกดี ๆ ได้อยู่ 😄`}${goalBlock}`;
};

const getGoalAwareMealSuggestionAddon = ({ goalText = "", summary = {} }) => {
  const goal = getGoalSignals(goalText);
  if (!goal.hasGoal) return "";

  const budget = getDayBudget(summary);

  if (goal.fatLoss) {
    return budget.isNear || budget.isOver
      ? "ตามเป้าลดไขมัน มื้อนี้ขอโปรตีนไม่มัน + ผัก/ซุปนะ เลี่ยงทอดกับน้ำหวานก่อน 😮‍💨🍃"
      : "ตามเป้าลดไขมัน เลือกเมนูโปรตีนดี ๆ ไม่มันจัด จะคุมง่ายสุด 👀";
  }

  if (goal.sweetControl) {
    return "ตามเป้าคุมหวาน แปะขอเครื่องดื่มหวานน้อย/ไม่หวานก่อนนะ 🧋👀";
  }

  if (goal.muscleGain) {
    return "ถ้าอยากดันโปรตีน มื้อนี้ขอมีไข่ ไก่ ปลา เต้าหู้ หรือหมูไม่ติดมันติดมาด้วย 💪🔥";
  }

  if (goal.lateControl) {
    return "ถ้าเป็นมื้อเย็น/ดึก แปะเชียร์เบา ๆ พอ ไม่ต้องเล่นใหญ่ เดี๋ยวแน่นเกิน 😮‍💨";
  }

  if (goal.healthyEating) {
    return "ตามเป้ากินสุขภาพดี ขอมีผักหรือซุปติดมาด้วยนิดนึง แปะให้ผ่านง่ายขึ้น 🥬";
  }

  if (goal.relaxed) {
    return "แปะจำได้ว่าเอาแบบไม่กดดันนะ เลือกอันที่คุมง่ายแต่ยังอร่อยพอ ชิล ๆ 😄";
  }

  return "";
};

const buildGoalAwareMealSuggestionReply = ({ title, summary, text, goalText = "", decision }) => {
  const base = renderMealSuggestionReply({ title, decision }) || getMealSuggestionText({ title, summary });
  const addon = getGoalAwareMealSuggestionAddon({ goalText, summary });

  return addon ? `${base}\n\n${addon}` : base;
};


const getMacroTargetsForSummary = (summary = {}) => {
  const target = Math.max(safeNumber(summary?.calorieTarget, DEFAULT_CALORIE_TARGET), 1);
  return {
    protein: 70,
    fat: Math.round(target * 0.30 / 9),
    carb: Math.round(target * 0.55 / 4),
  };
};

const isProteinStatusQuestionText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 80) return false;
  return hasAnyText(value, ["โปรตีน"]) && hasAnyText(value, [
    "พอยัง", "พอไหม", "พอมั้ย", "พอรึยัง", "พอหรือยัง",
    "ถึงยัง", "ถึงเป้าไหม", "ถึงเป้ามั้ย", "ขาดไหม", "ขาดมั้ย",
    "ควรเติมไหม", "ควรเติมมั้ย", "เติมอีกไหม", "เติมอีกมั้ย"
  ]);
};

const isFatStatusQuestionText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 90) return false;
  return hasAnyText(value, ["ไขมัน", "มัน"]) && hasAnyText(value, [
    "เยอะไปไหม", "เยอะไปมั้ย", "สูงไปไหม", "สูงไปมั้ย",
    "เกินไหม", "เกินมั้ย", "หนักไหม", "หนักมั้ย", "พังไหม", "พังมั้ย"
  ]);
};

const isCarbStatusQuestionText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 90) return false;
  return hasAnyText(value, ["คาร์บ", "แป้ง", "ข้าว"]) && hasAnyText(value, [
    "เยอะไปไหม", "เยอะไปมั้ย", "สูงไปไหม", "สูงไปมั้ย",
    "เกินไหม", "เกินมั้ย", "หนักไหม", "หนักมั้ย"
  ]);
};

const isLatestMealHeavyQuestionText = (text) => {
  const value = normalizeText(text);
  if (!value || value.length > 80) return false;
  const refersLatest = hasAnyText(value, ["เมนูนี้", "มื้อนี้", "อันนี้", "เมื่อกี้", "ที่กิน"]);
  const asksHeavy = hasAnyText(value, ["หนักไปไหม", "หนักไปมั้ย", "เยอะไปไหม", "เยอะไปมั้ย", "พังไหม", "พังมั้ย", "โอเคไหม", "โอเคมั้ย"]);
  return refersLatest && asksHeavy;
};

const buildProteinStatusReply = ({ title, summary }) => {
  const protein = Math.round(getSummaryValue(summary, ["totalProtein", "protein"], 0));
  const mealCount = Number(summary?.mealCount || 0) || 0;
  const targetProtein = getMacroTargetsForSummary(summary).protein;
  const diff = protein - targetProtein;

  if (!mealCount || protein <= 0) {
    return `${title} วันนี้แปะยังไม่เห็นโปรตีนที่บันทึกไว้น้า 👀\n\nส่งรูปหรือพิมพ์มื้อที่กินมาก่อน เดี๋ยวแปะรวมให้เอง 💪`;
  }

  if (diff >= 15) {
    return `${title} โปรตีนวันนี้พอแล้วจ้า 💪🔥\n\nตอนนี้ได้ประมาณ ${protein} g\nเกินเป้าคร่าว ๆ ไปนิดนึงแล้ว มื้อต่อไปไม่ต้องอัดหนักก็ได้ 😄`;
  }

  if (diff >= 0) {
    return `${title} โปรตีนวันนี้พอแล้วนะ 💪🔥\n\nตอนนี้ได้ประมาณ ${protein} g\nมื้อต่อไปกินเบา ๆ ได้ ไม่ต้องไล่โปรตีนเพิ่มก็ยังโอเค 😄`;
  }

  if (diff >= -10) {
    return `${title} โปรตีนวันนี้เกือบพอแล้วนะ 👀💪\n\nตอนนี้ได้ประมาณ ${protein} g\nขาดอีกนิดเดียวเอง ถ้ายังหิวเติมไข่ต้ม/อกไก่/เต้าหู้เบา ๆ ก็จบสวย 😄`;
  }

  return `${title} โปรตีนวันนี้ยังเติมได้อีกหน่อยนะ 💪\n\nตอนนี้ได้ประมาณ ${protein} g\nถ้ามื้อต่อไปยังมีที่ว่าง ลองเพิ่มไข่ ไก่ ปลา หรือเต้าหู้หน่อย แปะว่าโอเคเลย 🍳`;
};

const buildFatStatusReply = ({ title, summary }) => {
  const fat = Math.round(getSummaryValue(summary, ["totalFat", "fat"], 0));
  const mealCount = Number(summary?.mealCount || 0) || 0;
  const fatTarget = getMacroTargetsForSummary(summary).fat;
  const diff = fat - fatTarget;

  if (!mealCount) {
    return `${title} วันนี้ยังไม่มีข้อมูลพอให้ดูไขมันน้า 👀\n\nส่งรูปหรือพิมพ์เมนูมาก่อน เดี๋ยวแปะช่วยดูให้`;
  }

  if (diff > 15) {
    return `${title} ไขมันวันนี้สูงไปหน่อยนะ 🫣\n\nตอนนี้ประมาณ ${fat} g\nมื้อต่อไปถ้ายังหิว ขอเบาทอด/มัน/กะทิลงหน่อย จะได้ไม่แน่นเกิน 😮‍💨🍃`;
  }

  if (diff > 0) {
    return `${title} ไขมันเริ่มเกินนิดนึงแล้วนะ 👀\n\nตอนนี้ประมาณ ${fat} g\nยังไม่พัง แต่รอบต่อไปเอาเมนูน้ำ ๆ หรือย่าง/ต้มจะสวยกว่า 😄`;
  }

  return `${title} ไขมันวันนี้ยังโอเคอยู่ 😄\n\nตอนนี้ประมาณ ${fat} g\nถ้ามื้อต่อไปเลือกไม่มันจัด แปะว่าไปต่อได้สบาย 🍃`;
};

const buildCarbStatusReply = ({ title, summary }) => {
  const carb = Math.round(getSummaryValue(summary, ["totalCarb", "carb"], 0));
  const mealCount = Number(summary?.mealCount || 0) || 0;
  const carbTarget = getMacroTargetsForSummary(summary).carb;
  const diff = carb - carbTarget;

  if (!mealCount) {
    return `${title} วันนี้ยังไม่มีข้อมูลพอให้ดูคาร์บน้า 👀\n\nส่งรูปหรือพิมพ์เมนูมาก่อน เดี๋ยวแปะรวมให้`;
  }

  if (diff > 25) {
    return `${title} คาร์บวันนี้มาแน่นอยู่นะ 🍚👀\n\nตอนนี้ประมาณ ${carb} g\nมื้อต่อไปลดข้าว/เส้นลงนิด แล้วเพิ่มโปรตีนหรือผักแทนจะบาลานซ์กว่า 😄`;
  }

  if (diff > 0) {
    return `${title} คาร์บเริ่มเกินนิดนึง แต่ยังคุมได้อยู่ 🍚\n\nตอนนี้ประมาณ ${carb} g\nมื้อต่อไปเอาเบา ๆ ก็พอกลับมาสวยได้`;
  }

  return `${title} คาร์บวันนี้ยังโอเคนะ 😄\n\nตอนนี้ประมาณ ${carb} g\nยังมีพื้นที่ให้เลือกมื้อถัดไปแบบไม่ตึงมาก`;
};

const buildLatestMealHeavyReply = async ({ title, userId, session, goalText = "" }) => {
  const meal = await getLatestMealForFollowUp({ userId, session });

  if (!meal?.menuName) {
    return `${title} แปะยังไม่เจอมื้อล่าสุดให้ดูน้า 👀\n\nส่งรูปหรือพิมพ์เมนูมาก่อน เดี๋ยวแปะช่วยเช็กให้`;
  }

  const kcal = safeNumber(meal.kcal, 0);
  const fat = safeNumber(meal.fat, 0);
  const carb = safeNumber(meal.carb, 0);
  const protein = safeNumber(meal.protein, 0);
  const menuName = meal.menuName || "มื้อนี้";
  const goalLine = getGoalAwareLine({
    goalText,
    foodText: menuName,
    context: kcal >= 600 || fat >= 30 ? "heavy" : "general",
    isLate: new Date().getHours() >= 21 || new Date().getHours() < 2,
  });
  const goalBlock = goalLine ? `\n\n${goalLine}` : "";

  if (kcal >= 850 || fat >= 35) {
    return `${title} เมนูนี้ค่อนข้างหนักอยู่นะ 👀\n\n${menuName}\nประมาณ ${Math.round(kcal)} kcal${fat ? ` / ไขมัน ${Math.round(fat)} g` : ""}\n\nไม่ได้พัง แต่ถ้ามื้อต่อไปยังหิว เอาเบา ๆ พอ จะได้ไม่แน่นเกิน 😮‍💨🍃${goalBlock}`;
  }

  if (kcal >= 600 || carb >= 80) {
    return `${title} เมนูนี้กลาง ๆ ไปทางแน่นนะ 😄\n\n${menuName}\nประมาณ ${Math.round(kcal)} kcal\n\nถ้าวันนี้ยังไม่เกิน แปะว่าโอเคอยู่ แค่มื้อต่อไปไม่ต้องเล่นใหญ่${goalBlock}`;
  }

  return `${title} เมนูนี้ยังโอเคอยู่นะ 😄\n\n${menuName}\nประมาณ ${Math.round(kcal)} kcal\nโปรตีน ${Math.round(protein)} g\n\nไม่ได้หนักเกิน แปะให้ผ่าน${goalBlock}`;
};


const isRefreshSummaryText = (text) => exactTexts([
  "รีเฟรชสรุป",
  "รีเฟรชสรุปวันนี้",
  "คำนวณสรุปใหม่",
  "อัปเดตสรุปใหม่",
  "refresh summary",
], text);


const isAcknowledgementText = (text) => {
  const value = normalizeText(text)
    .replace(/[.!?？！，,~ๆ]+/g, "")
    .trim();

  if (!value || value.length > 24) return false;

  return [
    "เค",
    "โอเค",
    "โอเคร",
    "ok",
    "okay",
    "ได้",
    "ได้เลย",
    "รับทราบ",
    "ครับ",
    "คับ",
    "ค่ะ",
    "คะ",
    "จ้า",
    "จ้ะ",
    "จ๊ะ",
    "อืม",
    "อือ",
    "อ่อ",
    "อ๋อ",
    "โอเคครับ",
    "โอเคค่ะ",
    "โอเคจ้า",
    "เคครับ",
    "เคค่ะ",
    "เคจ้า",
  ].includes(value);
};

const isExactSummaryText = (text) => exactTexts([
  "สรุปวันนี้",
  "วันนี้กินไปเท่าไหร่",
  "วันนี้กินไปเท่าไร",
  "แคลวันนี้",
  "ดูสรุปวันนี้",
  "วันนี้กินอะไรไปบ้าง",
], text);

const isProfileQuestionText = (text) => exactTexts([
  "ฉันชื่ออะไร",
  "ชื่อฉันคืออะไร",
  "แปะจำชื่อฉันได้ไหม",
  "สเปคของฉันคืออะไร",
  "สเปกของฉันคืออะไร",
  "ถามสเปคของฉัน",
  "ถามสเปกของฉัน",
  "ข้อมูลของฉันคืออะไร",
  "โปรไฟล์ของฉันคืออะไร",
  "เป้าหมายของฉันคืออะไร",
  "เป้าหมายตอนนี้คืออะไร",
  "เป้าสุขภาพของฉันคืออะไร",
  "มื้อก่อนหน้าคืออะไร",
  "มื้อล่าสุดคืออะไร",
], text);

const isOnboardingCommandText = (text) => exactTexts([
  "กินไรดี",
  "กินอะไรดี",
  "หิวแล้ว",
  "สรุปวันนี้",
  "ถามแปะ",
  "แปะรูปอาหาร",
  "แปะเลย",
  "ส่งรูปอาหาร",
  "ส่งรูป",
  "ตั้งเป้าสุขภาพ",
  "แก้มื้อล่าสุด",
  "ลบมื้อล่าสุด",
  "วันนี้กินอะไรไปบ้าง",
], text);


const normalizePaeMention = (text) => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .replace(/[\sๆ~!！?？.。…。、,，:：;；\-_=+*()\[\]{}"'“”‘’`]+/g, "")
  .replace(/(ครับ|คับ|ค้าบ|ค๊าบ|ฮะ|ค่ะ|คะ|จ้า|จ๊ะ|จ๋า|นะ|น้า|หน่อย)$/g, "");

const isPaeMentionOnlyText = (text) => {
  const value = normalizePaeMention(text);

  if (!value) return false;

  const mentionWords = [
    "แปะ",
    "อาแปะ",
    "เฮียแปะ",
    "แปะแคล",
    "แปะcal",
    "paecal",
    "pae",
  ];

  return mentionWords.includes(value);
};

const getPaeMentionReply = (title) => {
  const options = [
    `${title} แปะอยู่นี่จ้า 😄\n\nกินอะไรมา ส่งรูปหรือพิมพ์บอกแปะได้เลย`,
    `ว่าไง ${title} 👀\n\nจะถามเรื่องกิน ส่งรูปอาหาร หรือพิมพ์มื้อที่กินมาก็ได้ เดี๋ยวแปะดูให้`,
    `${title} เรียกแปะเหรอ 😄\n\nมีเมนูไหนลังเล หรือมีมื้อไหนอยากแปะไว้ ส่งมาเลย`,
  ];

  return options[Math.floor(Math.random() * options.length)];
};


const TITLE_COMMAND_PATTERN = /^(?:เปลี่ยนคำเรียกเป็น|ตั้งคำเรียกเป็น|ตั้งคำเรียกว่า|คำเรียกเป็น|คำเรียกคือ|ให้แปะเรียกว่า|ให้แปะเรียกฉันว่า|ให้แปะเรียกผมว่า|แปะเรียกฉันว่า|แปะเรียกผมว่า)\s*(.+)$/i;

const TITLE_FROM_CALL_PATTERN = /^(?:เรียกฉันว่า|เรียกผมว่า|เรียกเราว่า)\s*(.+)$/i;

const TITLE_HELP_TEXTS = [
  "เปลี่ยนคำเรียก",
  "ตั้งคำเรียก",
  "เลือกคำเรียก",
  "แปะเรียกอะไรได้บ้าง",
  "ให้แปะเรียกว่าอะไรได้บ้าง",
];

const KNOWN_TITLE_WORDS = [
  "เฮีย", "เจ้", "เจ๊", "ซ้อ", "อาตี๋", "ตี๋", "อาหมวย", "หมวย", "อากง", "กง", "อาเจ๊", "อาซ้อ",
];

const cleanTitleText = (value) => String(value || "")
  .trim()
  .replace(/["“”'‘’`]/g, "")
  .replace(/[.!！?？~]+$/g, "")
  .trim();

const looksLikeTitleText = (value) => {
  const clean = cleanTitleText(value).toLowerCase();
  if (!clean || clean.length > 24) return false;
  if (KNOWN_TITLE_WORDS.includes(clean)) return true;
  return /^(เฮีย|เจ้|เจ๊|ซ้อ|อาตี๋|ตี๋|อาหมวย|หมวย|อากง|กง|อาเจ๊|อาซ้อ)/i.test(clean);
};

const isTitleHelpText = (text) => exactTexts(TITLE_HELP_TEXTS, text);

const getTitleCommandValue = (text) => {
  const raw = String(text || "").trim();
  const direct = raw.match(TITLE_COMMAND_PATTERN);
  if (direct?.[1]) return cleanTitleText(direct[1]);

  const call = raw.match(TITLE_FROM_CALL_PATTERN);
  if (call?.[1] && looksLikeTitleText(call[1])) {
    return cleanTitleText(call[1]);
  }

  return "";
};

const getTitleHelpText = (currentTitle) => {
  return `${currentTitle} เลือกคำเรียกเองได้เลยนะ 😄

พิมพ์แบบนี้ได้:
- เปลี่ยนคำเรียกเป็น เฮีย
- เปลี่ยนคำเรียกเป็น เจ๊
- เปลี่ยนคำเรียกเป็น ซ้อ
- เปลี่ยนคำเรียกเป็น อาตี๋
- เปลี่ยนคำเรียกเป็น อาหมวย
- เปลี่ยนคำเรียกเป็น อากง

หรือพิมพ์คำที่อยากให้แปะเรียกได้เลย
เช่น “เปลี่ยนคำเรียกเป็น คุณเบ๊นซ์”`;
};

const NAME_PATTERN = /^(?:เปลี่ยนชื่อเป็น|ฉันชื่อ|ผมชื่อ|ชื่อ|เรียกฉันว่า|เรียกผมว่า)\s*(.+)$/i;

const isExplicitNameText = (text) => NAME_PATTERN.test(String(text || "").trim());

const getNameFromExplicitText = (text) => {
  const match = String(text || "").trim().match(NAME_PATTERN);
  return match?.[1]?.trim() || "";
};

const getProfileAnswerText = ({ title, profile, session }) => {
  const data = session?.data || {};
  const name = data.name || profile?.name || "";
  const stats = data.stats || profile?.stats || "";
  const goal = data.goal || profile?.goal || "";
  const calorieTarget =
    data.calorieTarget || profile?.calorieTarget || DEFAULT_CALORIE_TARGET;

  return `จำได้จ้า ${title} 😊

👤 ชื่อ: ${name || "ยังไม่มีชื่อที่บันทึกไว้"}
📏 สเปก: ${stats || "ยังไม่มีสเปกที่บันทึกไว้"}
🎯 เป้าหมาย: ${goal || "ยังไม่ได้ตั้งเป้าหมาย"}
🔥 เป้าต่อวัน: ${calorieTarget} kcal

ถ้าอยากเปลี่ยน
พิมพ์ “เปลี่ยนชื่อเป็นเบ๊นซ์”
“เปลี่ยนคำเรียกเป็น เจ๊”
หรือ “ตั้งเป้าสุขภาพ” ได้เลยจ้า`;
};

const getLastMealAnswerText = ({ title, meal }) => {
  if (!meal) {
    return `${title} แปะยังไม่เจอมื้อล่าสุดน้า 😅

ส่งรูปอาหารมาก่อน
เดี๋ยวแปะจำให้จ้า`;
  }

  return `มื้อล่าสุดที่แปะจำไว้คือ 🍽️

${meal.menuName || "อาหาร"}
ประมาณ ${meal.kcal || 0} kcal

🍚 คาร์บ ${meal.carb || 0} g
💪 โปรตีน ${meal.protein || 0} g
💧 ไขมัน ${meal.fat || 0} g

ถ้าผิด พิมพ์ “แก้มื้อล่าสุด” ได้เลยจ้า`;
};

const isEditMealHelpText = (text) => exactTexts([
  "แก้มื้อล่าสุด",
  "แก้ไขมื้อล่าสุด",
  "แก้มื้อเมื่อกี้",
  "แก้ไขมื้อเมื่อกี้",
  "แก้เมนูล่าสุด",
  "แก้ไขเมนูล่าสุด",
], text);

const isDeleteMealText = (text) => exactTexts([
  "ลบมื้อล่าสุด",
  "ลบอันเมื่อกี้",
  "ลบมื้อเมื่อกี้",
  "ไม่เอามื้อนี้",
  "ส่งผิด",
], text);

const isStartGoalUpdateText = (text) => exactTexts([
  "ตั้งเป้าสุขภาพ",
  "ตั้งเป้าใหม่",
  "เปลี่ยนเป้าหมาย",
  "เปลี่ยนเป้าสุขภาพ",
  "แก้เป้าหมาย",
], text);

const getEditHelpText = (title) => {
  return `${title} อยากแก้มื้อล่าสุดใช่ไหมจ๊ะ 🧾

พิมพ์แบบนี้ได้เลยน้า:

- แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว
- ไม่ใช่ข้าวผัด เป็นข้าวหมูกระเทียม
- แก้เป็น 650 kcal
- ลบมื้อล่าสุด

แปะจะไม่เดาเองนะ
ต้องให้${title}บอกก่อนว่าจะแก้อะไรจ้า`;
};

const getGoalHelpText = (title) => {
  return `${title} อยากตั้งเป้าสุขภาพใหม่ใช่ไหมจ๊ะ 🎯

พิมพ์เป้าหมายที่อยากได้มาได้เลย เช่น:

- อยากลดไขมัน
- อยากเพิ่มกล้าม
- อยากคุมน้ำหนัก
- อยากกินสุขภาพดีขึ้น

เดี๋ยวแปะบันทึกให้จ้า`;
};

const extractKcalFromText = (text) => {
  const match = String(text || "").match(/(\d{2,5})\s*(?:kcal|แคล|กิโลแคล)?/i);
  return match ? Number(match[1]) : null;
};

const extractMenuFromEditText = (text) => {
  const raw = String(text || "").trim();
  const patterns = [
    /(?:แก้มื้อล่าสุดเป็น|แก้ไขมื้อล่าสุดเป็น|แก้เมนูล่าสุดเป็น|แก้เป็นเมนู)\s+(.+)/i,
    /(?:ไม่ใช่.+?เป็น)\s+(.+)/i,
    /(?:เปลี่ยนเป็น)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
};

const formatUpdatedMealReply = ({ title, oldMeal, updatedMeal, summary }) => {
  const total = summary.todayCalories ?? summary.totalToday ?? 0;
  const target = summary.calorieTarget || DEFAULT_CALORIE_TARGET;
  const progress = buildProgressBar(total, target);

  return `โอเค ${title} แปะแก้มื้อล่าสุดให้แล้วจ้า 🧾

จาก: ${oldMeal?.menuName || "มื้อก่อนหน้า"}
เป็น: ${updatedMeal?.menuName || oldMeal?.menuName || "อาหาร"}
ประมาณ: ${updatedMeal?.kcal ?? oldMeal?.kcal ?? 0} kcal

📊 วันนี้กินไปแล้ว:
${total} / ${target} kcal
(${progress})`;
};

const formatDeletedMealReply = ({ title, deletedMeal, summary }) => {
  const total = summary.todayCalories ?? summary.totalToday ?? 0;
  const target = summary.calorieTarget || DEFAULT_CALORIE_TARGET;
  const progress = buildProgressBar(total, target);

  return `โอเค ${title} แปะลบมื้อล่าสุดให้แล้วจ้า 🗑️

ลบ: ${deletedMeal?.menuName || "มื้อล่าสุด"}

📊 วันนี้กินไปแล้ว:
${total} / ${target} kcal
(${progress})`;
};

const getSummaryValue = (summary, keys, fallback = 0) => {
  for (const key of keys) {
    const value = summary?.[key];
    if (value !== undefined && value !== null && value !== "") return Number(value) || fallback;
  }
  return fallback;
};

const normalizeSummaryForRecap = (summary = {}) => {
  const total = getSummaryValue(summary, ["todayCalories", "totalToday", "totalKcal", "totalCalories"], 0);
  const target = getSummaryValue(summary, ["calorieTarget", "target", "targetKcal"], DEFAULT_CALORIE_TARGET);
  const carb = getSummaryValue(summary, ["totalCarb", "carb"], 0);
  const protein = getSummaryValue(summary, ["totalProtein", "protein"], 0);
  const fat = getSummaryValue(summary, ["totalFat", "fat"], 0);
  const meals = Array.isArray(summary.meals) ? summary.meals : [];
  const mealCount = Number(summary.mealCount ?? meals.length ?? 0) || 0;
  const left = Math.max(target - total, 0);
  const over = Math.max(total - target, 0);

  return { total, target, carb, protein, fat, meals, mealCount, left, over };
};

const getTopMealForRecap = (meals = []) => {
  const activeMeals = meals.filter(Boolean);
  if (!activeMeals.length) return null;

  return activeMeals.reduce((top, meal) => {
    const kcal = Number(meal?.kcal || meal?.totalKcal || 0) || 0;
    const topKcal = Number(top?.kcal || top?.totalKcal || 0) || 0;
    return kcal > topKcal ? meal : top;
  }, activeMeals[0]);
};

const getRecapStatus = ({ total, target, left, over }) => {
  if (total <= 0) {
    return {
      statusText: "วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้นะ 😄",
      statusColor: "#6B7280",
      mood: "empty",
    };
  }

  if (over > 0) {
    return {
      statusText: `เกินเป้าไปประมาณ ${Math.round(over)} kcal แล้วนะ 👀`,
      statusColor: "#DC2626",
      mood: "over",
    };
  }

  if (left <= 250) {
    return {
      statusText: `เหลือประมาณ ${Math.round(left)} kcal ใกล้เต็มแล้วนะ 😅`,
      statusColor: "#D97706",
      mood: "near",
    };
  }

  return {
    statusText: `เหลือประมาณ ${Math.round(left)} kcal ยังหายใจได้อยู่ 😄`,
    statusColor: "#047857",
    mood: "ok",
  };
};

const getGoalLabelForRecap = (goalText = "") => {
  const goal = String(goalText || "").trim();
  if (!goal) return "ยังไม่ได้ตั้งเป้าสุขภาพ";
  return goal.length > 38 ? `${goal.slice(0, 38)}…` : goal;
};

const getGoalAwareRecapLine = ({ goalText = "", normalized, topMeal }) => {
  const goal = getGoalSignals(goalText);
  if (!goal.hasGoal) return "";

  const mealText = normalizeText(topMeal?.menuName || "");
  const hasSweetMeal = hasAnyText(mealText, ["หวาน", "ชา", "ชานม", "น้ำหวาน", "โกโก้", "ขนม", "เค้ก", "ไอติม"]);
  const hasFriedMeal = hasAnyText(mealText, ["ทอด", "กรอบ", "หมูกรอบ", "ของทอด"]);

  if (goal.sweetControl && hasSweetMeal) {
    return "เป้าคุมหวานของลื้อ แปะเห็นแล้วนะ วันนี้หวานมีโผล่มานิดนึง พรุ่งนี้ลดไซซ์ได้คือสวยเลย 🧋👀";
  }

  if (goal.fatLoss && (normalized.over > 0 || hasFriedMeal || normalized.fat >= 65)) {
    return "เป้าลดไขมันยังไปต่อได้อยู่\nแค่พรุ่งนี้ขอทอด/มันเบาลงหน่อย\nแปะว่าเอากลับมาได้ 😄🍃";
  }

  if (goal.muscleGain && normalized.protein < 70 && normalized.mealCount > 0) {
    return "ถ้าเป้าเพิ่มกล้าม วันนี้โปรตีนยังเติมได้อีกนิดนะ พรุ่งนี้หาไข่ ไก่ ปลา หรือเต้าหู้ติดไว้หน่อย 💪";
  }

  if (goal.lateControl) {
    return "เป้าไม่กินดึก แปะยังจำได้นะ คืนนี้ถ้าหิวจริง ๆ เอาเบา ๆ พอ ไม่ต้องเล่นใหญ่ 😅";
  }

  if (goal.healthyEating) {
    return "เป้ากินสุขภาพดี วันนี้ดูรวม ๆ ได้อยู่ พรุ่งนี้เพิ่มผักหรือโปรตีนอีกนิด แปะให้ผ่านง่ายขึ้นเลย 🥬";
  }

  if (goal.relaxed) {
    return "แปะจำได้ว่าเอาแบบไม่กดดันนะ วันนี้ดูเพื่อรู้ ไม่ได้ดูเพื่อดุ ชิล ๆ จ้า 😄";
  }

  return "เป้าที่ลื้อตั้งไว้ แปะจำอยู่นะ ค่อย ๆ ปรับให้เข้าทางตัวเองก็พอ 🎯";
};


const getMacroStatusForRecap = ({ normalized }) => {
  const target = Math.max(Number(normalized.target || DEFAULT_CALORIE_TARGET), 1);
  const carbLimit = Math.round(target * 0.55 / 4);
  const proteinFloor = 70;
  const fatLimit = Math.round(target * 0.30 / 9);

  return {
    carbColor: normalized.carb > carbLimit ? "#DC2626" : "#111827",
    proteinColor: normalized.mealCount > 0 && normalized.protein < proteinFloor ? "#D97706" : "#047857",
    fatColor: normalized.fat > fatLimit ? "#DC2626" : "#111827",
    carbNote: normalized.carb > carbLimit ? "สูงกว่าที่ควรนิดนึง" : "",
    proteinNote: normalized.protein >= proteinFloor ? "โปรตีนดี" : "โปรตีนยังเติมได้",
    fatNote: normalized.fat > fatLimit ? "ไขมันเริ่มสูง" : "",
  };
};

const getMealLabelForRecap = (meal = {}) => {
  const raw = String(meal.mealLabel || meal.label || meal.mealTime || "").trim();
  if (raw) return raw;

  const name = normalizeText(meal.menuName || meal.name || "");
  if (name.includes("เช้า")) return "เช้า";
  if (name.includes("เที่ยง") || name.includes("กลางวัน")) return "เที่ยง";
  if (name.includes("เย็น") || name.includes("ค่ำ")) return "เย็น";
  if (name.includes("ดึก")) return "ดึก";
  return "";
};

const formatMealNameForRecap = (meal = {}) => {
  const name = String(meal.menuName || meal.name || "อาหาร").trim();
  const label = getMealLabelForRecap(meal);
  return label && !name.includes(label) ? `${label}: ${name}` : name;
};

const normalizeMealLabelForSplit = (label = "") => {
  const value = normalizeText(label);
  if (value === "กลางวัน") return "เที่ยง";
  if (value === "เยน") return "เย็น";
  return value;
};

const splitExplicitMealText = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const source = raw
    .replace(/\r/g, "\n")
    .replace(/[，,]+/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s*(และ)\s*(?=(?:มื้อ)?(?:เช้า|เที่ยง|กลางวัน|เย็น|เยน|ค่ำ|ดึก)\b)/gi, " และ ")
    .trim();

  // Two patterns:
  // 1) "มื้อเที่ยง..." can appear anywhere, e.g. "วันนี้มื้อเที่ยง..."
  // 2) Plain "เที่ยง..." must be separated by start/space/และ to avoid matching words like "ชาเย็น"
  const mealPattern = /(?:มื้อ(เช้า|เที่ยง|กลางวัน|เย็น|เยน|ค่ำ|ดึก)\s*(?:[:：\-])?|(^|[\s\n]|และ)(เช้า|เที่ยง|กลางวัน|เย็น|เยน|ค่ำ|ดึก)\s*(?:[:：\-])?)/gi;
  const matches = Array.from(source.matchAll(mealPattern));

  if (matches.length < 2) return [];

  const segments = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = normalizeMealLabelForSplit(match[1] || match[3] || "");
    const foodStart = match.index + match[0].length;
    const foodEnd = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const foodText = source
      .slice(foodStart, foodEnd)
      .replace(/(และ|แล้ว|ต่อด้วย)\s*$/i, "")
      .replace(/^(กิน|ทาน|คือ|เป็น)\s*/i, "")
      .replace(/(และ|แล้ว|ต่อด้วย)\s*$/i, "")
      .trim();

    if (label && foodText) {
      segments.push({ label, foodText });
    }
  }

  return segments.length >= 2 ? segments.slice(0, 5) : [];
};

const logExplicitMealSegments = async ({ event, userId, session, title, segments, goalText }) => {
  const explicitTotalT = nowMs();
  console.log("Explicit meal split detected:", segments.map((s) => `${s.label}:${s.foodText}`).join(" | "));
  await replyText(
    event.replyToken,
    `${title} แปะกำลังแยกมื้อให้แป๊บนะ 👀\nหลายมื้อหน่อย เดี๋ยวรวมให้แบบไม่มั่ว 🍽️`
  );

  const estimateT = nowMs();
  const estimatedMeals = await Promise.all(
    segments.map(async (segment, index) => {
      const foodData = await estimateFoodFromText(segment.foodText);
      const kcal = safeNumber(foodData.kcal, 0);
      const carb = safeNumber(foodData.carb, 0);
      const protein = safeNumber(foodData.protein, 0);
      const fat = safeNumber(foodData.fat, 0);
      const menuName = `${segment.label}: ${foodData.menuName || segment.foodText}`;
      const items = normalizeEstimatedItems(foodData, segment.foodText);
      const requestId = `${getMessageRequestId(event, "text-log")}:part-${index + 1}`;

      return normalizeMealRecord({
        menuName,
        kcal,
        carb,
        protein,
        fat,
        items,
        requestId,
        mealLabel: segment.label,
      });
    })
  );

  logTiming("textMultiMeal", "estimateAll", estimateT, `segments=${segments.length}`);

  const sheetT = nowMs();
  const sheetData = await batchLogFood({
    userId,
    name: session.data?.name || "",
    meals: estimatedMeals.map((meal) => ({
      menuName: meal.menuName,
      kcal: meal.kcal,
      carb: meal.carb,
      protein: meal.protein,
      fat: meal.fat,
      requestId: meal.requestId,
      itemsJson: serializeMealItems(meal.items || []),
    })),
  });

  logTiming("textMultiMeal", "batchLogFood", sheetT);

  const target = sheetData?.calorieTarget || DEFAULT_CALORIE_TARGET;
  const total = sheetData?.todayCalories ?? sheetData?.totalToday ?? estimatedMeals.reduce((sum, meal) => sum + safeNumber(meal.kcal, 0), 0);
  const recentMeals = estimatedMeals.reduce(
    (list, meal) => upsertRecentMealList(list, meal),
    getRecentMealsFromSession(session)
  );
  const lastMeal = estimatedMeals[estimatedMeals.length - 1] || null;
  const loggedText = estimatedMeals
    .map((meal) => `- ${meal.menuName} ${Math.round(safeNumber(meal.kcal, 0))} kcal`)
    .join("\n");
  const left = Math.max(Math.round(target - total), 0);
  const progress = buildProgressBar(total, target);

  await syncSessionFromProfile({
    userId,
    session,
    extraData: { calorieTarget: target, lastMeal, recentMeals },
  });

  const pushT = nowMs();
  await pushTexts(userId, [
    `${title} แปะแยกมื้อให้แล้วนะ 🍽️\n\n${loggedText}`,
    `📊 วันนี้กินไปแล้ว\n${Math.round(total)} / ${Math.round(target)} kcal\n${total > target ? `เกินประมาณ ${Math.round(total - target)} kcal` : `เหลือประมาณ ${left} kcal`}\n(${progress})`,
    total > target
      ? "วันนี้เกินนิดนึง ไม่ต้องตกใจ พรุ่งนี้ค่อยดึงกลับจ้า 😄"
      : "ยังพอจัดได้อยู่ มื้อต่อไปเลือกดี ๆ นะ 😄",
  ]);
};


const buildDailyRecapPayload = ({ title, summary, goalText = "" }) => {
  const normalized = normalizeSummaryForRecap(summary);
  const status = getRecapStatus(normalized);
  const macroStatus = getMacroStatusForRecap({ normalized });
  const topMeal = getTopMealForRecap(normalized.meals);
  const topMealName = topMeal ? formatMealNameForRecap(topMeal) : "";
  const topMealKcal = Number(topMeal?.kcal || topMeal?.totalKcal || 0) || 0;
  const topMealText = topMealName
    ? `${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ""}`
    : "ยังไม่มีมื้อเด่น";

  const card = {
    statusText: status.statusText,
    statusColor: status.statusColor,
    kcalText: `${Math.round(normalized.total)} / ${Math.round(normalized.target)} kcal`,
    kcalColor: normalized.over > 0 ? "#DC2626" : status.mood === "near" ? "#D97706" : "#111827",
    carbText: `${Math.round(normalized.carb)} g`,
    carbColor: macroStatus.carbColor,
    proteinText: `${Math.round(normalized.protein)} g`,
    proteinColor: macroStatus.proteinColor,
    fatText: `${Math.round(normalized.fat)} g`,
    fatColor: macroStatus.fatColor,
    mealCountText: `${normalized.mealCount} มื้อ`,
    goalText: getGoalLabelForRecap(goalText),
    topMealText,
  };

  if (status.mood === "empty") {
    return {
      card,
      bubbles: [
        `${title} วันนี้แปะยังไม่เห็นมื้อที่บันทึกไว้น้า 😄\n\nส่งรูปอาหารหรือพิมพ์เมนูมาได้เลย เดี๋ยวแปะรวมให้เอง`,
      ],
    };
  }

  const goalLine = getGoalAwareRecapLine({ goalText, normalized, topMeal });
  const insightParts = [];

  if (topMealName) {
    insightParts.push(`${topMealName} ล่อไป ~${Math.round(topMealKcal)} kcal 🍗🤯`);
  }

  if (macroStatus.fatNote) {
    insightParts.push("ไขมันเริ่มสูงนิดนึง แปะขอเบาของทอด/มันลงหน่อย 🫣");
  }

  if (macroStatus.carbNote) {
    insightParts.push("คาร์บวันนี้มาแน่นอยู่ พรุ่งนี้ค่อยบาลานซ์กลับ 🍚👀");
  }

  if (macroStatus.proteinNote && normalized.mealCount > 0) {
    insightParts.push(
      normalized.protein >= 70
        ? "แต่โปรตีนดูดี! 💪🔥"
        : "โปรตีนยังเติมได้อีกนิด พรุ่งนี้หาไข่/ไก่/เต้าหู้ช่วยได้ 💪"
    );
  }

  const cleanGoalLine = goalLine
    ? goalLine
        .replace("เป้าลดไขมันยังไปต่อได้อยู่ แค่พรุ่งนี้ขอทอด/มันเบาลงหน่อย แปะว่าเอากลับมาได้ 😄🍃", "เป้าลดไขมันยังไปต่อได้อยู่\nแค่พรุ่งนี้ขอทอด/มันเบาลงหน่อย\nแปะว่าเอากลับมาได้ 😄🍃")
        .replace("เป้าลดไขมันยังไปต่อได้อยู่ แค่พรุ่งนี้ขอทอด/มันเบาลงหน่อย แปะว่าเอากลับมาได้ 😄", "เป้าลดไขมันยังไปต่อได้อยู่\nแค่พรุ่งนี้ขอทอด/มันเบาลงหน่อย\nแปะว่าเอากลับมาได้ 😄🍃")
    : "";

  const insight = `💡 อินไซต์จากแปะ\n${insightParts.slice(0, 3).join("\n\n")}${cleanGoalLine ? `\n\n${cleanGoalLine}` : ""}`;

  return {
    card,
    bubbles: [insight],
  };
};

const replySmartSummary = async ({ replyToken, userId, title, goalText = "" }) => {
  const totalT = nowMs();
  const summaryT = nowMs();
  const summary = await getDailySummary(userId);
  logTiming("summary", "sheetTotal", summaryT, `meals=${summary?.mealCount ?? "?"}`);

  const buildT = nowMs();
  const payload = buildDailyRecapPayload({ title, summary, goalText });
  logTiming("summary", "buildPayload", buildT);

  const replyT = nowMs();
  await replyDailyRecapCardWithBubbles(replyToken, { title, ...payload });
  logTiming("summary", "replyLine", replyT);
  logTiming("summary", "total", totalT);
};

export const handleTextMessage = async (event) => {
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const text = String(event.message.text || "").trim();
  const session = await getSession(userId);

  if (text === "__FOLLOW__") {
    await updateSession({ userId, step: "ASK_NAME", sessionData: {} });
    await replyText(
      replyToken,
      "หนีห่าว! แปะแคลพร้อมดูแลสุขภาพแล้ว! ลื้อชื่ออะไรจ๊ะ?"
    );
    return;
  }

  const profileForOnboarding = await getProfile(userId);
  const savedName = session?.data?.name || profileForOnboarding?.name || "";

  if (
    !savedName &&
    !isExplicitNameText(text) &&
    session.step !== "ASK_NAME" &&
    session.step !== "ASK_STATS" &&
    session.step !== "ASK_GOAL" &&
    session.step !== "ASK_GOAL_UPDATE"
  ) {
    await updateSession({
      userId,
      step: "ASK_NAME",
      sessionData: session.data || {},
    });

    await replyText(
      replyToken,
      "แปะขอรู้จักชื่อก่อนน้า 😊\n\nลื้อชื่ออะไรจ๊ะ?\nพิมพ์แบบนี้ก็ได้: ฉันชื่อเบ๊นซ์"
    );
    return;
  }

  if (isProfileQuestionText(text)) {
    const title = await getDisplayTitle({ userId, session });

    if (text === "มื้อก่อนหน้าคืออะไร" || text === "มื้อล่าสุดคืออะไร") {
      const latest = await getLastMeal(userId);
      await replyText(replyToken, getLastMealAnswerText({ title, meal: latest?.meal || null }));
      return;
    }

    await replyText(
      replyToken,
      getProfileAnswerText({ title, profile: profileForOnboarding, session })
    );
    return;
  }

  const nameMatch = ![
    "ฉันชื่ออะไร",
    "ชื่อฉันคืออะไร",
    "แปะจำชื่อฉันได้ไหม",
  ].includes(text)
    ? text.match(NAME_PATTERN)
    : null;

  if (nameMatch) {
    const newName = getNameFromExplicitText(text);
    const profile = profileForOnboarding || {};
    const stats = session.data?.stats || profile.stats || "";
    const title = buildTitleFromProfile({ name: newName, stats, fallbackTitle: "" });
    const calorieTarget = session.data?.calorieTarget || profile.calorieTarget || DEFAULT_CALORIE_TARGET;

    await saveProfile({
      userId,
      name: newName,
      title,
      stats,
      goal: session.data?.goal || profile.goal || "",
      calorieTarget,
    });

    const nextStep = session.step === "ASK_NAME" ? "ASK_STATS" : session.step || "READY";

    await updateSession({
      userId,
      step: nextStep,
      sessionData: {
        ...session.data,
        name: newName,
        title,
        stats,
        goal: session.data?.goal || profile.goal || "",
        calorieTarget,
      },
    });

    const message = session.step === "ASK_NAME"
      ? `จำได้แล้วจ้า ต่อไปแปะจะเรียก ${title} นะ 😊\n\nขอสเปกหน่อยน้า\nเพศ อายุ สูง น้ำหนัก\n\n💡 เช่น: ชาย 31 165 61`
      : `จำได้แล้วจ้า ต่อไปแปะจะเรียก ${title} นะ 😊`;

    await replyText(replyToken, message);
    return;
  }

  if (session.step === "ASK_NAME") {
    if (isOnboardingCommandText(text)) {
      await replyText(
        replyToken,
        "เดี๋ยวก่อนน้า แปะยังไม่รู้จักชื่อเลย 😅\n\nลื้อชื่ออะไรจ๊ะ?\nพิมพ์แบบนี้ก็ได้: ฉันชื่อเบ๊นซ์"
      );
      return;
    }

    const name = isExplicitNameText(text) ? getNameFromExplicitText(text) : text;

    if (!name || name.length > 30) {
      await replyText(
        replyToken,
        "แปะขอชื่อสั้น ๆ ก่อนน้า 😊\nเช่น: เบ๊นซ์ หรือ ฉันชื่อเบ๊นซ์"
      );
      return;
    }

    await saveProfile({
      userId,
      name,
      title: "",
      stats: "",
      goal: "",
      calorieTarget: DEFAULT_CALORIE_TARGET,
    });

    await updateSession({ userId, step: "ASK_STATS", sessionData: { name } });

    await replyText(
      replyToken,
      `จำได้แล้วจ้า ${name} 😊\n\nขอสเปกหน่อยน้า\nเพศ อายุ สูง น้ำหนัก\n\n💡 เช่น: ชาย 31 165 61`
    );
    return;
  }

  if (session.step === "ASK_STATS") {
    const profile = profileForOnboarding || {};
    const parts = text.split(/\s+/);
    const name = session.data?.name || profile.name || "";
    const title = getTitle(parts[0], parts[1], name);
    const tdee = calculateTDEE(text);

    await saveProfile({ userId, name, title, stats: text, goal: "", calorieTarget: tdee });
    await updateSession({ userId, step: "ASK_GOAL", sessionData: { ...session.data, name, stats: text, title, calorieTarget: tdee } });

    await replyText(
      replyToken,
      `โอเคจ้า ${title}! ด่านสุดท้าย เป้าหมาย/สไตล์การกินเป็นไงบ้างจ๊ะ?\n\nไม่มีพิมพ์ "ไม่มี" ได้เลย`
    );
    return;
  }

  if (session.step === "ASK_GOAL" || session.step === "ASK_GOAL_UPDATE") {
    const profile = profileForOnboarding || {};
    const name = session.data?.name || profile.name || "";
    const stats = session.data?.stats || profile.stats || "";
    const title = session.data?.title || profile.title || buildTitleFromProfile({ name, stats, fallbackTitle: "" });
    const calorieTarget = session.data?.calorieTarget || profile.calorieTarget || calculateTDEE(stats);

    await saveProfile({ userId, name, title, stats, goal: text, calorieTarget });
    await updateSession({ userId, step: "READY", sessionData: { ...session.data, name, stats, title, goal: text, calorieTarget } });

    await replyText(
      replyToken,
      `บันทึกเป้าหมายเรียบร้อยจ้า ${title}! 🎯\n\nเป้าหมาย: ${text}\n🔥 เป้าต่อวันประมาณ: ${calorieTarget} kcal\n\nส่งรูปอาหารมาให้อั๊วแปะแคลได้เลย! 📸`
    );
    return;
  }

  const title = await getDisplayTitle({ userId, session });
  const goalText = getGoalTextFromContext({ session, profile: profileForOnboarding });

  if (isTitleHelpText(text)) {
    await replyText(replyToken, getTitleHelpText(title));
    return;
  }

  const requestedTitle = getTitleCommandValue(text);
  if (requestedTitle) {
    const profile = profileForOnboarding || {};
    const nextTitle = requestedTitle;
    const name = session.data?.name || profile.name || "";
    const stats = session.data?.stats || profile.stats || "";
    const goal = session.data?.goal || profile.goal || "";
    const calorieTarget = session.data?.calorieTarget || profile.calorieTarget || DEFAULT_CALORIE_TARGET;

    await saveProfile({ userId, name, title: nextTitle, stats, goal, calorieTarget });
    await updateSession({
      userId,
      step: session.step || "READY",
      sessionData: {
        ...session.data,
        name,
        title: nextTitle,
        stats,
        goal,
        calorieTarget,
      },
    });

    await replyText(
      replyToken,
      `ได้เลย ต่อไปแปะจะเรียก ${nextTitle} นะ 😄

ถ้าอยากเปลี่ยนอีก พิมพ์ “เปลี่ยนคำเรียกเป็น ...” ได้เลย`
    );
    return;
  }

  if (isPaeGuideText(text)) {
    await replyTexts(replyToken, getPaeGuideMessages(title));
    return;
  }

  if (text === "ถามแปะ") {
    await replyText(replyToken, `ถามมาได้เลยนะ ${title} 🍚\n\nแปะถนัดเรื่องกิน แคล และมื้อที่กิน\nเช่น:\n\n- หิวแล้ว\n- เย็นนี้กินไรดี\n- วันนี้กินโปรตีนพอยัง\n- เมนูนี้หนักไปไหม`);
    return;
  }

  if (isPaeMentionOnlyText(text)) {
    await replyText(replyToken, getPaeMentionReply(title));
    return;
  }

  if (isAcknowledgementText(text)) {
    // Standalone acknowledgements like "เค", "ครับ", "จ้า", "โอเค"
    // are conversation closers. Do not reply, otherwise Pae feels needy/repetitive.
    return;
  }

  if (isProteinStatusQuestionText(text)) {
    const summary = await getDailySummary(userId);
    await replyText(replyToken, buildProteinStatusReply({ title, summary }));
    return;
  }

  if (isFatStatusQuestionText(text)) {
    const summary = await getDailySummary(userId);
    await replyText(replyToken, buildFatStatusReply({ title, summary }));
    return;
  }

  if (isCarbStatusQuestionText(text)) {
    const summary = await getDailySummary(userId);
    await replyText(replyToken, buildCarbStatusReply({ title, summary }));
    return;
  }

  if (isLatestMealHeavyQuestionText(text)) {
    await replyText(replyToken, await buildLatestMealHeavyReply({ title, userId, session, goalText }));
    return;
  }

  if (isRefreshSummaryText(text)) {
    await replyText(replyToken, `${title} แปะรีเฟรชสรุปให้ใหม่แล้วนะ 🔄`);
    const summary = await getDailySummaryFresh(userId);
    const payload = buildDailyRecapPayload({ title, summary, goalText });
    await pushDailyRecapCardWithBubbles(userId, { title, ...payload });
    return;
  }

  if (isExactSummaryText(text)) {
    await replySmartSummary({ replyToken, userId, title, goalText });
    return;
  }

  if (isEditMealHelpText(text)) {
    await replyText(replyToken, getEditHelpText(title));
    return;
  }

  if (isDeleteMealText(text)) {
    const deleted = await deleteLastMeal(userId);

    if (deleted.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅\n\nส่งรูปอาหารก่อนแล้วค่อยลบได้จ้า`);
      return;
    }

    await syncSessionFromProfile({ userId, session, extraData: { lastMeal: null } });
    await replyText(replyToken, formatDeletedMealReply({ title, deletedMeal: deleted.deletedMeal, summary: deleted }));
    return;
  }

  if (isStartGoalUpdateText(text)) {
    await updateSession({ userId, step: "ASK_GOAL_UPDATE", sessionData: session.data || {} });
    await replyText(replyToken, getGoalHelpText(title));
    return;
  }

  if (session.step !== "READY") {
    await replyText(replyToken, "แปะขอรู้จักลื้อก่อนน้า\nพิมพ์ชื่อมาก่อนเลยจ้า 😊");
    return;
  }

  const explicitMealSegmentsBeforeIntent = splitExplicitMealText(text);

  if (explicitMealSegmentsBeforeIntent.length >= 2) {
    await logExplicitMealSegments({
      event,
      userId,
      session,
      title,
      segments: explicitMealSegmentsBeforeIntent,
      goalText,
    });
    return;
  }

  if (isSmartMealCorrectionText(text)) {
    const { selectedMeal, recentMeals, reason } = selectMealForCorrection({ text, session });

    if (selectedMeal?.menuName) {
      const revised = await reviseFoodEstimateFromCorrection({
        previousMeal: selectedMeal,
        correctionText: text,
      });

      const updatedMeal = normalizeMealRecord({
        ...selectedMeal,
        menuName: revised.menuName || selectedMeal.menuName || "อาหาร",
        kcal: safeNumber(revised.kcal, selectedMeal.kcal || 0),
        carb: safeNumber(revised.carb, selectedMeal.carb || 0),
        protein: safeNumber(revised.protein, selectedMeal.protein || 0),
        fat: safeNumber(revised.fat, selectedMeal.fat || 0),
        items: normalizeEstimatedItems(revised, revised.menuName || selectedMeal.menuName || ""),
      });

      const updatePayload = {
        userId,
        menuName: updatedMeal.menuName,
        kcal: updatedMeal.kcal,
        carb: updatedMeal.carb,
        protein: updatedMeal.protein,
        fat: updatedMeal.fat,
        itemsJson: serializeMealItems(updatedMeal.items),
      };

      const updated = selectedMeal.requestId
        ? await updateMealByRequestId({ ...updatePayload, requestId: selectedMeal.requestId })
        : await updateLastMeal(updatePayload);

      if (updated.status !== "not_found") {
        const summary = {
          ...updated,
          todayCalories: updated.todayCalories ?? updated.totalToday ?? updatedMeal.kcal,
          totalToday: updated.totalToday ?? updated.todayCalories ?? updatedMeal.kcal,
          calorieTarget: updated.calorieTarget || session.data?.calorieTarget || DEFAULT_CALORIE_TARGET,
        };

        const nextRecentMeals = replaceRecentMeal(recentMeals, selectedMeal, updatedMeal);

        await syncSessionFromProfile({
          userId,
          session,
          extraData: {
            lastMeal: nextRecentMeals[0] || updatedMeal,
            recentMeals: nextRecentMeals,
            calorieTarget: summary.calorieTarget,
          },
        });

        await replyTexts(replyToken, buildSmartCorrectionReplyMessages({
          title,
          oldMeal: selectedMeal,
          updatedMeal,
          summary,
          targetLabel: getCorrectionTargetLabel(reason),
        }));
        return;
      }
    }
  }

  if (isPronounKcalQuestionText(text)) {
    const meal = await getLatestMealForFollowUp({ userId, session });
    await replyText(replyToken, buildPronounKcalReply({ title, meal }));
    return;
  }

  if (isLikelyFoodLogText(text)) {
    const explicitMealSegments = splitExplicitMealText(text);

    if (explicitMealSegments.length >= 2) {
      await logExplicitMealSegments({ event, userId, session, title, segments: explicitMealSegments, goalText });
      return;
    }

    const localIntent = getLocalIntent(text) || {
      intent: "log_food_text",
      foodText: stripEatLogPrefix(text),
    };
    const foodText = String(localIntent.foodText || text).trim();
    const foodData = await estimateFoodFromText(foodText);
    const kcal = safeNumber(foodData.kcal, 0);
    const carb = safeNumber(foodData.carb, 0);
    const protein = safeNumber(foodData.protein, 0);
    const fat = safeNumber(foodData.fat, 0);
    const menuName = foodData.menuName || foodText;
    const items = normalizeEstimatedItems(foodData, foodText);

    const requestId = getMessageRequestId(event, "text-log");
    const sheetData = await logFood({
      userId,
      name: session.data?.name || "",
      kcal,
      carb,
      protein,
      fat,
      menuName,
      requestId,
      itemsJson: serializeMealItems(items),
    });
    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const summary = { ...sheetData, todayCalories: total, totalToday: total, calorieTarget: target };
    const meal = normalizeMealRecord({ menuName, kcal, carb, protein, fat, items, requestId });
    const decision = decideFoodLog({ meal, summary });
    const recentMeals = upsertRecentMealList(getRecentMealsFromSession(session), meal);

    await syncSessionFromProfile({ userId, session, extraData: { calorieTarget: target, lastMeal: meal, recentMeals } });
    await replyTexts(replyToken, buildTextFoodLogMessages({ title, meal, summary, decision, goalText }));
    return;
  }

  if (isFoodAdviceText(text)) {
    const summary = await getDailySummary(userId);

    if (isFoodCompareText(text)) {
      await replyText(replyToken, buildFoodCompareReply({ title, text, summary }));
      return;
    }

    if (isFoodKcalQuestionText(text)) {
      const foodText = cleanFoodText(text);
      const foodData = await estimateFoodFromText(foodText);
      await replyText(replyToken, buildFoodKcalReply({ title, foodData, foodText }));
      return;
    }

    if (isNextMealAfterFoodText(text)) {
      await replyText(replyToken, buildNextMealAfterFoodReply({ title, text, summary, goalText }));
      return;
    }

    await replyText(replyToken, buildFoodAdviceReply({ title, text, summary, goalText }));
    return;
  }

  const intent = getLocalIntent(text) || await parseUserIntent({ text, session });

  if (intent.intent === "meal_edit_help") {
    await replyText(replyToken, getEditHelpText(title));
    return;
  }

  if (intent.intent === "delete_last_meal") {
    const deleted = await deleteLastMeal(userId);

    if (deleted.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅\n\nส่งรูปอาหารก่อนแล้วค่อยลบได้จ้า`);
      return;
    }

    await syncSessionFromProfile({ userId, session, extraData: { lastMeal: null } });
    await replyText(replyToken, formatDeletedMealReply({ title, deletedMeal: deleted.deletedMeal, summary: deleted }));
    return;
  }

  if (intent.intent === "edit_last_meal") {
    const latest = await getLastMeal(userId);

    if (latest.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้แก้น้า 😅\n\nส่งรูปอาหารก่อน แล้วค่อยแก้ได้จ้า`);
      return;
    }

    const explicitMenu = String(intent.foodText || "").trim() || extractMenuFromEditText(text);
    const explicitKcal = intent.kcal !== null && intent.kcal !== undefined ? Number(intent.kcal) : extractKcalFromText(text);

    if (!explicitMenu && !explicitKcal) {
      await replyText(replyToken, getEditHelpText(title));
      return;
    }

    let updatedPayload = { userId };

    if (explicitMenu) {
      const estimated = await estimateFoodFromText(explicitMenu);
      updatedPayload = {
        ...updatedPayload,
        menuName: estimated.menuName || explicitMenu,
        kcal: explicitKcal || safeNumber(estimated.kcal, latest.meal?.kcal || 0),
        carb: safeNumber(estimated.carb, latest.meal?.carb || 0),
        protein: safeNumber(estimated.protein, latest.meal?.protein || 0),
        fat: safeNumber(estimated.fat, latest.meal?.fat || 0),
      };
    } else if (explicitKcal) {
      updatedPayload = {
        ...updatedPayload,
        menuName: latest.meal?.menuName || "อาหาร",
        kcal: explicitKcal,
        carb: latest.meal?.carb || 0,
        protein: latest.meal?.protein || 0,
        fat: latest.meal?.fat || 0,
      };
    }

    const updated = await updateLastMeal(updatedPayload);

    if (updated.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้แก้น้า 😅`);
      return;
    }

    await syncSessionFromProfile({
      userId,
      session,
      extraData: {
        lastMeal: updated.updatedMeal,
        calorieTarget: updated.calorieTarget || session.data?.calorieTarget || DEFAULT_CALORIE_TARGET,
      },
    });

    await replyText(replyToken, formatUpdatedMealReply({ title, oldMeal: updated.oldMeal, updatedMeal: updated.updatedMeal, summary: updated }));
    return;
  }

  if (intent.intent === "adjust_last_meal") {
    if (!session.data?.lastMeal) {
      await replyText(replyToken, `${title} แปะยังไม่มีเมนูล่าสุดให้ปรับน้า 😅\n\nส่งรูปอาหารมาก่อน หรือบอกชื่อเมนูมาก็ได้จ้า`);
      return;
    }

    const lastMeal = session.data.lastMeal;
    const multiplier = safeNumber(intent.multiplier, 0);

    if (multiplier === 0) {
      await replyText(replyToken, `${title} แปะยังไม่ชัวร์ว่าต้องเพิ่มหรือลดเท่าไหร่จ้า 😅\n\nลองบอกแปะอีกที เช่น\n“เพิ่มอีก 1 จาน” หรือ “กินครึ่งเดียว”`);
      return;
    }

    const kcal = Math.round(safeNumber(lastMeal.kcal, 0) * multiplier);
    const carb = Math.round(safeNumber(lastMeal.carb, 0) * multiplier);
    const protein = Math.round(safeNumber(lastMeal.protein, 0) * multiplier);
    const fat = Math.round(safeNumber(lastMeal.fat, 0) * multiplier);

    const sheetData = await logFood({
      userId,
      name: session.data?.name || "",
      menuName: `${lastMeal.menuName} ปรับปริมาณ`,
      kcal,
      carb,
      protein,
      fat,
      requestId: getMessageRequestId(event, "adjust-last-meal"),
      itemsJson: serializeMealItems(lastMeal.items || []),
    });

    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const progress = buildProgressBar(total, target);
    const signText = kcal >= 0 ? "เพิ่ม" : "ลด";

    await replyText(replyToken, `โอเค ${title} แปะปรับจากเมนูล่าสุดให้แล้วนะ 😄\n\n🍳 ${lastMeal.menuName}\n${kcal >= 0 ? "➕" : "➖"} ${signText}ประมาณ ${Math.abs(kcal)} kcal\n\n📊 วันนี้กินไปแล้ว:\n${total} / ${target} kcal\n(${progress})`);
    return;
  }

  if (intent.intent === "log_food_text") {
    const foodText = String(intent.foodText || text).trim();
    const foodData = await estimateFoodFromText(foodText);
    const kcal = safeNumber(foodData.kcal, 0);
    const carb = safeNumber(foodData.carb, 0);
    const protein = safeNumber(foodData.protein, 0);
    const fat = safeNumber(foodData.fat, 0);
    const menuName = foodData.menuName || foodText;
    const items = normalizeEstimatedItems(foodData, foodText);

    const sheetData = await logFood({
      userId,
      name: session.data?.name || "",
      kcal,
      carb,
      protein,
      fat,
      menuName,
      requestId: getMessageRequestId(event, "text-log"),
      itemsJson: serializeMealItems(items),
    });
    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const summary = { ...sheetData, todayCalories: total, totalToday: total, calorieTarget: target };
    const meal = { menuName, kcal, carb, protein, fat, items };
    const decision = decideFoodLog({ meal, summary });

    await syncSessionFromProfile({ userId, session, extraData: { calorieTarget: target, lastMeal: meal } });
    await replyTexts(replyToken, buildTextFoodLogMessages({ title, meal, summary, decision, goalText }));
    return;
  }

  if (intent.intent === "daily_summary") {
    await replySmartSummary({ replyToken, userId, title, goalText });
    return;
  }

  if (intent.intent === "meal_suggestion") {
    const summary = await getDailySummary(userId);
    const decision = decideMealSuggestion({ summary, text });
    await replyText(
      replyToken,
      buildGoalAwareMealSuggestionReply({ title, summary, text, goalText, decision })
    );
    return;
  }

  if (intent.intent === "health_goal") {
    await updateSession({ userId, step: "ASK_GOAL_UPDATE", sessionData: session.data || {} });
    await replyText(replyToken, getGoalHelpText(title));
    return;
  }

  if (intent.intent === "off_topic") {
    await replyText(replyToken, "เรื่องนี้แปะไม่ถนัดน้า 😅\n\nแปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า\nส่งรูปอาหารหรือพิมพ์มื้อที่กินมาได้เลย");
    return;
  }

  await replyText(replyToken, `${title} แปะยังจับใจความไม่ค่อยได้น้า 😅\n\nลองส่งรูปอาหารมา\nหรือพิมพ์แบบนี้ได้เลย:\n\n- ข้าวมันไก่ 1 จาน\n- ชาไทยหวานน้อย\n- สรุปวันนี้\n- เย็นนี้กินอะไรดี\n- กินครึ่งเดียว`);
};
