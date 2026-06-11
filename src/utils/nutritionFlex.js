import { chooseDailyRecapStickerUrl } from "./paeStickerAssets.js";

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
  sky: "#E0F2FE",
  mint: "#D9FBEF",
  softRed: "#FEE2E2",
  soft: "#F9FAFB",
  line: "#E5D3C8",
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round = (value) => Math.round(safeNumber(value, 0));
const text = (props) => ({ type: "text", ...props });

const normalizeMeal = (meal = {}) => ({
  name: String(meal.menuName || meal.menu_name || meal.name || meal.title || "").trim(),
  kcal: safeNumber(meal.kcal ?? meal.calories, 0),
  carb: safeNumber(meal.carb, 0),
  protein: safeNumber(meal.protein, 0),
  fat: safeNumber(meal.fat, 0),
  sugar: safeNumber(meal.sugar, 0),
});

const resolveMeals = (summary = {}) => {
  const lists = [summary.meals, summary.todayMeals, summary.logs, summary.items, summary.foods];
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list.map(normalizeMeal).filter((meal) => meal.name || meal.kcal > 0);
  }
  return [];
};

const sum = (items, key) => items.reduce((total, item) => total + safeNumber(item?.[key], 0), 0);

const resolveSignals = (summary = {}) => {
  const meals = resolveMeals(summary);
  const kcal = safeNumber(summary.todayCalories ?? summary.totalToday ?? summary.totalKcal ?? summary.kcal, sum(meals, "kcal"));
  const target = Math.max(safeNumber(summary.calorieTarget ?? summary.target ?? summary.dailyTarget, 2050), 1);
  const carb = safeNumber(summary.totalCarb ?? summary.carb, sum(meals, "carb"));
  const protein = safeNumber(summary.totalProtein ?? summary.protein, sum(meals, "protein"));
  const fat = safeNumber(summary.totalFat ?? summary.fat, sum(meals, "fat"));
  const sugar = safeNumber(summary.totalSugar ?? summary.sugar, sum(meals, "sugar"));
  const mealCount = safeNumber(summary.mealCount ?? summary.totalMeals, meals.length);
  const topMeal = meals.length ? [...meals].sort((a, b) => b.kcal - a.kcal)[0] : null;
  return {
    kcal,
    target,
    carb,
    protein,
    fat,
    sugar,
    mealCount,
    meals,
    topMeal,
    isEmpty: kcal <= 0 && mealCount <= 0,
    isOver: kcal > target,
    lowProtein: protein > 0 && protein < 45,
    proteinGood: protein >= 75,
    highCarb: carb >= 220,
    highFat: fat >= 75,
    sweetSignal: sugar >= 35,
  };
};

const stickerImage = (url, size = "64px") => url
  ? ({ type: "image", url, size, aspectMode: "fit", aspectRatio: "1:1", gravity: "center" })
  : text({ text: "👀", size: "xxl", align: "center" });

const metricTile = ({ label, value, sub = "", tone = "default" }) => {
  const color = tone === "good" ? palette.green : tone === "warn" ? palette.orange : tone === "danger" ? palette.red : palette.text;
  const bg = tone === "good" ? palette.mint : tone === "warn" ? "#FFF1E6" : tone === "danger" ? palette.softRed : palette.soft;
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: bg,
    cornerRadius: "16px",
    paddingAll: "12px",
    flex: 1,
    contents: [
      text({ text: label, size: "xs", color: palette.muted, wrap: true, maxLines: 1 }),
      text({ text: value, size: "lg", weight: "bold", color, align: "end", wrap: false, maxLines: 1 }),
      ...(sub ? [text({ text: sub, size: "xxs", color: palette.muted, align: "end", wrap: true, maxLines: 1 })] : []),
    ],
  };
};

const metricGrid = (signals) => ({
  type: "box",
  layout: "vertical",
  spacing: "8px",
  margin: "md",
  contents: [
    {
      type: "box",
      layout: "horizontal",
      spacing: "8px",
      contents: [
        metricTile({ label: "🍚 คาร์บ", value: `${round(signals.carb)} g`, tone: signals.highCarb ? "warn" : "default" }),
        metricTile({ label: "💪 โปรตีน", value: `${round(signals.protein)} g`, tone: signals.proteinGood ? "good" : signals.lowProtein ? "warn" : "default" }),
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      spacing: "8px",
      contents: [
        metricTile({ label: "🥑 ไขมัน", value: `${round(signals.fat)} g`, tone: signals.highFat ? "warn" : "default" }),
        metricTile({ label: "🍬 น้ำตาล", value: `${round(signals.sugar)} g`, tone: signals.sweetSignal ? "warn" : "default" }),
      ],
    },
  ],
});

const progressBar = (signals) => {
  const percent = Math.round((signals.kcal / signals.target) * 100);
  const fill = Math.min(Math.max(percent, 1), 100);
  const color = signals.isOver ? palette.red : percent >= 75 ? palette.orange : palette.green;
  return {
    type: "box",
    layout: "vertical",
    height: "10px",
    cornerRadius: "999px",
    backgroundColor: "#E5E7EB",
    margin: "sm",
    contents: [{ type: "box", layout: "vertical", width: `${fill}%`, height: "10px", cornerRadius: "999px", backgroundColor: color, contents: [] }],
  };
};

const insightRows = (signals) => {
  if (signals.isEmpty) return ["ยังไม่มีข้อมูลวันนี้ ส่งมื้อแรกมาก่อน แปะค่อยอ่านให้", "โพยนี้จะชัดขึ้นเมื่อมีอย่างน้อย 1 มื้อ"];
  const rows = [];
  if (signals.proteinGood) rows.push("💪 โปรตีนวันนี้ดีอยู่ เก็บทรงนี้ได้");
  else if (signals.lowProtein) rows.push("💪 โปรตีนยังบาง มื้อต่อไปเติมไข่ ปลา ไก่ หรือเต้าหู้ได้");
  if (signals.sweetSignal) rows.push("🍬 น้ำตาลมีบท วันนี้ลดน้ำหวานต่ออีกนิดจะสวย");
  if (signals.highFat) rows.push("🥓 ไขมันค่อนข้างนำ มื้อต่อไปตัดทอด/มันก่อน");
  if (signals.highCarb) rows.push("🍚 คาร์บค่อนข้างเยอะ ถ้ายังหิวให้เติมโปรตีนแทนแป้ง");
  if (!rows.length) rows.push("ภาพรวมไม่ตีกันมาก แปะว่าไปต่อได้");
  return rows.slice(0, 3);
};

const insightBox = (signals) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: palette.card,
  cornerRadius: "18px",
  paddingAll: "14px",
  margin: "md",
  spacing: "sm",
  contents: [
    text({ text: "แปะอ่านคุณภาพให้", size: "sm", weight: "bold", color: palette.text, wrap: true }),
    ...insightRows(signals).map((line) => text({ text: `• ${line}`, size: "sm", color: palette.brown, wrap: true, maxLines: 3 })),
  ],
});

const nextStep = (signals) => {
  if (signals.isEmpty) return "ส่งรูปหรือพิมพ์มื้อแรกมา แปะจะเริ่มเปิดโพยให้";
  if (signals.lowProtein) return "มื้อต่อไปเน้นโปรตีนก่อน แปะว่าเห็นผลสุด";
  if (signals.sweetSignal) return "มื้อต่อไปตัดหวานก่อน ไม่ต้องตัดหมด แค่ลดก็พอ";
  if (signals.highFat) return "มื้อต่อไปเลี่ยงทอด/มันก่อน แคลจะนิ่งขึ้น";
  if (signals.isOver) return "วันนี้เกินแล้ว ไม่ต้องซ้ำหนัก มื้อต่อไปเบา ๆ ก็รอด";
  return "วันนี้ทรงใช้ได้ คุมต่อแบบไม่เครียดพอ";
};

const truncate = (value = "", max = 24) => {
  const textValue = String(value || "").trim();
  if (!textValue) return "-";
  return textValue.length > max ? `${textValue.slice(0, max - 1)}…` : textValue;
};

export const buildNutritionFlexMessage = ({ summary = {} } = {}) => {
  const signals = resolveSignals(summary);
  const left = Math.max(signals.target - signals.kcal, 0);
  const over = Math.max(signals.kcal - signals.target, 0);
  const percent = Math.round((signals.kcal / signals.target) * 100);
  const stickerUrl = chooseDailyRecapStickerUrl({ day: signals, memory: signals });
  const statusText = signals.isEmpty
    ? "วันนี้ยังไม่มีมื้อที่แปะจดไว้"
    : signals.isOver
      ? `เกิน ${round(over)} kcal · ใช้ไป ${percent}%`
      : `เหลือ ${round(left)} kcal · ใช้ไป ${percent}%`;
  const statusColor = signals.isEmpty ? palette.muted : signals.isOver ? palette.red : palette.green;
  const topMealText = signals.topMeal?.name
    ? `${truncate(signals.topMeal.name)}${signals.topMeal.kcal ? ` · ~${round(signals.topMeal.kcal)} kcal` : ""}`
    : "ยังไม่มีมื้อเด่น";

  return {
    type: "flex",
    altText: "โภชนาการวันนี้",
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
          {
            type: "box",
            layout: "horizontal",
            spacing: "10px",
            contents: [
              { type: "box", layout: "vertical", width: "62px", height: "62px", contents: [stickerImage(stickerUrl, "62px")] },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                contents: [
                  text({ text: "โพยโภชนาการวันนี้", size: "xl", weight: "bold", color: palette.text, wrap: true, maxLines: 2 }),
                  text({ text: statusText, size: "sm", color: statusColor, weight: "bold", wrap: true, maxLines: 2, margin: "xs" }),
                  progressBar(signals),
                ],
              },
            ],
          },
          metricGrid(signals),
          insightBox(signals),
          {
            type: "box",
            layout: "vertical",
            backgroundColor: palette.sky,
            cornerRadius: "18px",
            paddingAll: "14px",
            spacing: "xs",
            contents: [
              text({ text: "มื้อเด่น", size: "xs", weight: "bold", color: palette.muted, wrap: true }),
              text({ text: topMealText, size: "sm", weight: "bold", color: palette.brown, wrap: true, maxLines: 2 }),
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: signals.isOver ? palette.softRed : palette.mint,
            cornerRadius: "18px",
            paddingAll: "14px",
            contents: [text({ text: nextStep(signals), size: "sm", weight: "bold", color: signals.isOver ? palette.red : palette.blue, align: "center", wrap: true, maxLines: 3 })],
          },
          text({ text: "ค่าประมาณจากมื้อที่จดไว้ ใช้ดูแนวโน้ม ไม่ใช่ฉลากเป๊ะ ๆ", size: "xxs", color: palette.muted, align: "center", wrap: true, maxLines: 2 }),
        ],
      },
    },
  };
};

export const __testNutritionFlex = {
  resolveSignals,
  insightRows,
  nextStep,
};
