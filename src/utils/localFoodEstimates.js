import { getNutrition } from "../core/moduleRegistry.js";

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
    kcal: res.final?.kcal ?? res.kcal,
    carb: res.final?.carb ?? res.carb,
    protein: res.final?.protein ?? res.protein,
    fat: res.final?.fat ?? res.fat,
    sugar: 0,
    confidence: res.confidence || "code",
    estimateMode: "module_registry",
    note: res.note || "registry resolved",
    items: [
      {
        name: raw,
        quantity: "1 เสิร์ฟ",
        kcal: res.final?.kcal ?? res.kcal
      }
    ]
  };
};

export const LOCAL_FOOD_ESTIMATE_COUNT = 1;
