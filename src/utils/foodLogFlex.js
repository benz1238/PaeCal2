import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(safeNumber(value, 0));
const nonNegative = (value) => Math.max(safeNumber(value, 0), 0);

export const buildDailyEnergyGauge = ({ total = 0, target = DEFAULT_CALORIE_TARGET } = {}) => {
  const totalKcal = nonNegative(total);
  const targetKcal = Math.max(safeNumber(target, DEFAULT_CALORIE_TARGET), 1);
  const percent = Math.round((totalKcal / targetKcal) * 100);
  const fillPercent = clamp(percent, 1, 100);
  const overKcal = Math.max(totalKcal - targetKcal, 0);
  const leftKcal = Math.max(targetKcal - totalKcal, 0);

  if (percent >= 100) {
    return {
      percent,
      fillPercent,
      color: "#DC2626",
      statusEmoji: "🔴",
      statusText: overKcal > 0 ? `เกินลิมิตมาประมาณ ${round(overKcal)} kcal` : "แตะลิมิตพอดี",
      adviceText: "มื้อต่อไปเบา ๆ หน่อย แปะว่าเอากลับมาได้",
      totalKcal,
      targetKcal,
      leftKcal,
      overKcal,
    };
  }

  if (percent >= 75) {
    return {
      percent,
      fillPercent,
      color: "#F59E0B",
      statusEmoji: "🟡",
      statusText: `ถังเริ่มใกล้เต็ม เหลือราว ${round(leftKcal)} kcal`,
      adviceText: "ยังพอมีพื้นที่ แต่อย่าเจี๊ยะเพลินเกินนะ",
      totalKcal,
      targetKcal,
      leftKcal,
      overKcal,
    };
  }

  return {
    percent,
    fillPercent,
    color: "#16A34A",
    statusEmoji: "🟢",
    statusText: `ยังมีพื้นที่อยู่ ราว ${round(leftKcal)} kcal`,
    adviceText: "เดี๋ยวมื้อต่อไปค่อยคุมต่อได้",
    totalKcal,
    targetKcal,
    leftKcal,
    overKcal,
  };
};

const macroRow = (label, value) => ({
  type: "box",
  layout: "horizontal",
  spacing: "sm",
  contents: [
    { type: "text", text: label, size: "xs", color: "#6B7280", flex: 2 },
    { type: "text", text: `${round(value)} g`, size: "sm", weight: "bold", color: "#1F2937", align: "end", flex: 1 },
  ],
});

const buildGaugeBar = (gauge) => ({
  type: "box",
  layout: "vertical",
  height: "12px",
  cornerRadius: "999px",
  backgroundColor: "#E5E7EB",
  contents: [
    {
      type: "box",
      layout: "vertical",
      height: "12px",
      width: `${gauge.fillPercent}%`,
      cornerRadius: "999px",
      backgroundColor: gauge.color,
      contents: [],
    },
  ],
});

const estimateNote = (estimateMode = "") => (
  ["local", "brand_preset", "drink_sweetness_preset", "meal_suggestion_card"].includes(String(estimateMode || ""))
    ? "แปะนับแบบเร็วคร่าว ๆ ให้นะ 👀"
    : "แปะประเมินให้แล้ว 👀"
);

export const buildFoodLogFlexMessage = ({ meal = {}, total = 0, target = DEFAULT_CALORIE_TARGET, estimateMode = "", title = "" } = {}) => {
  const gauge = buildDailyEnergyGauge({ total, target });
  const menuName = meal.menuName || "มื้อนี้";
  const sugar = safeNumber(meal.sugar, 0);
  const showSugar = sugar > 0 || /หวาน|ชา|กาแฟ|โกโก้|โค้ก|เป๊ปซี่|น้ำ|ขนม|โอริโอ|oreo|เค้ก|ไอติม|บิงซู/i.test(menuName);
  const portionLabel = meal.portionLabel || "พอดี";
  const opener = title && title !== "ลื้อ" ? `${title} แปะจดให้แล้ว` : "แปะจดให้แล้ว";

  return {
    type: "flex",
    altText: `แปะจด ${menuName} ให้แล้ว`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFF7ED",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          { type: "text", text: `👀 ${opener}`, size: "sm", weight: "bold", color: "#D97706", wrap: true },
          { type: "text", text: menuName, size: "xl", weight: "bold", color: "#1F2937", wrap: true },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFFFFF",
            cornerRadius: "16px",
            paddingAll: "14px",
            spacing: "sm",
            contents: [
              { type: "text", text: `🔥 ~${round(meal.kcal)} kcal`, size: "xl", weight: "bold", color: "#B91C1C", wrap: true },
              { type: "separator", margin: "sm" },
              macroRow("🍚 คาร์บ", meal.carb),
              macroRow("💪 โปรตีน", meal.protein),
              macroRow("🥑 ไขมัน", meal.fat),
              ...(showSugar ? [macroRow("🍬 น้ำตาล", sugar)] : []),
              { type: "separator", margin: "sm" },
              { type: "text", text: `📏 ปริมาณ: ${portionLabel}`, size: "sm", color: "#374151", wrap: true },
              { type: "text", text: `🧾 ${estimateNote(estimateMode)}`, size: "xs", color: "#6B7280", wrap: true },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFFFFF",
            cornerRadius: "16px",
            paddingAll: "14px",
            spacing: "sm",
            contents: [
              { type: "text", text: "⛽ เกจพลังวันนี้", size: "sm", weight: "bold", color: "#003C88", wrap: true },
              buildGaugeBar(gauge),
              { type: "text", text: `${gauge.statusEmoji} ${gauge.statusText}`, size: "sm", color: "#1F2937", wrap: true },
              { type: "text", text: `วันนี้รวม ~${round(gauge.totalKcal)} kcal · ลิมิต ~${round(gauge.targetKcal)} kcal`, size: "xs", color: "#6B7280", wrap: true },
            ],
          },
          { type: "text", text: gauge.adviceText, size: "sm", color: "#003C88", weight: "bold", align: "center", wrap: true },
        ],
      },
    },
  };
};

export const __testFoodLogFlex = {
  buildDailyEnergyGauge,
};
