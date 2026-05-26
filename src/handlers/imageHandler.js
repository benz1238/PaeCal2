import { pushTexts, replyText, getLineImageBase64 } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { refreshSummaryCacheFromSheetResponse } from "../utils/summaryCache.js";
import { getCachedSession, mergeCachedSession, setCachedSession } from "../utils/sessionCache.js";
import { estimateFoodFromImage } from "../services/openai.js";
import { DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import { renderNoFoodDetectedReply } from "../utils/personality.js";

const nowMs = () => Date.now();

const logTiming = (scope, step, startedAt, extra = "") => {
  const ms = Date.now() - startedAt;
  console.log(`[PaeCalTiming] ${scope}:${step} ${ms}ms${extra ? ` ${extra}` : ""}`);
  return ms;
};

const resolveFastTitle = (session) => {
  const data = session?.data || {};
  return String(data.title || data.name || "ลื้อ").trim() || "ลื้อ";
};

const normalizeText = (value) => String(value || "").trim();

const detectFoodCategory = (menuName) => {
  const text = normalizeText(menuName).toLowerCase();

  if (!text) return "meal";

  if (/(ชา|กาแฟ|โกโก้|มัทฉะ|นม|โซดา|น้ำผลไม้|สมูทตี้|latte|coffee|tea|milk|juice|smoothie)/i.test(text)) {
    return "drink";
  }

  if (/(เลย์|ขนม|คุกกี้|เค้ก|โดนัท|บราวนี่|โรตี|snack|cookie|cake|donut|dessert)/i.test(text)) {
    return "snack";
  }

  if (/(สลัด|ผลไม้|โยเกิร์ต|ต้มจืด|ซุป|เกาเหลา|ลวก|ยำ|salad|fruit|yogurt|soup)/i.test(text)) {
    return "light";
  }

  if (/(ก๋วยเตี๋ยว|บะหมี่|มาม่า|เส้น|สปาเกตตี|ก๋วยจั๊บ|noodle|pasta)/i.test(text)) {
    return "noodle";
  }

  return "meal";
};

const inferPortionInfo = ({ menuName, kcal, portionLevel, portionNote }) => {
  const providedLevel = normalizeText(portionLevel).toLowerCase();
  const providedNote = normalizeText(portionNote);

  const category = detectFoodCategory(menuName);
  const totalKcal = safeNumber(kcal, 0);

  if (providedLevel) {
    if (providedLevel === "light" || providedLevel === "small" || providedLevel === "เบา") {
      return {
        level: "light",
        label: "เบา",
        reaction: "🥗",
        note: providedNote || "มื้อนี้ดูไม่หนักมาก 🙂",
      };
    }

    if (providedLevel === "heavy" || providedLevel === "large" || providedLevel === "เยอะ") {
      return {
        level: "heavy",
        label: "ค่อนข้างเยอะ",
        reaction: "👀",
        note: providedNote || "จานนี้ดูแน่นกว่าปกตินิดนึง",
      };
    }

    return {
      level: "normal",
      label: "พอดี",
      reaction: "😋",
      note: providedNote || "ปริมาณประมาณหนึ่งมื้อพอดี 👌",
    };
  }

  let level = "normal";

  if (category === "drink") {
    if (totalKcal <= 120) level = "light";
    else if (totalKcal > 220) level = "heavy";
  } else if (category === "snack") {
    if (totalKcal <= 180) level = "light";
    else if (totalKcal > 320) level = "heavy";
  } else if (category === "light") {
    if (totalKcal <= 250) level = "light";
    else if (totalKcal > 450) level = "heavy";
  } else if (category === "noodle") {
    if (totalKcal <= 320) level = "light";
    else if (totalKcal > 600) level = "heavy";
  } else {
    if (totalKcal <= 350) level = "light";
    else if (totalKcal > 700) level = "heavy";
  }

  if (level === "light") {
    return {
      level,
      label: "เบา",
      reaction: "🥗",
      note: providedNote || "มื้อนี้ดูไม่หนักมาก 🙂",
    };
  }

  if (level === "heavy") {
    return {
      level,
      label: "ค่อนข้างเยอะ",
      reaction: "👀",
      note: providedNote || "จานนี้ดูแน่นกว่าปกตินิดนึง",
    };
  }

  return {
    level,
    label: "พอดี",
    reaction: "😋",
    note: providedNote || "ปริมาณประมาณหนึ่งมื้อพอดี 👌",
  };
};

const buildImageInsight = ({ meal, summary, goalText }) => {
  const fat = safeNumber(meal?.fat, 0);
  const protein = safeNumber(meal?.protein, 0);
  const carb = safeNumber(meal?.carb, 0);
  const totalToday = safeNumber(summary?.todayCalories ?? summary?.totalToday, 0);
  const target = safeNumber(summary?.calorieTarget, DEFAULT_CALORIE_TARGET);
  const goal = normalizeText(goalText).toLowerCase();

  let macroLine = "ภาพรวมยังโอเคอยู่ 👌";

  if (fat >= 25) {
    macroLine = "ของทอด/มันเริ่มเด่นนิดนึงนะ 🫣";
  } else if (protein >= 20) {
    macroLine = "โปรตีนโอเคอยู่ 💪";
  } else if (carb >= 80) {
    macroLine = "คาร์บมาแน่นพอควรเลย 🍚";
  } else if (safeNumber(meal?.kcal, 0) <= 320) {
    macroLine = "มื้อนี้ค่อนข้างเบาเลย 😄";
  }

  let goalLine = "มื้อต่อไปค่อยบาลานซ์ต่อได้ 😄🍃";

  if (/ลด|คุม|ไขมัน|พุง/.test(goal)) {
    if (meal?.portionLevel === "heavy" || fat >= 25 || totalToday >= target) {
      goalLine = "เป้าลดไขมันยังไปต่อได้ แค่มื้อต่อไปเบาลงหน่อย 😄🍃";
    } else {
      goalLine = "เป้าลดไขมันยังคุมได้อยู่ 😄🍃";
    }
  } else if (/กล้าม|bulk|เพิ่มน้ำหนัก|โปรตีน/.test(goal)) {
    if (protein >= 20) {
      goalLine = "โปรตีนเริ่มโอเคกับเป้านะ 💪";
    } else {
      goalLine = "ถ้าอยากอิ่มนาน/เสริมกล้าม เพิ่มโปรตีนอีกนิดจะสวย 💪";
    }
  } else if (totalToday >= target) {
    goalLine = "วันนี้ใกล้เต็มแล้ว มื้อต่อไปเบา ๆ พอ 😮‍💨🍃";
  }

  return { macroLine, goalLine };
};

const buildImageFoodMessages = ({ meal, summary, title, session }) => {
  const firstMessage = `${meal.reaction} ${title} แปะดูให้แล้ว\n\n🍽️ ${meal.menuName}\n🔥 ~${meal.kcal} kcal\n📏 ปริมาณ: ${meal.portionLabel}`;

  const { macroLine, goalLine } = buildImageInsight({
    meal,
    summary,
    goalText: session?.data?.goal || "",
  });

  const secondLines = [
    `💡 ${meal.portionNote}`,
    macroLine,
    goalLine,
  ];

  if (normalizeText(meal.confidence).toLowerCase() === "low") {
    secondLines.push("👀 แปะประเมินจากรูปคร่าว ๆ นะ");
  }

  return [firstMessage, secondLines.join("\n")];
};

export const handleImageMessage = async (event) => {
  const totalT = nowMs();
  const userId = event.source.userId;
  console.log(`[PaeCalTiming] image:start user=${userId || "unknown"} message=${event.message?.id || "unknown"}`);

  const sessionT = nowMs();
  const cachedSession = getCachedSession(userId);

  const sessionPromise = cachedSession
    ? Promise.resolve(cachedSession).then((session) => {
      logTiming("image", "getSessionMemoryHit", sessionT);
      return session;
    })
    : postToSheet({ action: "GET_SESSION", userId }).then((session) => {
      const normalized = {
        step: session?.step || "READY",
        data: session?.data || {},
        ...session,
      };
      setCachedSession(userId, normalized);
      logTiming("image", "getSession", sessionT);
      return normalized;
    });

  const ackT = nowMs();
  const downloadT = nowMs();

  const ackPromise = replyText(
    event.replyToken,
    "แปะกำลังดูรูปให้นะ 👀\nขอซูมแป๊บ เดี๋ยวบอกให้ว่าเมนูนี้ประมาณเท่าไหร่ 🍽️"
  ).then(() => {
    logTiming("image", "replyAck", ackT);
  });

  const base64Promise = getLineImageBase64(event.message.id).then((base64Image) => {
    logTiming("image", "downloadLineImage", downloadT, `base64Len=${base64Image.length}`);
    return base64Image;
  });

  const aiPromise = base64Promise.then(async (base64Image) => {
    const aiT = nowMs();
    const gptData = await estimateFoodFromImage(base64Image);
    logTiming("image", "openaiVision", aiT, `menu=${gptData?.menuName || "unknown"} kcal=${gptData?.kcal || 0}`);
    return gptData;
  });

  const [session, gptData] = await Promise.all([sessionPromise, aiPromise, ackPromise])
    .then(([resolvedSession, resolvedGptData]) => [resolvedSession, resolvedGptData]);

  if (session.step !== "READY") {
    const pushT = nowMs();
    await pushTexts(userId, [
      ["แปะขอรู้จักลื้อก่อนน้า", "พิมพ์ชื่อมาก่อนเลยจ้า 😊"].join("\n"),
    ]);
    logTiming("image", "pushNeedProfile", pushT);
    logTiming("image", "total", totalT);
    return;
  }

  const kcal = safeNumber(gptData?.kcal, 0);
  const carb = safeNumber(gptData?.carb, 0);
  const protein = safeNumber(gptData?.protein, 0);
  const fat = safeNumber(gptData?.fat, 0);
  const menuName = normalizeText(gptData?.menuName) || "อาหาร";

  if (!menuName || kcal <= 0) {
    const pushNoFoodT = nowMs();
    await pushTexts(userId, [renderNoFoodDetectedReply()]);
    logTiming("image", "pushNoFood", pushNoFoodT);
    logTiming("image", "total", totalT);
    return;
  }

  const portionT = nowMs();
  const portion = inferPortionInfo({
    menuName,
    kcal,
    portionLevel: gptData?.portionLevel,
    portionNote: gptData?.portionNote,
  });

  const imageItems = [
    {
      name: menuName,
      kcal,
      carb,
      protein,
      fat,
      portionLevel: portion.level,
      portionLabel: portion.label,
      portionNote: portion.note,
      source: "image_estimate",
    },
  ];
  logTiming("image", "buildPortion", portionT, `portion=${portion.level}`);

  const logFoodT = nowMs();
  const sheetData = await postToSheet({
    action: "LOG_FOOD",
    userId,
    name: session.data?.name || "",
    kcal,
    carb,
    protein,
    fat,
    menuName,
    requestId: event.message?.id ? `${event.message.id}:image-log` : undefined,
    itemsJson: JSON.stringify(imageItems),
  });
  refreshSummaryCacheFromSheetResponse(userId, sheetData);
  logTiming("image", "sheetLogFood", logFoodT, "summaryCache=updated");

  const buildT = nowMs();
  const total = sheetData.todayCalories ?? sheetData.totalToday ?? kcal;
  const target = sheetData.calorieTarget || DEFAULT_CALORIE_TARGET;
  const summary = {
    ...sheetData,
    todayCalories: total,
    totalToday: total,
    calorieTarget: target,
  };

  const requestId = event.message?.id ? `${event.message.id}:image-log` : "";
  const meal = {
    menuName,
    kcal,
    carb,
    protein,
    fat,
    requestId,
    items: imageItems,
    portionLevel: portion.level,
    portionLabel: portion.label,
    portionNote: portion.note,
    reaction: portion.reaction,
    confidence: normalizeText(gptData?.confidence || gptData?.estimateConfidence || ""),
  };
  logTiming("image", "buildSummaryObjects", buildT);

  const syncT = nowMs();
  mergeCachedSession(userId, session, {
    calorieTarget: target,
    lastMeal: meal,
  });
  logTiming("image", "syncSessionMemoryOnly", syncT);

  const renderT = nowMs();
  const title = resolveFastTitle(session);
  const messages = buildImageFoodMessages({
    meal,
    summary,
    title,
    session,
  });
  logTiming("image", "renderMessages", renderT, `count=${messages.length}`);

  const pushT = nowMs();
  await pushTexts(userId, messages);
  logTiming("image", "pushResult", pushT);

  logTiming("image", "total", totalT);
};
