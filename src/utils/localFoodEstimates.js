import { getNutrition } from "./nutritionEngine.js";

const normalizeText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/^วันนี้กิน\s*/i, "")
  .replace(/^เมื่อกี้กิน\s*/i, "")
  .replace(/^กิน\s*/i, "")
  .replace(/\s+/g, " ");

const compactText = (text = "") => normalizeText(text).replace(/\s+/g, "");

export const resolveLocalFoodEstimate = (text = "") => {
  const raw = normalizeText(text);
  const value = compactText(text);

  if (!raw || !value) return null;

  const res = getNutrition(text);

  return {
    menuName: raw,
    kcal: res.final.kcal,
    carb: res.final.carb,
    protein: res.final.protein,
    fat: res.final.fat,
    sugar: 0,
    confidence: res.confidence,
    estimateMode: "nutrition_engine",
    note: res.note,
    items: [
      {
        name: raw,
        quantity: "1 เสิร์ฟ",
        kcal: res.final.kcal
      }
    ]
  };
};

export const LOCAL_FOOD_ESTIMATE_COUNT = 1;
