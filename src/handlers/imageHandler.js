import { pushText, replyText, getLineImageBase64 } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { estimateFoodFromImage } from "../services/openai.js";
import { DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import { getDisplayTitle, syncSessionFromProfile } from "../utils/profile.js";
import { getFoodLogText, getSmartMealAdvice } from "../utils/advice.js";

export const handleImageMessage = async (event) => {
  const userId = event.source.userId;
  const session = await postToSheet({
    action: "GET_SESSION",
    userId,
  });

  if (session.step !== "READY") {
    await replyText(event.replyToken, "แปะขอรู้จักลื้อก่อนน้า พิมพ์ชื่อมาก่อนเลยจ้า 😊");
    return;
  }

  const base64Image = await getLineImageBase64(event.message.id);
  const gptData = await estimateFoodFromImage(base64Image);

  const kcal = safeNumber(gptData.kcal, 0);
  const carb = safeNumber(gptData.carb, 0);
  const protein = safeNumber(gptData.protein, 0);
  const fat = safeNumber(gptData.fat, 0);
  const menuName = gptData.menuName || "อาหาร";

  const sheetData = await postToSheet({
    action: "LOG_FOOD",
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
  const title = await getDisplayTitle({ userId, session });

  await syncSessionFromProfile({
    userId,
    session,
    extraData: {
      calorieTarget: target,
      lastMeal: {
        menuName,
        kcal,
        carb,
        protein,
        fat,
      },
    },
  });

  const message = `${getFoodLogText({
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
})}`;

  await pushText(userId, message);
};
