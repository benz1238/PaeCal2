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

export const handleImageMessage = async (event) => {
  const userId = event.source.userId;
  const session = await postToSheet({ action: "GET_SESSION", userId });

  if (session.step !== "READY") {
    await replyText(
      event.replyToken,
      "แปะขอรู้จักลื้อก่อนน้า\nพิมพ์ชื่อมาก่อนเลยจ้า 😊"
    );
    return;
  }

  const base64Image = await getLineImageBase64(event.message.id);
  const gptData = await estimateFoodFromImage(base64Image);

  const kcal = safeNumber(gptData.kcal, 0);
  const carb = safeNumber(gptData.carb, 0);
  const protein = safeNumber(gptData.protein, 0);
  const fat = safeNumber(gptData.fat, 0);
  const menuName = gptData.menuName || "อาหาร";

  if (!menuName || kcal <= 0) {
    await replyText(event.replyToken, renderNoFoodDetectedReply());
    return;
  }

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

  await refreshDailyMemorySnapshot({ userId, summary, fallbackMeal: meal });
  const memory7 = await get7DayMemorySummary(userId);
  const summaryWithMemory = { ...summary, memory7 };

  const title = await getDisplayTitle({ userId, session });
  const decision = decideFoodLog({ meal, summary: summaryWithMemory });

  await syncSessionFromProfile({
    userId,
    session,
    extraData: {
      calorieTarget: target,
      lastMeal: meal,
    },
  });

  const messages = renderFoodLogMessages
    ? renderFoodLogMessages({ title, meal, summary: summaryWithMemory, decision })
    : [renderFoodLogReply({ title, meal, summary: summaryWithMemory, decision })];

  await pushTexts(userId, messages);
};
