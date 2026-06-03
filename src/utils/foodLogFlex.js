import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(safeNumber(value, 0));
const nonNegative = (value) => Math.max(safeNumber(value, 0), 0);

export const buildDailyEnergyGauge = ({ total = 0, target = DEFAULT_CALORIE_TARGET } = {}) => {
  const totalKcal = nonNegative(total);
  const targetKcal = Math.max(safeNumber(target, DEFAULT_CALORIE_TARGET), 1);
  const percent = Math.round((totalKcal / targetKcal) * 100);
  const displayPercent = clamp(percent, 0, 100);
  const fillPercent = clamp(percent, 1, 100);
  const overKcal = Math.max(totalKcal - targetKcal, 0);
  const leftKcal = Math.max(targetKcal - totalKcal, 0);

  if (percent >= 100) {
    return {
      percent,
      displayPercent,
      fillPercent,
      color: "#DC2626",
      statusEmoji: "🔴",
      statusText: overKcal > 0 ? "วันนี้ถังเต็มแล้วนะ" : "แตะเพดานวันนี้พอดี",
      adviceText: "ไอหยา มื้อต่อไปค่อยเบาลง แปะช่วยเอง",
      meterText: "เกจแตะเต็มแล้ว ไม่ต้องตกใจ",
      totalKcal,
      targetKcal,
      leftKcal,
      overKcal,
    };
  }

  if (percent >= 75) {
    return {
      percent,
      displayPercent,
      fillPercent,
      color: "#F59E0B",
      statusEmoji: "🟡",
      statusText: `ถังเริ่มใกล้เต็ม เหลือราว ${round(leftKcal)} kcal`,
      adviceText: "ยังพอมีพื้นที่ แต่อย่าเจี๊ยะเพลินเกินนะ",
      meterText: `ใช้แคลวันนี้ไปประมาณ ${displayPercent}%`,
      totalKcal,
      targetKcal,
      leftKcal,
      overKcal,
    };
  }

  return {
    percent,
    displayPercent,
    fillPercent,
    color: "#16A34A",
    statusEmoji: "🟢",
    statusText: `ยังมีพื้นที่อยู่ ราว ${round(leftKcal)} kcal`,
    adviceText: "เดี๋ยวมื้อต่อไปค่อยคุมต่อได้",
    meterText: `ใช้แคลวันนี้ไปประมาณ ${displayPercent}%`,
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

const qualityRow = (text) => ({ type: "text", text, size: "xs", color: "#6B7280", wrap: true });

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
  ["local", "local_food_rules", "local_pork_leg_rice", "brand_preset", "drink_sweetness_preset", "meal_suggestion_card"].includes(String(estimateMode || ""))
    ? "แปะนับแบบเร็วคร่าว ๆ ให้นะ 👀"
    : "แปะประเมินให้แล้ว 👀"
);

const resolveNutritionQuality = (meal = {}) => {
  const menu = String(meal.menuName || "").toLowerCase();
  const fat = safeNumber(meal.fat, 0);
  const sugar = safeNumber(meal.sugar, 0);
  const protein = safeNumber(meal.protein, 0);
  const rows = [];

  if (/อโวคาโด|avocado|แซลมอน|salmon|ทูน่า|tuna|อัลมอนด์|almond|ถั่ว/.test(menu) && fat >= 8) {
    rows.push(/อโวคาโด|avocado/.test(menu) ? "🥑 ไขมันส่วนใหญ่: ดีจากอะโวคาโด" : "🥑 ไขมันส่วนใหญ่: ไขมันดี");
  } else if (/ทอด|ฟราย|เฟรนช์ฟราย|นักเก็ต|ไก่ทอด|หมูทอด|ปลาทอด|กุ้งทอด/.test(menu) && fat >= 10) {
    rows.push("🍟 ไขมันส่วนใหญ่: มาจากของทอด");
  } else if (/สามชั้น|สันคอ|คอหมู|ขาหมู|คากิ|หนัง|เบคอน|ไส้กรอก|ชีส|ครีม/.test(menu) && fat >= 14) {
    rows.push("🥓 ไขมันส่วนใหญ่: ไขมันสัตว์ค่อนข้างเยอะ");
  } else if (fat <= 5) {
    rows.push("🍃 ไขมัน: ค่อนข้างเบา");
  }

  if (/น้ำผึ้ง|honey|ไซรัป|syrup|นมข้น|หวาน|น้ำหวาน|ชาไทย|ชานม|โกโก้|เค้ก|ไอติม|บิงซู|บลิซซาร์ด/.test(menu) || sugar >= 15) {
    rows.push(sugar > 0 ? "🍯 ความหวาน: มีบทอยู่ ระวังนิด" : "🍯 ความหวาน: น่าจะมีจากน้ำผึ้ง/ไซรัป");
  }

  if (protein >= 28) rows.push("💪 โปรตีน: ดีอยู่");
  else if (protein > 0 && protein < 10) rows.push("💪 โปรตีน: ยังบาง");

  return rows.slice(0, 3);
};

const nutritionQualityBox = (rows = []) => rows.length ? [{
  type: "box",
  layout: "vertical",
  backgroundColor: "#F9FAFB",
  cornerRadius: "12px",
  paddingAll: "10px",
  spacing: "xs",
  contents: [
    { type: "text", text: "แปะอ่านคุณภาพให้", size: "xs", weight: "bold", color: "#374151", wrap: true },
    ...rows.map(qualityRow),
  ],
}] : [];

export const buildFoodLogFlexMessage = ({ meal = {}, total = 0, target = DEFAULT_CALORIE_TARGET, estimateMode = "", title = "" } = {}) => {
  const gauge = buildDailyEnergyGauge({ total, target });
  const menuName = meal.menuName || "มื้อนี้";
  const sugar = safeNumber(meal.sugar, 0);
  const showSugar = sugar > 0 || /หวาน|น้ำผึ้ง|honey|ไซรัป|ชา|กาแฟ|โกโก้|โค้ก|เป๊ปซี่|น้ำ|ขนม|โอริโอ|oreo|เค้ก|ไอติม|บิงซู|บลิซซาร์ด|blizzard/i.test(menuName);
  const portionLabel = meal.portionLabel || "พอดี";
  const opener = title && title !== "ลื้อ" ? `${title} แปะจดให้แล้ว` : "แปะจดให้แล้ว";
  const qualityRows = resolveNutritionQuality(meal);

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
              ...nutritionQualityBox(qualityRows),
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
              { type: "text", text: "🔥 แคลวันนี้", size: "sm", weight: "bold", color: "#003C88", wrap: true },
              buildGaugeBar(gauge),
              { type: "text", text: `${gauge.statusEmoji} ${gauge.statusText}`, size: "sm", color: "#1F2937", wrap: true },
              { type: "text", text: gauge.meterText, size: "xs", color: "#6B7280", wrap: true },
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
  resolveNutritionQuality,
};
