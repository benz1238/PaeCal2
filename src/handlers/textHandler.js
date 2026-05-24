import { replyText } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import {
  estimateCorrectedFood,
  estimateFoodFromText,
  extractFoodCorrection,
  generateNutritionAdvice,
  generateSmartDailySummary,
  parseUserIntent,
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
      `บันทึกเรียบร้อยจ้า ${title}! 🏆
🔥 TDEE: ~${tdee} kcal/วัน
🎯 เป้าหมาย: ${text}

ส่งรูปอาหารมาให้อั๊วแปะแคลได้เลย! 📸`
    );
    return;
  }

  if (text === "ถามแปะ") {
    await replyText(
      replyToken,
      `ถามมาได้เลยนะลูก แปะช่วยดูเรื่องกินให้ 🍚

เช่น
- หิวแล้ว
- เย็นนี้กินไรดี
- เมนูนี้กี่แคล
- วันนี้กินโปรตีนพอยัง`
    );
    return;
  }

  const title = await getDisplayTitle({ userId, session });

  if (["สรุปวันนี้", "วันนี้กินไปเท่าไหร่", "วันนี้กินไปเท่าไร"].includes(text)) {
    const summary = await getDailySummary(userId);
    const smart = await generateSmartDailySummary({ summary, title });
    await replyText(
      replyToken,
      `${getSummaryText({ title, summary })}\n\n${smart.reply || ""}`.trim()
    );
    return;
  }

  if (session.step !== "READY") {
    await replyText(replyToken, "แปะขอรู้จักลื้อก่อนน้า พิมพ์ชื่อมาก่อนเลยจ้า 😊");
    return;
  }

  const intent = await parseUserIntent({ text, session });

  if (intent.intent === "delete_last_meal") {
    const result = await deleteLastMeal(userId);

    if (result.status !== "success") {
      await replyText(replyToken, `${title} แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅 ส่งรูปอาหารหรือบอกเมนูก่อนก็ได้จ้า`);
      return;
    }

    await syncSessionFromProfile({
      userId,
      session,
      extraData: { lastMeal: null },
    });

    await replyText(
      replyToken,
      `ลบมื้อล่าสุดให้แล้วนะ ${title} 🧾

🗑️ ${result.deletedMeal?.menuName || "มื้อล่าสุด"}
🔥 ยอดวันนี้ตอนนี้: ${result.totalToday || 0} / ${result.calorieTarget || DEFAULT_CALORIE_TARGET} kcal จ้า`
    );
    return;
  }

  if (intent.intent === "correct_last_meal") {
    const latest = await getLastMeal(userId);
    const lastMeal = latest.meal || session.data?.lastMeal;

    if (!lastMeal) {
      await replyText(replyToken, `${title} แปะยังไม่มีมื้อล่าสุดให้แก้น้า 😅 ส่งรูปอาหารหรือบอกเมนูก่อนก็ได้จ้า`);
      return;
    }

    const correction = await extractFoodCorrection({ text, lastMeal });
    let corrected = correction;

    if (!corrected.menuName || corrected.kcal === null || corrected.kcal === undefined) {
      corrected = await estimateCorrectedFood({ text, lastMeal });
    }

    const menuName = corrected.menuName || lastMeal.menuName;
    const kcal = safeNumber(corrected.kcal, lastMeal.kcal || 0);
    const carb = safeNumber(corrected.carb, lastMeal.carb || 0);
    const protein = safeNumber(corrected.protein, lastMeal.protein || 0);
    const fat = safeNumber(corrected.fat, lastMeal.fat || 0);

    const result = await updateLastMeal({
      userId,
      menuName,
      kcal,
      carb,
      protein,
      fat,
    });

    if (result.status !== "success") {
      await replyText(replyToken, `${title} แปะลองแก้แล้วแต่ยังไม่เจอมื้อล่าสุดน้า 😅`);
      return;
    }

    const total = result.todayCalories ?? result.totalToday ?? kcal;
    const target = result.calorieTarget || DEFAULT_CALORIE_TARGET;

    await syncSessionFromProfile({
      userId,
      session,
      extraData: {
        lastMeal: { menuName, kcal, carb, protein, fat },
        calorieTarget: target,
      },
    });

    await replyText(
      replyToken,
      `โอเค ${title} แปะแก้มื้อล่าสุดให้แล้วจ้า 🧾

จากเดิม: ${lastMeal.menuName || "มื้อล่าสุด"}
แก้เป็น: ${menuName}

${getFoodLogText({
  menuName,
  kcal,
  carb,
  protein,
  fat,
  total,
  calorieTarget: target,
})}

${getSmartMealAdvice({ title, kcal, carb, protein, fat, total, calorieTarget: target })}`
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
      `โอเค ${title} แปะปรับจากเมนูล่าสุดให้แล้วนะ 😄

🍳 ${lastMeal.menuName}
${kcal >= 0 ? "➕" : "➖"} ${signText}ประมาณ ${Math.abs(kcal)} kcal

📊 สถานะวันนี้:
(${progress})
🔥 กินไปแล้วรวม: ${total} / ${target} kcal จ้า!

${getSmartMealAdvice({
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
      })}

${getSmartMealAdvice({
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
    await replyText(
      replyToken,
      `${getSummaryText({ title, summary })}\n\n${smart.reply || ""}`.trim()
    );
    return;
  }

  if (intent.intent === "meal_suggestion") {
    const summary = await getDailySummary(userId);
    const advice = await generateNutritionAdvice({ text, summary, title });

    if (advice.inScope === false) {
      await replyText(
        replyToken,
        "เรื่องนี้แปะไม่ถนัดน้า 😅 แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า ส่งรูปอาหารมาได้เลย 📸"
      );
      return;
    }

    await replyText(replyToken, advice.reply || getMealSuggestionText({ title, summary }));
    return;
  }

  if (intent.intent === "health_goal") {
    await replyText(
      replyToken,
      `${title} อยากเปลี่ยนเป้าสุขภาพใช่ไหมจ๊ะ 🎯

ตอนนี้แปะยังให้ตั้งผ่าน flow หลักก่อนน้า
พิมพ์ประมาณนี้ได้เลย:
- ลดไขมัน
- เพิ่มกล้าม
- คุมน้ำหนัก
- กินสุขภาพดีขึ้น

เดี๋ยวรอบถัดไปแปะจะทำปุ่มเปลี่ยนเป้าให้กดง่ายๆ จ้า`
    );
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
    `${title} แปะยังจับใจความไม่ค่อยได้น้า 😅

ลองส่งรูปอาหารมา หรือพิมพ์แบบนี้ได้เลย:
- สรุปวันนี้
- หิวแล้ว
- แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว
- ลบมื้อล่าสุด
- กินเพิ่มอีกจาน`
  );
};
