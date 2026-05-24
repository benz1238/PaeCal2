import { replyText } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import {
  estimateFoodFromText,
  generateNutritionAdvice,
  generateSmartDailySummary,
  parseUserIntent,
} from "../services/openai.js";
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
  getFoodLogText,
  getMealSuggestionText,
  getSmartMealAdvice,
  getSummaryText,
} from "../utils/advice.js";

const OFF_TOPIC_REPLY =
  "เรื่องนี้แปะไม่ถนัดน้า 😅 แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า ส่งรูปอาหารมาได้เลย 📸";

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

const isRichMenuPhotoPrompt = (text) => {
  return ["แปะรูปอาหาร", "ส่งรูปอาหาร", "📸 แปะรูปอาหาร"].includes(text);
};

const isRichMenuEditPrompt = (text) => {
  return ["แก้มื้อล่าสุด", "แก้เมนูล่าสุด", "🧾 แก้มื้อล่าสุด"].includes(text);
};

const isNewGoalRequest = (text) => {
  return /^(ตั้งเป้าสุขภาพ|ตั้งเป้าใหม่|เปลี่ยนเป้า|แก้เป้า|เปลี่ยนเป้าหมาย|🎯 ตั้งเป้าสุขภาพ)$/i.test(
    text
  );
};

const getDirectGoal = (text) => {
  const trimmed = String(text || "").trim();
  const goalPattern = /^(อยากลดไขมัน|ลดไขมัน|ลดน้ำหนัก|อยากเพิ่มกล้าม|เพิ่มกล้าม|คุมแคล|คุมน้ำหนัก|กินสุขภาพดีขึ้น|อยากกินดีขึ้น|อยากลีน|เพิ่มน้ำหนักแบบสุขภาพดี)(.*)$/i;
  const match = trimmed.match(goalPattern);
  return match ? trimmed : "";
};

const isDeleteLastMealText = (text) => {
  return /^(ลบมื้อล่าสุด|ไม่เอามื้อนี้|ส่งผิด|ลบอันเมื่อกี้|ลบเมนูล่าสุด)$/i.test(text);
};

const parseUpdateLastMealText = (text) => {
  const kcalOnly = text.match(/^แก้(?:เป็น|แคล)?\s*(\d+)\s*(?:kcal|แคล|กิโลแคล)?$/i);
  if (kcalOnly) {
    return {
      type: "kcal_only",
      kcal: Number(kcalOnly[1]),
      menuText: "",
    };
  }

  const menuMatch = text.match(/^(?:แก้(?:มื้อล่าสุด|เมนูล่าสุด)?(?:เป็น)?|เปลี่ยน(?:มื้อล่าสุด|เมนูล่าสุด)?(?:เป็น)?)\s*(.+)$/i);
  if (menuMatch) {
    const menuText = menuMatch[1].trim();
    if (menuText) {
      return {
        type: "menu",
        menuText,
      };
    }
  }

  const notThisMatch = text.match(/^ไม่ใช่(.+?)เป็น(.+)$/i);
  if (notThisMatch) {
    return {
      type: "menu",
      menuText: notThisMatch[2].trim(),
    };
  }

  return null;
};

const saveGoalAndReply = async ({ userId, replyToken, session, goal }) => {
  const profile = await getProfile(userId);
  const name = session.data?.name || profile.name || "";
  const stats = session.data?.stats || profile.stats || "";
  const title = buildTitleFromProfile({
    name,
    stats,
    fallbackTitle: session.data?.title || profile.title || "",
  });
  const calorieTarget =
    session.data?.calorieTarget || profile.calorieTarget || DEFAULT_CALORIE_TARGET;

  await saveProfile({
    userId,
    name,
    title,
    stats,
    goal,
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
      goal,
      calorieTarget,
    },
  });

  await replyText(
    replyToken,
    `จัดให้แล้ว ${title} 🎯\nแปะอัปเดตเป้าหมายเป็น “${goal}” ให้เรียบร้อยจ้า\n\nต่อไปแปะจะช่วยดูมื้ออาหารให้เข้ากับเป้านี้มากขึ้นนะ`
  );
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

  const nameMatch = text.match(
    /^(?:ฉันชื่อ|ผมชื่อ|ชื่อ|เรียกฉันว่า|เรียกผมว่า)\s*(.+)$/i
  );

  if (nameMatch) {
    const newName = nameMatch[1].trim();
    const profile = await getProfile(userId);
    const stats = session.data?.stats || profile.stats || "";
    const title = buildTitleFromProfile({
      name: newName,
      stats,
      fallbackTitle: "",
    });
    const calorieTarget =
      session.data?.calorieTarget || profile.calorieTarget || DEFAULT_CALORIE_TARGET;

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

  if (session.step === "ASK_GOAL") {
    const profile = await getProfile(userId);
    const name = session.data?.name || profile.name || "";
    const stats = session.data?.stats || profile.stats || "";
    const title =
      session.data?.title ||
      profile.title ||
      buildTitleFromProfile({ name, stats });
    const tdee = calculateTDEE(stats);

    await saveProfile({
      userId,
      name,
      title,
      stats,
      goal: text,
      calorieTarget: tdee,
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
        calorieTarget: tdee,
      },
    });

    await replyText(
      replyToken,
      `บันทึกเรียบร้อยจ้า ${title}! 🏆\n🔥 TDEE: ~${tdee} kcal/วัน\n🎯 เป้าหมาย: ${text}\n\nส่งรูปอาหารมาให้อั๊วแปะแคลได้เลย! 📸`
    );
    return;
  }

  if (session.step === "ASK_NEW_GOAL") {
    await saveGoalAndReply({ userId, replyToken, session, goal: text });
    return;
  }

  const title = await getDisplayTitle({ userId, session });

  if (isRichMenuPhotoPrompt(text)) {
    await replyText(
      replyToken,
      `${title} ส่งรูปอาหารมาได้เลยจ้า 📸\nแปะจะช่วยดูแคล โปรตีน คาร์บ ไขมัน แล้วบันทึกให้ทันที`
    );
    return;
  }

  if (isRichMenuEditPrompt(text)) {
    await replyText(
      replyToken,
      `${title} อยากแก้มื้อล่าสุด พิมพ์แบบนี้ได้เลยจ้า 🧾\n\n- แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n- แก้เป็น 650 kcal\n- ลบมื้อล่าสุด\n- ส่งผิด`
    );
    return;
  }

  if (isNewGoalRequest(text)) {
    await updateSession({
      userId,
      step: "ASK_NEW_GOAL",
      sessionData: session.data || {},
    });

    await replyText(
      replyToken,
      `${title} อยากตั้งเป้าใหม่ใช่ไหมจ๊ะ 🎯\nพิมพ์เป้าหมายมาได้เลย เช่น\n- ลดไขมัน\n- เพิ่มกล้าม\n- คุมน้ำหนัก\n- กินสุขภาพดีขึ้น`
    );
    return;
  }

  const directGoal = getDirectGoal(text);
  if (directGoal) {
    await saveGoalAndReply({ userId, replyToken, session, goal: directGoal });
    return;
  }

  if (text === "ถามแปะ") {
    await replyText(
      replyToken,
      `ถามมาได้เลยนะลูก แปะช่วยดูเรื่องกินให้ 🍚\n\nเช่น\n- หิวแล้ว\n- เย็นนี้กินไรดี\n- เมนูนี้กี่แคล\n- วันนี้กินโปรตีนพอยัง`
    );
    return;
  }

  if (["สรุปวันนี้", "วันนี้กินไปเท่าไหร่", "วันนี้กินไปเท่าไร"].includes(text)) {
    const summary = await getDailySummary(userId);
    const smart = await generateSmartDailySummary({ summary, title });
    await replyText(replyToken, smart.reply || getSummaryText({ title, summary }));
    return;
  }

  if (session.step !== "READY") {
    await replyText(replyToken, "แปะขอรู้จักลื้อก่อนน้า พิมพ์ชื่อมาก่อนเลยจ้า 😊");
    return;
  }

  if (isDeleteLastMealText(text)) {
    const result = await postToSheet({ action: "DELETE_LAST_MEAL", userId });

    if (result.status === "not_found") {
      await replyText(replyToken, `${title} ยังไม่มีมื้อล่าสุดให้ลบน้า 😅`);
      return;
    }

    await updateSession({
      userId,
      step: "READY",
      sessionData: {
        ...session.data,
        lastMeal: null,
      },
    });

    await replyText(
      replyToken,
      `ลบมื้อล่าสุดให้แล้วจ้า ${title} 🧾\n\n🔥 กินไปแล้วรวม: ${result.todayCalories || result.totalToday || 0} / ${result.calorieTarget || DEFAULT_CALORIE_TARGET} kcal\n📊 สถานะวันนี้:\n(${result.progressBar || buildProgressBar(result.todayCalories || result.totalToday || 0, result.calorieTarget || DEFAULT_CALORIE_TARGET)})`
    );
    return;
  }

  const updateMeal = parseUpdateLastMealText(text);
  if (updateMeal) {
    let payload = { action: "UPDATE_LAST_MEAL", userId };

    if (updateMeal.type === "kcal_only") {
      payload.kcal = updateMeal.kcal;
    } else {
      const foodData = await estimateFoodFromText(updateMeal.menuText);
      payload = {
        ...payload,
        menuName: foodData.menuName || updateMeal.menuText,
        kcal: safeNumber(foodData.kcal, 0),
        carb: safeNumber(foodData.carb, 0),
        protein: safeNumber(foodData.protein, 0),
        fat: safeNumber(foodData.fat, 0),
      };
    }

    const result = await postToSheet(payload);

    if (result.status === "not_found") {
      await replyText(replyToken, `${title} ยังไม่มีมื้อล่าสุดให้แก้น้า 😅`);
      return;
    }

    const updatedMeal = result.updatedMeal || {};
    await updateSession({
      userId,
      step: "READY",
      sessionData: {
        ...session.data,
        lastMeal: updatedMeal,
      },
    });

    await replyText(
      replyToken,
      `โอเค ${title} แปะแก้มื้อล่าสุดให้แล้วจ้า 🧾\n\n🔍 ${updatedMeal.menuName || "อาหาร"}\nประมาณ ${updatedMeal.kcal || 0} kcal\n\n🔥 กินไปแล้วรวม: ${result.todayCalories || result.totalToday || 0} / ${result.calorieTarget || DEFAULT_CALORIE_TARGET} kcal\n📊 สถานะวันนี้:\n(${result.progressBar || buildProgressBar(result.todayCalories || result.totalToday || 0, result.calorieTarget || DEFAULT_CALORIE_TARGET)})`
    );
    return;
  }

  const intent = await parseUserIntent({ text, session });

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
    const summary = await getDailySummary(userId);
    const smart = await generateSmartDailySummary({ summary, title });
    await replyText(replyToken, smart.reply || getSummaryText({ title, summary }));
    return;
  }

  if (intent.intent === "meal_suggestion") {
    const summary = await getDailySummary(userId);
    const advice = await generateNutritionAdvice({ text, summary, title });

    if (advice.inScope === false) {
      await replyText(replyToken, OFF_TOPIC_REPLY);
      return;
    }

    await replyText(replyToken, advice.reply || getMealSuggestionText({ title, summary }));
    return;
  }

  if (intent.intent === "health_goal") {
    await updateSession({
      userId,
      step: "ASK_NEW_GOAL",
      sessionData: session.data || {},
    });

    await replyText(
      replyToken,
      `${title} อยากปรับเป้าสุขภาพใช่ไหมจ๊ะ 🎯\nพิมพ์เป้าหมายมาได้เลย เช่น ลดไขมัน / เพิ่มกล้าม / คุมน้ำหนัก / กินสุขภาพดีขึ้น`
    );
    return;
  }

  if (intent.intent === "off_topic") {
    await replyText(replyToken, OFF_TOPIC_REPLY);
    return;
  }

  await replyText(
    replyToken,
    `${title} แปะยังจับใจความไม่ค่อยได้น้า 😅\n\nลองส่งรูปอาหารมา หรือพิมพ์แบบนี้ได้เลย:\n- สรุปวันนี้\n- หิวแล้ว\n- เย็นนี้กินอะไรดี\n- กินเพิ่มอีกจาน\n- กินครึ่งเดียว`
  );
};
