import { replyDailyRecapCardWithBubbles, replyText, replyTexts } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { estimateFoodFromText, parseUserIntent } from "../services/openai.js";
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryOnce = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    await wait(350);
    return fn();
  }
};

const saveProfile = async (payload) => postToSheet({ action: "SAVE_PROFILE", ...payload });
const updateSession = async (payload) => postToSheet({ action: "UPDATE_SESSION", ...payload });
const logFood = async (payload) => postToSheet({ action: "LOG_FOOD", ...payload });
const getDailySummary = async (userId) => postToSheet({ action: "GET_DAILY_SUMMARY", userId });
const getLastMeal = async (userId) => postToSheet({ action: "GET_LAST_MEAL", userId });
const updateLastMeal = async (payload) => retryOnce(() => postToSheet({ action: "UPDATE_LAST_MEAL", ...payload }));
const deleteLastMeal = async (userId) => retryOnce(() => postToSheet({ action: "DELETE_LAST_MEAL", userId }));

const exactTexts = (list, text) => list.includes(String(text || "").trim());

const normalizeText = (text) => String(text || "").trim().toLowerCase();

const EATING_GUILT_PATTERN = /(วันนี้)?\s*(กินเละ|กินพัง|หลุดหนัก|กินเยอะมาก|กินเยอะไป|กินเยอะสุด|กินไปเยอะ|กินไปเยอะสุด|กินเยอะเวอร์|กินจุก|จุกมาก|กินหนัก|กินหนักมาก|กินอย่างหนัก|กินไปอย่างหนัก|กินอ้วนแน่|อ้วนแน่|วันนี้อ้วนแน่|พังแน่|แย่แล้ว.*กิน|กินจนรู้สึกผิด)/i;

const normalizeLooseText = (text) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

const isEatingGuiltText = (text) => {
  const value = normalizeLooseText(text);

  if (!value) return false;

  if (EATING_GUILT_PATTERN.test(value)) return true;

  if (/(กินไป)?เยอะ(มาก+|สุด+|เวอร์|จัด|เกิน|ไป)?|กินอย่างหนัก|กินหนักมาก|กินหนักไป|กินไปอย่างหนัก|จุกมาก|กินจุก|อิ่มจุก|แน่นมาก|หลุดยับ|หลุดแรง|กินเกิน|บวมแน่|น้ำหนักขึ้น|ขึ้น\s*\d+\s*(โล|กก|kg)/i.test(value)) {
    return true;
  }

  const hasEatingSignal = /(กิน|จุก|แน่น|อิ่ม|หลุด|เละ|พัง|น้ำหนัก)/i.test(value);
  const hasWorrySignal = /(เยอะ|หนัก|เกิน|อ้วน|พัง|แย่|ขึ้น|บวม|รู้สึกผิด)/i.test(value);

  return hasEatingSignal && hasWorrySignal;
};

const isInvalidFoodEstimate = (foodData, fallbackText = "") => {
  const kcal = safeNumber(foodData?.kcal, 0);
  const menuName = normalizeLooseText(foodData?.menuName || fallbackText);

  if (kcal > 0) return false;

  return !menuName || /^(ไม่มีข้อมูล|ไม่ทราบ|unknown|อาหาร|เมนู|กิน|กินไป|กินเยอะ|กินหนัก|จุก|วันนี้จุก|วันนี้กิน)$/i.test(menuName);
};

const shouldTreatAsEatingConcernAfterParser = ({ text, intent, foodData }) => {
  const foodText = String(intent?.foodText || text || "").trim();
  const combined = `${text || ""} ${foodText}`;

  if (isEatingGuiltText(combined)) return true;

  const kcal = safeNumber(foodData?.kcal, 0);
  const menuName = normalizeLooseText(foodData?.menuName || foodText);
  const looksLikeConcern = /(กินไปเยอะ|กินเยอะ|กินหนัก|จุก|แน่น|อิ่มจุก|หลุด|พัง|อ้วน|น้ำหนักขึ้น)/i.test(combined);
  const looksLikeNoFood = kcal <= 0 || /^(ไม่มีข้อมูล|ไม่ทราบ|unknown|กิน|กินไป|กินเยอะ|กินหนัก|จุก|วันนี้จุก)/i.test(menuName);

  return looksLikeConcern && looksLikeNoFood;
};

const buildEatingGuiltReply = (text = "") => {
  const value = normalizeLooseText(text);

  if (/(น้ำหนักขึ้น|ขึ้น\s*\d+\s*(โล|กก|kg)|อ้วนแน่|วันนี้อ้วนแน่|บวมแน่)/i.test(value)) {
    const weightReplies = [
      "อย่าเพิ่งแพนิคกับตาชั่งนะ 👀\nเลขมันแกว่งได้หลายเรื่อง 555+\nพน.คุมเกมใหม่ แปะว่าเอาอยู่",
      "ตาชั่งวันนี้ทำตัวแรงนิดนึง 555++\nแต่ยังไม่ใช่บทสรุปนะ\nวันนี้ตั้งหลักก่อน พน.เริ่มใหม่",
      "แปะขอเบรกคำว่าอ้วนก่อน 😅\nวีคนี้อาจหลุดไปหน่อย แต่ยังไม่จบเกม\nพน.เบาลงนิดเดียวก็พอ",
      "โอเค เลขขึ้นแล้วใจหายได้ เข้าใจ 555\nแต่อย่าไปซีจนด่าตัวเอง\nแปะไว้ก่อน พน.ค่อยดึงกลับ",
      "ตาชั่งแค่เสียงดังนิดนึง 👀\nไม่ได้แปลว่าแพ้แล้วนะ 555+\nพน.รีเซ็ตใหม่ ชิล ๆ"
    ];

    return weightReplies[Math.floor(Math.random() * weightReplies.length)];
  }

  if (/(จุก|แน่น|อิ่มจุก|กินอย่างหนัก|กินหนักมาก|กินไปอย่างหนัก)/i.test(value)) {
    const heavyReplies = [
      "จุกแล้วหยุดก่อน 555+\nไม่ต้องเติมให้ครบพิธีนะ\nพน.ค่อยรีเซ็ต แปะจัดให้",
      "วันนี้มื้อนี้มาเต็มจริง 😂\nพักท้องก่อน อย่าฝืนต่อ\nพน.เบาลงนิดนึงก็เอาอยู่",
      "โอเค อันนี้กินแบบจริงจัง 555++\nแต่เกมยังไม่แตก\nคืนนี้พักก่อน พน.ค่อยว่ากัน",
      "จุกระดับนี้ แปะให้พักก่อนนะ 👀\nไม่ต้องซีมาก 555\nพน.เริ่มใหม่แบบเบา ๆ",
      "มื้อนี้ขอแปะไว้ก่อน 555+\nกินหนักแล้วก็จบตรงนี้พอ\nอย่าลากต่อ เดี๋ยวพน.ค่อยเอาใหม่"
    ];

    return heavyReplies[Math.floor(Math.random() * heavyReplies.length)];
  }

  if (/(กินเละ|กินพัง|หลุดหนัก|หลุดยับ|พังแน่|กินจนรู้สึกผิด)/i.test(value)) {
    const guiltReplies = [
      "แปะเห็นละ 555+\nแต่ยังไม่ต้องประกาศล่มสลายนะ\nมื้อต่อไปคุมเกมนิดเดียวพอ",
      "ไม่พัง ๆ ใจเย็น 😅\nวันนี้หลุดได้ พน.ก็เริ่มใหม่ได้\nแปะว่าเอาอยู่",
      "วันนี้แปะไว้ก่อนนะ 👀\nมื้อเดียวไม่ใช่ทั้งชีวิต 555\nพน.ค่อยดึงกลับ ชิล ๆ",
      "โอเค วันนี้หลุดจริง 555++\nแต่ไม่ต้องด่าตัวเองแรง\nแค่หยุดเติม แล้วพน.เริ่มใหม่",
      "เกมยังไม่แตกนะ 555\nแค่วันนี้กินแรงไปหน่อย\nพน.เอาใหม่ เดี๋ยวแปะดูให้"
    ];

    return guiltReplies[Math.floor(Math.random() * guiltReplies.length)];
  }

  const replies = [
    "เอ้า ใจเย็นก่อน 555+\nกินเยอะวันนึงไม่ได้ทำให้เกมแตก\nพน.เริ่มใหม่ แปะว่าเอาอยู่",
    "กินเยอะไปหน่อยก็จริง 👀\nแต่ไม่ต้องซีขนาดนั้น 555\nมื้อต่อไปเบาลงนิดเดียวพอ",
    "โอเค วันนี้เพลินไปนิด 😂\nแปะไว้ก่อน ไม่ต้องเครียด\nพน.ค่อยรีเซ็ตใหม่",
    "ไม่ต้องตีตัวเองก่อนน้า 555++\nวันนี้จัดหนักได้ แต่ไม่ลากต่อพอ\nแปะจัดให้มื้อต่อไป",
    "กินเยอะแล้วรู้ตัว อันนี้ดีละ 👌\nอย่าไปซีเกิน 555\nพน.เริ่มใหม่แบบชิล ๆ",
    "วันนี้หลุดนิด หลุดหน่อย ชีวิตจริง 555+\nแค่ไม่ต่อยาวก็โอเค\nมื้อต่อไปแปะช่วยคุมให้"
  ];

  return replies[Math.floor(Math.random() * replies.length)];
};

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

  if (isFoodListText(text)) {
    return { intent: "log_food_text", confidence: 0.96, action: "log_food", multiplier: 0, foodText: String(text || "").trim(), kcal: null, source: "local_food_list" };
  }

  // Food-only short texts such as "ชานม", "ชาไทยหวานน้อย", "ข้าวมันไก่"
  // should be logged as food directly. Do not send them to the AI intent parser,
  // because short noun-only inputs can be misread as daily_summary/unknown.
  if (isNounOnlyFoodText(value)) {
    return { intent: "log_food_text", confidence: 0.95, action: "log_food", multiplier: 0, foodText: value, kcal: null, source: "local_food_noun" };
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
  "ทอด", "ย่าง", "นึ่ง", "ลวก", "ผัด", "มัน", "หวาน", "น้ำหวาน", "หวานเย็น", "น้ำแดง", "น้ำเขียว",
  "ชามะนาว", "มะนาว", "มะม่วง", "ส้มโอ", "ส้ม", "แตงโม", "ฝรั่ง", "แอปเปิ้ล", "กล้วย", "องุ่น", "ผลไม้",
  "ชานม", "ชาไทย", "ชาเขียว", "มัทฉะ", "กาแฟ", "โกโก้", "นม", "ลาเต้", "คาปูชิโน", "อเมริกาโน่",
  "โค้ก", "โค๊ก", "โคคา", "โคล่า", "coke", "cola", "pepsi", "เป๊ปซี่", "น้ำอัดลม", "สไปรท์", "แฟนต้า",
  "ขนม", "เค้ก", "คุกกี้", "เบเกอรี่", "โยเกิร์ต", "หมูกระทะ", "ชาบู", "พิซซ่า", "เบอร์เกอร์",
  "มาม่า", "บะหมี่", "ราเมง", "ซูชิ", "แซลมอน", "ส้มตำ", "ลาบ", "น้ำตก", "กะเพรา", "กระเพรา",
  "ข้าวมันไก่", "ข้าวหมูแดง", "ข้าวหมูกรอบ", "ข้าวผัด", "ผัดไทย", "ไอติม", "บิงซู"
];

const FOOD_STOP_WORD_PATTERN = /(ดีไหม|ดีมั้ย|ดีปะ|ดีป่ะ|ดีป่าว|ดีเปล่า|โอเคไหม|โอเคมั้ย|โอเคปะ|โอเคป่ะ|ได้ไหม|ได้มั้ย|ได้ปะ|ได้ป่ะ|ได้ป่าว|เหมาะไหม|เหมาะมั้ย|ควรไหม|ควรมั้ย|ควรปะ|ควรป่ะ|กินได้ไหม|กินได้มั้ย|กินดีไหม|กินดีมั้ย|กินดีปะ|กินดีป่ะ|อ้วนไหม|อ้วนมั้ย|หนักไหม|หนักมั้ย|พังไหม|พังมั้ย|พังปะ|พังป่ะ|อันไหนดี|อะไรดี|ไหนดี|ดีกว่า|เลือกอะไร|กี่แคล|กี่ kcal|แคลเท่าไหร่|แคลเท่าไร).*/i;

const hasFoodKeyword = (text) => FOOD_ADVICE_KEYWORDS.some((word) => normalizeText(text).includes(word));

const NOUN_ONLY_FOOD_BLOCKLIST = [
  "สรุป", "สรุปวันนี้", "แคลวันนี้", "เหลือกี่แคล", "กินไปเท่าไหร่", "กินไปเท่าไร",
  "กินไรดี", "กินอะไรดี", "หิว", "ตั้งเป้า", "เปลี่ยนเป้า", "แก้มื้อล่าสุด", "ลบมื้อล่าสุด"
];


const FOOD_LIST_SEPARATOR_PATTERN = /(\n|\/|,|,|และ|กับ)/i;

const getFoodListParts = (text) => String(text || "")
  .split(/\n|\/|,|,|และ|กับ/i)
  .map((part) => cleanFoodText(part).trim())
  .filter(Boolean);

const isFoodListText = (text) => {
  const value = String(text || "").trim();

  if (!value || value.length > 120) return false;
  if (!FOOD_LIST_SEPARATOR_PATTERN.test(value)) return false;
  if (/[?？]/.test(value)) return false;
  if (isFoodAdviceText(value) || isFoodKcalQuestionText(value) || isFoodCompareText(value) || isNextMealAfterFoodText(value)) return false;

  const parts = getFoodListParts(value);
  if (parts.length < 2) return false;

  const foodParts = parts.filter((part) => hasFoodKeyword(part));
  return foodParts.length >= 2;
};

const isNounOnlyFoodText = (text) => {
  const value = normalizeText(text);

  if (!value || value.length > 60) return false;
  if (NOUN_ONLY_FOOD_BLOCKLIST.some((word) => value.includes(word))) return false;
  if (/[?？]/.test(value)) return false;
  if (isFoodAdviceText(value) || isFoodKcalQuestionText(value) || isFoodCompareText(value) || isNextMealAfterFoodText(value)) return false;

  return hasFoodKeyword(value);
};

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

  return `${title} อันเมื่อกี้แปะตีไว้ประมาณนี้นะ 🔥

${menuName}
ประมาณ ${kcal} kcal

คร่าว ๆ:
🍚 คาร์บ ${carb} g
💪 โปรตีน ${protein} g
💧 ไขมัน ${fat} g

ถ้าปริมาณไม่ตรง พิมพ์ “แก้มื้อล่าสุดเป็น ...” ได้เลยจ้า`;
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

const buildNextMealAfterFoodReply = ({ title, text, summary }) => {
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

const buildFoodAdviceReply = ({ title, text, summary }) => {
  const food = getFoodProfile(text).name;
  const profile = getFoodProfile(food);
  const budget = getDayBudget(summary);

  if (profile.isBigSocialMeal) {
    return `${title} ได้ แต่แปะให้ผ่านแบบมีสติ 👀

${food} มันไม่ได้ผิดนะ
แต่มันชอบลากยาวโดยไม่รู้ตัว

ทริคแปะ:
- เริ่มจากโปรตีนก่อน
- น้ำจิ้มไม่ต้องจุ่มจนว่ายน้ำ
- น้ำหวานพักไว้ก่อน
- อิ่มแล้วหยุด ไม่ต้องเกรงใจเตา

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาแค่พอสนุกพอนะ 😅" : "กินได้ แต่อย่าให้กลายเป็นประชุมยาว 😄"}`;
  }

  if (profile.isFriedHeavy || profile.isSweet) {
    return `${title} ได้ แต่แปะให้ผ่านแบบมีเงื่อนไขนะ 👀

${food} ตัวนี้แคลขึ้นไว
ถ้าจะกิน เอาไซซ์พอดี ๆ ไม่ต้องอัปเพิ่ม

${budget.isOver ? "วันนี้เกินเป้าแล้วด้วย เอาแค่พอหายอยากพอนะ 😅" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal อยู่ ยังพอจัดได้`}

แปะว่าได้ แต่อย่าให้มันลากยาว 😄`;
  }

  if (profile.isSoupLight) {
    return `${title} ดีเลย อันนี้แปะเชียร์ 🍲

${food} ถือว่าโอเคนะ
มีน้ำ ๆ ไม่หนักเกิน คุมง่ายกว่าเมนูมัน ๆ

ถ้าเลือกได้:
- เพิ่มไข่ / ไก่ / ทะเล
- น้ำจิ้มแยกหรือน้อยหน่อย
- ไม่ต้องเบิ้ลเส้นเยอะ

${budget.isOver ? "วันนี้แคลเกินแล้ว เอาชามพอดี ๆ พอนะ 😅" : "แปะให้ผ่าน 😄"}`;
  }

  return `${title} กินได้จ้า แต่อยู่ที่ปริมาณนิดนึง 👀

${food} ถ้าไม่มันจัด ไม่หวานจัด ก็โอเคอยู่
ลองให้มีโปรตีน + ผักติดมาด้วยจะสวยกว่า

${budget.isOver ? "วันนี้เกินเป้าแล้ว เอาเบา ๆ พอนะ 😅" : `วันนี้ยังเหลือประมาณ ${budget.left} kcal แปะว่าเลือกดี ๆ ได้อยู่ 😄`}`;
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
    `${title} แปะอยู่นี่จ้า 😄\n\nมีอะไรให้แปะดู ส่งมาได้เลย`,
    `ว่าไง ${title} 👀\n\nจะถามเรื่องกิน หรือส่งรูปอาหารมาก็ได้ เดี๋ยวแปะดูให้`,
    `${title} เรียกแปะเหรอ 😄\n\nมีเมนูไหนลังเล ส่งมาเลย`,
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

const buildDailyRecapCard = ({ decision, summary = {}, title }) => {
  const day = decision?.day || {};
  const topMeal = decision?.problemMeal || (Array.isArray(day.meals) ? day.meals[0] : null);
  const eaten = safeNumber(day.eaten ?? summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(day.target ?? summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const over = Math.max(eaten - target, 0);
  const left = Math.max(target - eaten, 0);

  let statusText = `วันนี้ยังเหลือประมาณ ${Math.round(left)} kcal อยู่ 😄`;
  let statusColor = "#047857";

  if (eaten <= 0) {
    statusText = "วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้นะ";
    statusColor = "#6B7280";
  } else if (over > 0) {
    statusText = `เกินเป้าไปประมาณ ${Math.round(over)} kcal แล้วนะ 👀`;
    statusColor = "#DC2626";
  } else if (left <= 250) {
    statusText = `เหลือประมาณ ${Math.round(left)} kcal ใกล้เต็มแล้วนะ 😅`;
    statusColor = "#D97706";
  }

  const topMealName = String(topMeal?.menuName || topMeal?.name || "").trim();
  const topMealKcal = safeNumber(topMeal?.kcal || topMeal?.totalKcal, 0);

  return {
    statusText,
    statusColor,
    kcalText: `${Math.round(eaten)} / ${Math.round(target)} kcal`,
    kcalColor: over > 0 ? "#DC2626" : left <= 250 ? "#D97706" : "#111827",
    carbText: `${Math.round(safeNumber(day.carb ?? summary.totalCarb, 0))} g`,
    carbColor: safeNumber(day.carb ?? summary.totalCarb, 0) >= 220 ? "#DC2626" : "#111827",
    proteinText: `${Math.round(safeNumber(day.protein ?? summary.totalProtein, 0))} g`,
    proteinColor: safeNumber(day.protein ?? summary.totalProtein, 0) >= 70 ? "#047857" : "#D97706",
    fatText: `${Math.round(safeNumber(day.fat ?? summary.totalFat, 0))} g`,
    fatColor: safeNumber(day.fat ?? summary.totalFat, 0) >= 80 ? "#DC2626" : "#111827",
    mealCountText: `${Math.round(safeNumber(day.mealCount ?? summary.mealCount, 0))} มื้อ`,
    goalText: String(summary.goal || summary.healthGoal || summary.userGoal || "ยังไม่ได้ตั้งเป้าสุขภาพ").trim() || "ยังไม่ได้ตั้งเป้าสุขภาพ",
    topMealText: topMealName ? `${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ""}` : "ยังไม่มีมื้อเด่น",
  };
};

const replySmartSummary = async ({ replyToken, userId, title }) => {
  const summary = await getDailySummary(userId);
  const decision = decideDailyRecap({ summary });
  const messages = renderDailyRecapMessages({ title, decision });
  const card = buildDailyRecapCard({ decision, summary, title });
  await replyDailyRecapCardWithBubbles(replyToken, {
    title,
    card,
    bubbles: messages.slice(1),
  });
};

const replyEatingConcern = async ({ replyToken, text, reason = "local" }) => {
  console.log(`[PaeCalTiming] text:eatingGuiltLocal 0ms reason=${reason}`);
  await replyText(replyToken, buildEatingGuiltReply(text));
};

export const handleTextMessage = async (event) => {
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const text = String(event.message.text || "").trim();

  if (isEatingGuiltText(text)) {
    await replyEatingConcern({ replyToken, text, reason: "pre_session" });
    return;
  }

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

  if (text === "แปะรูปอาหาร") {
    await replyText(replyToken, `${title} ส่งรูปอาหารมาได้เลย 📸\n\nเอาให้เห็นจานชัด ๆ นะ\nเดี๋ยวแปะดูให้ว่าแคลประมาณเท่าไหร่จ้า`);
    return;
  }

  if (text === "ถามแปะ") {
    await replyText(replyToken, `ถามมาได้เลยนะ ${title} 🍚\n\nแปะถนัดเรื่องกิน แคล และโภชนาการ\nเช่น:\n\n- หิวแล้ว\n- เย็นนี้กินไรดี\n- วันนี้กินโปรตีนพอยัง\n- เมนูนี้หนักไปไหม`);
    return;
  }

  if (isPaeMentionOnlyText(text)) {
    await replyText(replyToken, getPaeMentionReply(title));
    return;
  }

  if (isExactSummaryText(text)) {
    await replySmartSummary({ replyToken, userId, title });
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

  if (isNounOnlyFoodText(text) || isFoodListText(text)) {
    console.log(`[PaeCalTiming] text:foodNounLocal 0ms text=${text}`);
    const foodText = String(text || "").trim();
    const foodData = await estimateFoodFromText(foodText);
    const kcal = safeNumber(foodData.kcal, 0);
    const carb = safeNumber(foodData.carb, 0);
    const protein = safeNumber(foodData.protein, 0);
    const fat = safeNumber(foodData.fat, 0);
    const menuName = foodData.menuName || foodText;

    if (isInvalidFoodEstimate(foodData, foodText) || shouldTreatAsEatingConcernAfterParser({ text, intent: { foodText }, foodData })) {
      await replyEatingConcern({ replyToken, text, reason: "noun_estimate_guard" });
      return;
    }

    const sheetData = await logFood({ userId, name: session.data?.name || "", kcal, carb, protein, fat, menuName });
    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const summary = { ...sheetData, todayCalories: total, totalToday: total, calorieTarget: target };
    const meal = { menuName, kcal, carb, protein, fat };
    const decision = decideFoodLog({ meal, summary });

    await syncSessionFromProfile({ userId, session, extraData: { calorieTarget: target, lastMeal: meal } });
    await replyTexts(replyToken, renderFoodLogMessages({ title, meal, summary, decision }));
    return;
  }

  if (isPronounKcalQuestionText(text)) {
    const meal = await getLatestMealForFollowUp({ userId, session });
    await replyText(replyToken, buildPronounKcalReply({ title, meal }));
    return;
  }

  if (isLikelyFoodLogText(text)) {
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

    if (isInvalidFoodEstimate(foodData, foodText) || shouldTreatAsEatingConcernAfterParser({ text, intent: localIntent, foodData })) {
      await replyEatingConcern({ replyToken, text, reason: "likely_food_guard" });
      return;
    }

    const sheetData = await logFood({ userId, name: session.data?.name || "", kcal, carb, protein, fat, menuName });
    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const summary = { ...sheetData, todayCalories: total, totalToday: total, calorieTarget: target };
    const meal = { menuName, kcal, carb, protein, fat };
    const decision = decideFoodLog({ meal, summary });

    await syncSessionFromProfile({ userId, session, extraData: { calorieTarget: target, lastMeal: meal } });
    await replyTexts(replyToken, renderFoodLogMessages({ title, meal, summary, decision }));
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
      await replyText(replyToken, buildNextMealAfterFoodReply({ title, text, summary }));
      return;
    }

    await replyText(replyToken, buildFoodAdviceReply({ title, text, summary }));
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

    if (isInvalidFoodEstimate(foodData, foodText) || shouldTreatAsEatingConcernAfterParser({ text, intent: intent, foodData })) {
      await replyEatingConcern({ replyToken, text, reason: "intent_log_guard" });
      return;
    }

    const sheetData = await logFood({ userId, name: session.data?.name || "", kcal, carb, protein, fat, menuName });
    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
    const summary = { ...sheetData, todayCalories: total, totalToday: total, calorieTarget: target };
    const meal = { menuName, kcal, carb, protein, fat };
    const decision = decideFoodLog({ meal, summary });

    await syncSessionFromProfile({ userId, session, extraData: { calorieTarget: target, lastMeal: meal } });
    await replyTexts(replyToken, renderFoodLogMessages({ title, meal, summary, decision }));
    return;
  }

  if (intent.intent === "daily_summary") {
    await replySmartSummary({ replyToken, userId, title });
    return;
  }

  if (intent.intent === "meal_suggestion") {
    const summary = await getDailySummary(userId);
    const decision = decideMealSuggestion({ summary, text });
    await replyText(
      replyToken,
      renderMealSuggestionReply({ title, decision }) || getMealSuggestionText({ title, summary })
    );
    return;
  }

  if (intent.intent === "health_goal") {
    await updateSession({ userId, step: "ASK_GOAL_UPDATE", sessionData: session.data || {} });
    await replyText(replyToken, getGoalHelpText(title));
    return;
  }

  if (intent.intent === "off_topic") {
    await replyText(replyToken, "เรื่องนี้แปะไม่ถนัดน้า 😅\n\nแปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า\nส่งรูปอาหารมาได้เลย 📸");
    return;
  }

  await replyText(replyToken, `${title} แปะยังจับใจความไม่ค่อยได้น้า 😅\n\nลองส่งรูปอาหารมา\nหรือพิมพ์แบบนี้ได้เลย:\n\n- สรุปวันนี้\n- หิวแล้ว\n- เย็นนี้กินอะไรดี\n- กินเพิ่มอีกจาน\n- กินครึ่งเดียว`);
};
