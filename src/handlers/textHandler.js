import { replyText } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import {
  estimateFoodFromText,
  parseUserIntent,
  generateNutritionAdvice,
  generateSmartDailySummary,
} from "../services/openai.js";
import { calculateTDEE, DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import {
  buildTitleFromProfile,
  getDisplayTitle,
  getProfile,
  getTitle,
  syncSessionFromProfile,
} from "../utils/profile.js";
import {
  buildProgressBar,
  getFoodLogText,
  getMealSuggestionText,
  getSmartMealAdvice,
  getSummaryText,
} from "../utils/advice.js";

const getSession = async (userId) => {
  return await postToSheet({ action: "GET_SESSION", userId });
};

const saveProfile = async (payload) => {
  return await postToSheet({ action: "SAVE_PROFILE", ...payload });
};

const updateSession = async (payload) => {
  return await postToSheet({ action: "UPDATE_SESSION", ...payload });
};

const logFood = async (payload) => {
  return await postToSheet({ action: "LOG_FOOD", ...payload });
};

const getDailySummary = async (userId) => {
  return await postToSheet({ action: "GET_DAILY_SUMMARY", userId });
};

const getLastMeal = async (userId) => {
  return await postToSheet({ action: "GET_LAST_MEAL", userId });
};

const updateLastMeal = async (payload) => {
  return await postToSheet({ action: "UPDATE_LAST_MEAL", ...payload });
};

const deleteLastMeal = async (userId) => {
  return await postToSheet({ action: "DELETE_LAST_MEAL", userId });
};

const isExactSummaryText = (text) => {
  return [
    "สรุปวันนี้",
    "วันนี้กินไปเท่าไหร่",
    "วันนี้กินไปเท่าไร",
    "แคลวันนี้",
    "ดูสรุปวันนี้",
  ].includes(text);
};

const isEditMealHelpText = (text) => {
  return [
    "แก้มื้อล่าสุด",
    "แก้ไขมื้อล่าสุด",
    "แก้มื้อเมื่อกี้",
    "แก้ไขมื้อเมื่อกี้",
    "แก้เมนูล่าสุด",
    "แก้ไขเมนูล่าสุด",
  ].includes(text);
};

const isDeleteMealText = (text) => {
  return [
    "ลบมื้อล่าสุด",
    "ลบอันเมื่อกี้",
    "ลบมื้อเมื่อกี้",
    "ไม่เอามื้อนี้",
    "ส่งผิด",
  ].includes(text);
};

const isStartGoalUpdateText = (text) => {
  return [
    "ตั้งเป้าสุขภาพ",
    "ตั้งเป้าใหม่",
    "เปลี่ยนเป้าหมาย",
    "เปลี่ยนเป้าสุขภาพ",
    "แก้เป้าหมาย",
  ].includes(text);
};

const getEditHelpText = (title) => {
  return `${title} อยากแก้มื้อล่าสุดใช่ไหมจ๊ะ 🧾

พิมพ์แบบนี้ได้เลยน้า:

- แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว
- ไม่ใช่ข้าวผัด เป็นข้าวหมูกระเทียม
- แก้เป็น 650 kcal
- ลบมื้อล่าสุด

แปะจะไม่เดาเองนะ ต้องให้${title}บอกก่อนว่าจะแก้อะไรจ้า`;
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
    if (match?.[1]) {
      return match[1].trim();
    }
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

📊 สถานะวันนี้:
(${progress})
🔥 กินไปแล้วรวม: ${total} / ${target} kcal จ้า!`;
};

const formatDeletedMealReply = ({ title, deletedMeal, summary }) => {
  const total = summary.todayCalories ?? summary.totalToday ?? 0;
  const target = summary.calorieTarget || DEFAULT_CALORIE_TARGET;
  const progress = buildProgressBar(total, target);

  return `โอเค ${title} แปะลบมื้อล่าสุดให้แล้วจ้า 🗑️

ลบ: ${deletedMeal?.menuName || "มื้อล่าสุด"}

📊 สถานะวันนี้:
(${progress})
🔥 กินไปแล้วรวม: ${total} / ${target} kcal จ้า!`;
};

const replySmartSummary = async ({ replyToken, userId, title }) => {
  const summary = await getDailySummary(userId);
  const smart = await generateSmartDailySummary({ summary, title });
  await replyText(replyToken, smart?.reply || getSummaryText({ title, summary }));
};

export const handleTextMessage = async (event) => {
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const text = String(event.message.text || "").trim();
  const session = await getSession(userId);

  if (text === "__FOLLOW__") {
    await updateSession({ userId, step: "ASK_NAME", sessionData: {} });
    await replyText(replyToken, "หนีห่าว! แปะแคลพร้อมดูแลสุขภาพแล้ว! ลื้อชื่ออะไรจ๊ะ?");
    return;
  }

  const nameMatch = text.match(/^(?:ฉันชื่อ|ผมชื่อ|ชื่อ|เรียกฉันว่า|เรียกผมว่า)\s*(.+)$/i);

  if (nameMatch) {
    const newName = nameMatch[1].trim();
    const profile = await getProfile(userId);
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

    const message =
      session.step === "ASK_NAME"
        ? `จำได้แล้วจ้า ต่อไปแปะจะเรียก ${title} นะ 😊\n\nขอสเปกหน่อย (เพศ, อายุ, สูง, น้ำหนัก)\n💡 เช่น: ชาย 31 165 61`
        : `จำได้แล้วจ้า ต่อไปแปะจะเรียก ${title} นะ 😊`;

    await replyText(replyToken, message);
    return;
  }

  if (session.step === "ASK_NAME") {
    const name = text;

    await saveProfile({
      userId,
      name,
      title: "",
      stats: "",
      goal: "",
      calorieTarget: DEFAULT_CALORIE_TARGET,
    });

    await updateSession({
      userId,
      step: "ASK_STATS",
      sessionData: { name },
    });

    await replyText(
      replyToken,
      "ยินดีที่ได้รู้จักครับ! ขอสเปกหน่อย (เพศ, อายุ, สูง, น้ำหนัก)\n💡 เช่น: ชาย 31 165 61"
    );
    return;
  }

  if (session.step === "ASK_STATS") {
    const profile = await getProfile(userId);
    const parts = text.split(/\s+/);
    const name = session.data?.name || profile.name || "";
    const title = getTitle(parts[0], parts[1], name);
    const tdee = calculateTDEE(text);

    await saveProfile({
      userId,
      name,
      title,
      stats: text,
      goal: "",
      calorieTarget: tdee,
    });

    await updateSession({
      userId,
      step: "ASK_GOAL",
      sessionData: {
        ...session.data,
        name,
        stats: text,
        title,
        calorieTarget: tdee,
      },
    });

    await replyText(
      replyToken,
      `โอเคจ้า ${title}! ด่านสุดท้าย เป้าหมาย/สไตล์การกินเป็นไงบ้างจ๊ะ? (ไม่มีพิมพ์ "ไม่มี")`
    );
    return;
  }

  if (session.step === "ASK_GOAL" || session.step === "ASK_GOAL_UPDATE") {
    const profile = await getProfile(userId);
    const name = session.data?.name || profile.name || "";
    const stats = session.data?.stats || profile.stats || "";
    const title =
      session.data?.title ||
      profile.title ||
      buildTitleFromProfile({ name, stats, fallbackTitle: "" });

    const calorieTarget = session.data?.calorieTarget || profile.calorieTarget || calculateTDEE(stats);

    await saveProfile({
      userId,
      name,
      title,
      stats,
      goal: text,
      calorieTarget,
    });

    await updateSession({
      userId,
      step: "READY",
      sessionData: {
        ...session.data,
        name,
        stats,
        title,
        goal: text,
        calorieTarget,
      },
    });

    await replyText(
      replyToken,
      `บันทึกเป้าหมายเรียบร้อยจ้า ${title}! 🎯\n\nเป้าหมาย: ${text}\n🔥 เป้าต่อวันประมาณ: ${calorieTarget} kcal\n\nส่งรูปอาหารมาให้อั๊วแปะแคลได้เลย! 📸`
    );
    return;
  }

  const title = await getDisplayTitle({ userId, session });

  if (text === "ถามแปะ") {
    await replyText(
      replyToken,
      `ถามมาได้เลยนะลูก แปะช่วยดูเรื่องกินให้ 🍚\n\nเช่น\n- หิวแล้ว\n- เย็นนี้กินไรดี\n- เมนูนี้กี่แคล\n- วันนี้กินโปรตีนพอยัง`
    );
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
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅 ส่งรูปอาหารก่อนแล้วค่อยลบได้จ้า`);
      return;
    }

    await syncSessionFromProfile({
      userId,
      session,
      extraData: { lastMeal: null },
    });

    await replyText(
      replyToken,
      formatDeletedMealReply({
        title,
        deletedMeal: deleted.deletedMeal,
        summary: deleted,
      })
    );
    return;
  }

  if (isStartGoalUpdateText(text)) {
    await updateSession({
      userId,
      step: "ASK_GOAL_UPDATE",
      sessionData: session.data || {},
    });

    await replyText(replyToken, getGoalHelpText(title));
    return;
  }

  if (session.step !== "READY") {
    await replyText(replyToken, "แปะขอรู้จักลื้อก่อนน้า พิมพ์ชื่อมาก่อนเลยจ้า 😊");
    return;
  }

  const intent = await parseUserIntent({ text, session });

  if (intent.intent === "meal_edit_help") {
    await replyText(replyToken, getEditHelpText(title));
    return;
  }

  if (intent.intent === "delete_last_meal") {
    const deleted = await deleteLastMeal(userId);

    if (deleted.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅 ส่งรูปอาหารก่อนแล้วค่อยลบได้จ้า`);
      return;
    }

    await syncSessionFromProfile({
      userId,
      session,
      extraData: { lastMeal: null },
    });

    await replyText(
      replyToken,
      formatDeletedMealReply({
        title,
        deletedMeal: deleted.deletedMeal,
        summary: deleted,
      })
    );
    return;
  }

  if (intent.intent === "edit_last_meal") {
    const latest = await getLastMeal(userId);

    if (latest.status === "not_found") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้แก้น้า 😅 ส่งรูปอาหารก่อน แล้วค่อยแก้ได้จ้า`);
      return;
    }

    const explicitMenu = String(intent.foodText || "").trim() || extractMenuFromEditText(text);
    const explicitKcal = intent.kcal !== null && intent.kcal !== undefined ? Number(intent.kcal) : extractKcalFromText(text);

    if (!explicitMenu && !explicitKcal) {
      await replyText(replyToken, getEditHelpText(title));
      return;
    }

    let updatedPayload = {
      userId,
    };

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

    await replyText(
      replyToken,
      formatUpdatedMealReply({
        title,
        oldMeal: updated.oldMeal,
        updatedMeal: updated.updatedMeal,
        summary: updated,
      })
    );
    return;
  }

  if (intent.intent === "adjust_last_meal") {
    if (!session.data?.lastMeal) {
      await replyText(
        replyToken,
        `${title} แปะยังไม่มีเมนูล่าสุดให้ปรับน้า 😅\nส่งรูปอาหารมาก่อน หรือบอกชื่อเมนูมาก็ได้จ้า`
      );
      return;
    }

    const lastMeal = session.data.lastMeal;
    const multiplier = safeNumber(intent.multiplier, 0);

    if (multiplier === 0) {
      await replyText(
        replyToken,
        `${title} แปะยังไม่ชัวร์ว่าต้องเพิ่มหรือลดเท่าไหร่จ้า 😅\nลองบอกแปะอีกที เช่น “เพิ่มอีก 1 จาน” หรือ “กินครึ่งเดียว”`
      );
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

    await replyText(
      replyToken,
      `โอเค ${title} แปะปรับจากเมนูล่าสุดให้แล้วนะ 😄\n\n🍳 ${lastMeal.menuName}\n${kcal >= 0 ? "➕" : "➖"} ${signText}ประมาณ ${Math.abs(kcal)} kcal\n\n📊 สถานะวันนี้:\n(${progress})\n🔥 กินไปแล้วรวม: ${total} / ${target} kcal จ้า!\n\n${getSmartMealAdvice({
        title,
        kcal,
        carb,
        protein,
        fat,
        total,
        calorieTarget: target,
      })}`
    );
    return;
  }

  if (intent.intent === "log_food_text") {
    const foodData = await estimateFoodFromText(text);
    const kcal = safeNumber(foodData.kcal, 0);
    const carb = safeNumber(foodData.carb, 0);
    const protein = safeNumber(foodData.protein, 0);
    const fat = safeNumber(foodData.fat, 0);
    const menuName = foodData.menuName || text;

    const sheetData = await logFood({
      userId,
      name: session.data?.name || "",
      kcal,
      carb,
      protein,
      fat,
      menuName,
    });

    const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
    const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;

    await syncSessionFromProfile({
      userId,
      session,
      extraData: {
        calorieTarget: target,
        lastMeal: { menuName, kcal, carb, protein, fat },
      },
    });

    await replyText(
      replyToken,
      `${getFoodLogText({
        menuName,
        kcal,
        carb,
        protein,
        fat,
        total,
        calorieTarget: target,
      })}\n\n${getSmartMealAdvice({
        title,
        kcal,
        carb,
        protein,
        fat,
        total,
        calorieTarget: target,
      })}`
    );
    return;
  }

  if (intent.intent === "daily_summary") {
    await replySmartSummary({ replyToken, userId, title });
    return;
  }

  if (intent.intent === "meal_suggestion") {
    const summary = await getDailySummary(userId);
    const advice = await generateNutritionAdvice({ text, summary, title });

    if (advice?.inScope === false) {
      await replyText(
        replyToken,
        "เรื่องนี้แปะไม่ถนัดน้า 😅 แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า ส่งรูปอาหารมาได้เลย 📸"
      );
      return;
    }

    await replyText(replyToken, advice?.reply || getMealSuggestionText({ title, summary }));
    return;
  }

  if (intent.intent === "health_goal") {
    await updateSession({
      userId,
      step: "ASK_GOAL_UPDATE",
      sessionData: session.data || {},
    });

    await replyText(replyToken, getGoalHelpText(title));
    return;
  }

  if (intent.intent === "off_topic") {
    await replyText(
      replyToken,
      "เรื่องนี้แปะไม่ถนัดน้า 😅 แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า ส่งรูปอาหารมาได้เลย 📸"
    );
    return;
  }

  await replyText(
    replyToken,
    `${title} แปะยังจับใจความไม่ค่อยได้น้า 😅\n\nลองส่งรูปอาหารมา หรือพิมพ์แบบนี้ได้เลย:\n- สรุปวันนี้\n- หิวแล้ว\n- เย็นนี้กินอะไรดี\n- กินเพิ่มอีกจาน\n- กินครึ่งเดียว`
  );
};
