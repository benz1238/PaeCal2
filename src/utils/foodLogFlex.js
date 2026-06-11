import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(safeNumber(value, 0));
const nonNegative = (value) => Math.max(safeNumber(value, 0), 0);

const palette = {
  cream: "#FFF7ED",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  brown: "#7C2D12",
  blue: "#003C88",
  green: "#0F766E",
  orange: "#D97706",
  red: "#DC2626",
  soft: "#F9FAFB",
  line: "#E5D3C8",
  mint: "#D9FBEF",
  softOrange: "#FFF1E6",
};

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
      color: palette.red,
      statusEmoji: "🔴",
      statusText: overKcal > 0 ? `เกินเป้า ${round(overKcal)} kcal` : "แตะเป้าพอดี",
      adviceText: "มื้อต่อไปเบาลงหน่อย แปะว่ากลับมาได้",
      meterText: `ใช้ไป ${displayPercent}% ของเป้าวันนี้`,
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
      color: palette.orange,
      statusEmoji: "🟡",
      statusText: `เหลือประมาณ ${round(leftKcal)} kcal`,
      adviceText: "ยังพอมีพื้นที่ แต่อย่าเจี๊ยะเพลินเกินนะ",
      meterText: `ใช้ไป ${displayPercent}% ของเป้าวันนี้`,
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
    statusText: `เหลือประมาณ ${round(leftKcal)} kcal`,
    adviceText: "ทรงนี้ไปต่อได้ แปะว่าโอเค",
    meterText: `ใช้ไป ${displayPercent}% ของเป้าวันนี้`,
    totalKcal,
    targetKcal,
    leftKcal,
    overKcal,
  };
};

const text = (props) => ({ type: "text", ...props });

const resolveKcalTone = (kcal = 0) => {
  const value = safeNumber(kcal, 0);
  if (value >= 850) return { color: palette.red, label: "หนัก" };
  if (value >= 600) return { color: palette.orange, label: "จานหลัก" };
  return { color: palette.brown, label: "เบา/กลาง" };
};

const displayPortionLabel = (label = "") => {
  const value = String(label || "").trim();
  if (!value || value === "พอดี") return "1 เสิร์ฟทั่วไป";
  if (value === "ค่อนข้างเบา") return "เบา / ไซส์เล็ก";
  if (value === "ค่อนข้างเยอะ") return "จานหลัก";
  return value;
};

const macroChip = (label, value, { warn = false, good = false, valueText = "", flex = 1 } = {}) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: warn ? palette.softOrange : good ? palette.mint : palette.soft,
  cornerRadius: "14px",
  paddingAll: "10px",
  flex,
  contents: [
    text({ text: label, size: "xs", color: palette.muted, wrap: false, maxLines: 1 }),
    text({
      text: valueText || `${round(value)} g`,
      size: "md",
      weight: "bold",
      color: warn ? palette.orange : good ? palette.green : palette.text,
      align: "end",
      wrap: false,
      maxLines: 1,
    }),
  ],
});

const twoColumnMacros = ({ carb = 0, protein = 0, fat = 0, sugar = 0, showSugar = false }) => ({
  type: "box",
  layout: "vertical",
  spacing: "8px",
  contents: [
    {
      type: "box",
      layout: "horizontal",
      spacing: "8px",
      contents: [
        macroChip("🍚 คาร์บ", carb, { warn: carb >= 85 }),
        macroChip("💪 โปรตีน", protein, { good: protein >= 25 }),
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      spacing: "8px",
      contents: [
        macroChip("🥑 ไขมัน", fat, { warn: fat >= 25 }),
        showSugar
          ? macroChip("🍬 น้ำตาล", sugar, { warn: sugar >= 15 })
          : macroChip("🍬 หวาน", 0, { valueText: "ไม่เด่น", good: true }),
      ],
    },
  ],
});

const qualityRow = (textValue) => text({ text: textValue, size: "xs", color: palette.brown, wrap: true, maxLines: 2 });

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

const estimateNote = (estimateMode = "", meal = {}) => {
  const mode = String(estimateMode || "");
  const menu = String(meal?.menuName || "").toLowerCase();
  if (mode === "local_exact") return "เมนูตรง ค่าค่อนข้างนิ่ง";
  if (/ทอด|คาราเกะ|คาราอาเกะ|ยำแซ่บ|ร้าน|ผัด/.test(menu)) return "ของทอด/ร้านค้า แคลแกว่งได้ราว ±15–20%";
  if (["local", "local_food_rules", "local_pork_leg_rice", "brand_preset", "drink_sweetness_preset", "meal_suggestion_card", "top_food_preset"].includes(mode)) return "ค่าประมาณจากชื่อเมนู ใช้ดูทรงก่อน";
  return "ประเมินจากข้อมูลที่เห็น อาจแกว่งตามปริมาณจริง";
};

const resolveNutritionQuality = (meal = {}) => {
  const menu = String(meal.menuName || "").toLowerCase();
  const fat = safeNumber(meal.fat, 0);
  const sugar = safeNumber(meal.sugar, 0);
  const protein = safeNumber(meal.protein, 0);
  const rows = [];

  if (/อโวคาโด|avocado|แซลมอน|salmon|ทูน่า|tuna|อัลมอนด์|almond|ถั่ว/.test(menu) && fat >= 8) {
    rows.push(/อโวคาโด|avocado/.test(menu) ? "🥑 ไขมันดีจากอะโวคาโด" : "🥑 ไขมันส่วนใหญ่เป็นไขมันดี");
  } else if (/ทอด|ฟราย|เฟรนช์ฟราย|นักเก็ต|ไก่ทอด|หมูทอด|ปลาทอด|กุ้งทอด|คาราเกะ|คาราอาเกะ/.test(menu) && fat >= 10) {
    rows.push("🍟 ไขมันมาจากของทอดเป็นหลัก");
  } else if (/สามชั้น|สันคอ|คอหมู|ขาหมู|คากิ|หนัง|เบคอน|ไส้กรอก|ชีส|ครีม/.test(menu) && fat >= 14) {
    rows.push("🥓 ไขมันสัตว์ค่อนข้างเยอะ");
  } else if (fat <= 5) {
    rows.push("🍃 ไขมันค่อนข้างเบา");
  }

  if (/น้ำผึ้ง|honey|ไซรัป|syrup|นมข้น|หวาน|น้ำหวาน|ชาไทย|ชานม|โกโก้|เค้ก|ไอติม|บิงซู|บลิซซาร์ด|ยำแซ่บ|ยําแซ่บ/.test(menu) || sugar >= 15) {
    rows.push(sugar > 0 ? "🍯 หวาน/ซอสมีบทอยู่" : "🍯 ซอสน่าจะมีหวานนิดหน่อย");
  }

  if (protein >= 25) rows.push("💪 โปรตีนดีอยู่");
  else if (protein > 0 && protein < 10) rows.push("💪 โปรตีนยังบาง");

  return rows.slice(0, 3);
};

const nutritionQualityBox = (rows = []) => rows.length ? [{
  type: "box",
  layout: "vertical",
  backgroundColor: "#FFF7ED",
  cornerRadius: "14px",
  paddingAll: "10px",
  spacing: "xs",
  contents: [
    text({ text: "แปะอ่านคุณภาพให้", size: "xs", weight: "bold", color: palette.orange, wrap: true }),
    ...rows.map(qualityRow),
  ],
}] : [];

export const buildFoodLogFlexMessage = ({ meal = {}, total = 0, target = DEFAULT_CALORIE_TARGET, estimateMode = "", title = "" } = {}) => {
  const gauge = buildDailyEnergyGauge({ total, target });
  const menuName = meal.menuName || "มื้อนี้";
  const mealKcal = safeNumber(meal.kcal, 0);
  const kcalTone = resolveKcalTone(mealKcal);
  const sugar = safeNumber(meal.sugar, 0);
  const showSugar = sugar > 0 || /หวาน|น้ำผึ้ง|honey|ไซรัป|ชา|กาแฟ|โกโก้|โค้ก|เป๊ปซี่|น้ำ|ขนม|โอริโอ|oreo|เค้ก|ไอติม|บิงซู|บลิซซาร์ด|blizzard|ยำแซ่บ|ยําแซ่บ/i.test(menuName);
  const portionLabel = displayPortionLabel(meal.portionLabel || "พอดี");
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
        backgroundColor: palette.cream,
        paddingAll: "16px",
        spacing: "md",
        contents: [
          text({ text: `👀 ${opener}`, size: "sm", weight: "bold", color: palette.orange, wrap: true, maxLines: 1 }),
          text({ text: menuName, size: "xl", weight: "bold", color: palette.text, wrap: true, maxLines: 3 }),
          {
            type: "box",
            layout: "vertical",
            backgroundColor: palette.card,
            cornerRadius: "18px",
            paddingAll: "14px",
            spacing: "sm",
            contents: [
              text({ text: `≈${round(mealKcal)} kcal`, size: "xxl", weight: "bold", color: kcalTone.color, wrap: false, maxLines: 1 }),
              text({ text: `ประเมินเป็นช่วง · ${kcalTone.label}`, size: "xs", color: palette.muted, wrap: true }),
              { type: "separator", color: palette.line, margin: "sm" },
              twoColumnMacros({ carb: meal.carb, protein: meal.protein, fat: meal.fat, sugar, showSugar }),
              ...nutritionQualityBox(qualityRows),
              { type: "separator", color: palette.line, margin: "sm" },
              text({ text: `ปริมาณ: ${portionLabel}`, size: "sm", color: palette.text, wrap: true, maxLines: 2 }),
              text({ text: `🧾 ${estimateNote(estimateMode, meal)}`, size: "xs", color: palette.muted, wrap: true, maxLines: 2 }),
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: palette.card,
            cornerRadius: "18px",
            paddingAll: "14px",
            spacing: "sm",
            contents: [
              { type: "box", layout: "horizontal", contents: [text({ text: "แคลวันนี้", size: "sm", weight: "bold", color: palette.blue, flex: 1, wrap: false }), text({ text: `${gauge.displayPercent}%`, size: "sm", weight: "bold", color: gauge.color, align: "end", flex: 0 })] },
              buildGaugeBar(gauge),
              text({ text: `${gauge.statusEmoji} ${gauge.statusText}`, size: "sm", color: palette.text, wrap: true, maxLines: 2 }),
              text({ text: gauge.meterText, size: "xs", color: palette.muted, wrap: true, maxLines: 1 }),
            ],
          },
          text({ text: gauge.adviceText, size: "sm", color: palette.blue, weight: "bold", align: "center", wrap: true, maxLines: 2 }),
        ],
      },
    },
  };
};

export const __testFoodLogFlex = {
  buildDailyEnergyGauge,
  resolveNutritionQuality,
};
