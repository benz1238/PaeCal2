import { pushTexts, replyText, getLineImageBase64 } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { estimateFoodFromImage } from "../services/openai.js";
import { DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import { getDisplayTitle, syncSessionFromProfile } from "../utils/profile.js";
import { decideFoodLog } from "../utils/decision.js";
import { get7DayMemorySummary, refreshDailyMemorySnapshot } from "../services/memorySheet.js";
import {
  renderFoodLogMessages,
  renderFoodLogReply,
  renderNoFoodDetectedReply,
} from "../utils/personality.js";


const nowMs = () => Date.now();

const logTiming = (scope, step, startedAt, extra = "") => {
  const ms = Date.now() - startedAt;
  console.log(`[PaeCalTiming] ${scope}:${step} ${ms}ms${extra ? ` ${extra}` : ""}`);
  return ms;
};


export const handleImageMessage = async (event) => {
  const totalT = nowMs();
  const userId = event.source.userId;
  console.log(`[PaeCalTiming] image:start user=${userId || "unknown"} message=${event.message?.id || "unknown"}`);

  const sessionT = nowMs();
  const session = await postToSheet({ action: "GET_SESSION", userId });
  logTiming("image", "getSession", sessionT);

  if (session.step !== "READY") {
    const replyT = nowMs();
    await replyText(
      event.replyToken,
      "แปะขอรู้จักลื้อก่อนน้า\nพิมพ์ชื่อมาก่อนเลยจ้า 😊"
    );
    logTiming("image", "replyNeedProfile", replyT);
    logTiming("image", "total", totalT);
    return;
  }

  const ackT = nowMs();
  await replyText(
    event.replyToken,
    "แปะกำลังดูรูปให้นะ 👀\nขอซูมแป๊บ เดี๋ยวบอกให้ว่าเมนูนี้ประมาณเท่าไหร่ 🍽️"
  );
  logTiming("image", "replyAck", ackT);

  const downloadT = nowMs();
  const base64Image = await getLineImageBase64(event.message.id);
  logTiming("image", "downloadLineImage", downloadT, `base64Len=${base64Image.length}`);

  const aiT = nowMs();
  const gptData = await estimateFoodFromImage(base64Image);
  logTiming("image", "openaiVision", aiT, `menu=${gptData?.menuName || "unknown"} kcal=${gptData?.kcal || 0}`);

  const kcal = safeNumber(gptData.kcal, 0);
  const carb = safeNumber(gptData.carb, 0);
  const protein = safeNumber(gptData.protein, 0);
  const fat = safeNumber(gptData.fat, 0);
  const menuName = gptData.menuName || "อาหาร";

  if (!menuName || kcal <= 0) {
    const pushNoFoodT = nowMs();
    await pushTexts(userId, [renderNoFoodDetectedReply()]);
    logTiming("image", "pushNoFood", pushNoFoodT);
    logTiming("image", "total", totalT);
    return;
  }

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
    itemsJson: "[]",
  });
  logTiming("image", "sheetLogFood", logFoodT);

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
  const meal = { menuName, kcal, carb, protein, fat, requestId, items: [] };
  logTiming("image", "buildSummaryObjects", buildT);

  const memoryRefreshT = nowMs();
  await refreshDailyMemorySnapshot({ userId, summary, fallbackMeal: meal });
  logTiming("image", "refreshDailyMemory", memoryRefreshT);

  const memory7T = nowMs();
  const memory7 = await get7DayMemorySummary(userId);
  logTiming("image", "get7DayMemory", memory7T);

  const titleT = nowMs();
  const title = await getDisplayTitle({ userId, session });
  logTiming("image", "getDisplayTitle", titleT);

  const decisionT = nowMs();
  const summaryWithMemory = { ...summary, memory7 };
  const decision = decideFoodLog({ meal, summary: summaryWithMemory });
  logTiming("image", "decideFoodLog", decisionT);

  const syncT = nowMs();
  await syncSessionFromProfile({
    userId,
    session,
    extraData: {
      calorieTarget: target,
      lastMeal: meal,
    },
  });
  logTiming("image", "syncSession", syncT);

  const renderT = nowMs();
  const messages = renderFoodLogMessages
    ? renderFoodLogMessages({ title, meal, summary: summaryWithMemory, decision })
    : [renderFoodLogReply({ title, meal, summary: summaryWithMemory, decision })];
  logTiming("image", "renderMessages", renderT, `count=${messages.length}`);

  const pushT = nowMs();
  await pushTexts(userId, messages);
  logTiming("image", "pushResult", pushT);

  logTiming("image", "total", totalT);
};

