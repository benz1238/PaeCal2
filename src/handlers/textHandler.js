import { replyText, replyTexts } from "../services/line.js";
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

  if (hasAnyText(value, ["กินไรดี", "กินอะไรดี", "หาไรกินดี", "เอาไรกินดี", "แนะนำเมนู", "เมนูสุขภาพ", "หิว"])) {
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

  if (/^(กิน|เมื่อกี้กิน|วันนี้กิน|มื้อเช้ากิน|มื้อเที่ยงกิน|มื้อเย็นกิน)\s+/.test(value)) {
    return { intent: "log_food_text", confidence: 0.88, action: "log_food", multiplier: 0, foodText: text.replace(/^(กิน|เมื่อกี้กิน|วันนี้กิน|มื้อเช้ากิน|มื้อเที่ยงกิน|มื้อเย็นกิน)\s+/i, "").trim(), kcal: null, source: "local" };
  }

  return null;
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

const replySmartSummary = async ({ replyToken, userId, title }) => {
  const summary = await getDailySummary(userId);
  const decision = decideDailyRecap({ summary });
  await replyTexts(replyToken, renderDailyRecapMessages({ title, decision }));
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

  if (text === "แปะรูปอาหาร") {
    await replyText(replyToken, `${title} ส่งรูปอาหารมาได้เลย 📸\n\nเอาให้เห็นจานชัด ๆ นะ\nเดี๋ยวแปะดูให้ว่าแคลประมาณเท่าไหร่จ้า`);
    return;
  }

  if (text === "ถามแปะ") {
    await replyText(replyToken, `ถามมาได้เลยนะ ${title} 🍚\n\nแปะถนัดเรื่องกิน แคล และโภชนาการ\nเช่น:\n\n- หิวแล้ว\n- เย็นนี้กินไรดี\n- วันนี้กินโปรตีนพอยัง\n- เมนูนี้หนักไปไหม`);
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
