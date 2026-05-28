import { getRarityLabel, selectDailyTitle } from "./titleBank.js";

const palette = {
  blue: "#003C88",
  yellow: "#FFD204",
  cream: "#FFF7ED",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  brown: "#7C2D12",
  green: "#0F766E",
  mint: "#D9FBEF",
  sky: "#E0F2FE",
  orange: "#D97706",
  red: "#DC2626",
  softRed: "#FEE2E2",
  softYellow: "#FDE68A",
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getSummaryNumber = (summary = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = safeNumber(summary?.[key], NaN);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const truncate = (value, max = 28) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const normalizeMealRow = (meal = {}) => ({
  name: String(
    meal.menuName || meal.menu_name || meal.name || meal.mealName || meal.foodName || meal.title || ""
  ).trim(),
  kcal: safeNumber(meal.kcal ?? meal.calories ?? meal.calorie ?? meal.energy, 0),
});

const resolveMeals = (summary = {}) => {
  const candidates = [summary.meals, summary.todayMeals, summary.logs, summary.items, summary.foods];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length) {
      return list.map(normalizeMealRow).filter((meal) => meal.name || meal.kcal > 0);
    }
  }
  return [];
};

const resolveTopMeal = (summary = {}) => {
  const directName = String(
    summary.topMealName || summary.topMeal || summary.problemMealName || summary.highestMealName ||
    summary.maxMealName || summary.mostCaloriesMealName || summary.lastMeal?.menuName ||
    summary.lastMeal?.menu_name || ""
  ).trim();

  const directKcal = safeNumber(
    summary.topMealKcal ?? summary.problemMealKcal ?? summary.highestMealKcal ?? summary.maxMealKcal ??
    summary.mostCaloriesMealKcal ?? summary.lastMeal?.kcal,
    0
  );

  if (directName) return { name: directName, kcal: directKcal };
  const meals = resolveMeals(summary);
  if (!meals.length) return { name: "", kcal: 0 };
  return [...meals].sort((a, b) => b.kcal - a.kcal)[0] || { name: "", kcal: 0 };
};

const resolveUserName = (summary = {}) => {
  const name = String(
    summary.name || summary.displayName || summary.display_name || summary.title || summary.nickname || ""
  ).trim();
  return name || "ลื้อ";
};

const getSummarySignals = (summary = {}) => {
  const meals = resolveMeals(summary);
  const topMeal = resolveTopMeal(summary);
  const kcal = getSummaryNumber(summary, ["todayCalories", "totalToday", "totalKcal", "kcal"], 0);
  const target = getSummaryNumber(summary, ["calorieTarget", "target", "dailyTarget"], 2050);
  const carb = getSummaryNumber(summary, ["totalCarb", "carb"], 0);
  const protein = getSummaryNumber(summary, ["totalProtein", "protein"], 0);
  const fat = getSummaryNumber(summary, ["totalFat", "fat"], 0);
  const sugar = getSummaryNumber(summary, ["totalSugar", "sugar"], 0);
  const mealCount = getSummaryNumber(summary, ["mealCount", "totalMeals"], meals.length);

  return {
    kcal,
    target,
    carb,
    protein,
    fat,
    sugar,
    mealCount,
    topMeal: topMeal.name,
    topMealKcal: topMeal.kcal,
    isEmpty: kcal <= 0 && mealCount <= 0,
    isOver: kcal > target,
    isNear: kcal > 0 && target - kcal <= 250,
    lowProtein: protein > 0 && protein < 45,
    proteinGood: protein >= 75,
    highCarb: carb >= 220,
    highFat: fat >= 75,
    sweetSignal: sugar >= 35,
  };
};

const getDailyTitle = (signals, summary = {}) => selectDailyTitle(signals, {
  userId: summary.userId || summary.lineUserId || summary.line_user_id || "",
  date: summary.date || "today",
  topMeal: signals.topMeal,
});

const pickAura = (signals) => {
  if (signals.isEmpty) return { title: "Aura ยังไม่ขึ้น", color: palette.muted, emoji: "👀", mascot: "🧐" };
  if (signals.isOver && signals.highFat) return { title: "ออร่ากรอบมัน", color: palette.red, emoji: "🍗", mascot: "😤" };
  if (signals.isOver) return { title: "ออร่าแน่นพุง", color: palette.red, emoji: "🔥", mascot: "😳" };
  if (signals.sweetSignal) return { title: "ออร่าหวานนำ", color: palette.orange, emoji: "🧋", mascot: "👀" };
  if (signals.highFat) return { title: "ออร่าของมัน", color: palette.orange, emoji: "🍟", mascot: "🫣" };
  if (signals.lowProtein) return { title: "ออร่าโปรตีนหาย", color: palette.orange, emoji: "💪", mascot: "🤔" };
  return { title: "ออร่าคุมได้", color: palette.green, emoji: "✨", mascot: "😄" };
};

const diagnoseMainCulprit = (signals) => {
  if (signals.isEmpty) return { label: "ยังไม่มีตัวการ", emoji: "👀", detail: "ส่งรูปมาก่อน เดี๋ยวแปะจับผู้ต้องสงสัยให้" };
  if (signals.isOver && signals.highFat) return { label: "ไขมันขึ้นนำเกม", emoji: "🍟", detail: "แคลเกิน + ไขมันมาแรง มื้อต่อไปตัดของทอดก่อน" };
  if (signals.isOver) return { label: "แคลเกินเป้า", emoji: "🔥", detail: "วันนี้ใจใหญ่ไปนิด มื้อต่อไปเบา ๆ พอ" };
  if (signals.sweetSignal) return { label: "น้ำตาลมีซีน", emoji: "🍬", detail: "หวานไม่ได้ผิด แต่วันนี้มีบทเยอะอยู่" };
  if (signals.highFat) return { label: "ไขมันออกหน้า", emoji: "🍗", detail: "ของมันมาแบบไม่หลบ แปะเห็นนะ" };
  if (signals.highCarb) return { label: "คาร์บนำทาง", emoji: "🍚", detail: "แป้งมาเยอะกว่าชาวบ้านเขา มื้อต่อไปเพิ่มโปรตีนหน่อย" };
  if (signals.lowProtein) return { label: "โปรตีนหาย", emoji: "💪", detail: "ทรงรวมโอเค แต่โปรตีนยังบางไปนิด" };
  return { label: "ยังคุมเกมได้", emoji: "✅", detail: "ไม่มีตัวการแรง ๆ วันนี้แปะยังไม่ดุ" };
};

const titleVibe = (signals, titleCard) => {
  if (signals.isEmpty) return "แปะจะรอตั้งฉายาให้หลังมื้อแรกนะ 👀";
  if (titleCard?.vibe) return titleCard.vibe;
  if (signals.isOver) return "แปะอ่านแล้วแน่นแทน";
  return "ทรงนี้ยังมีลุ้นอยู่";
};

const text = (props) => ({ type: "text", ...props });

const evidenceBox = (lines, title = "หลักฐานที่แปะจับได้") => ({
  type: "box",
  layout: "vertical",
  backgroundColor: "#FFFFFF",
  cornerRadius: "18px",
  paddingAll: "14px",
  spacing: "sm",
  margin: "md",
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text, wrap: true }),
    ...lines.map((line) => text({ text: `• ${line}`, size: "sm", color: palette.brown, wrap: true })),
  ],
});

const metricRow = (label, value, color = palette.text) => ({
  type: "box",
  layout: "horizontal",
  contents: [
    text({ text: label, size: "sm", color: palette.muted, flex: 5, wrap: true }),
    text({ text: value, size: "sm", color, weight: "bold", align: "end", flex: 5, wrap: true }),
  ],
});

const footerLine = (message, color = palette.blue) => text({
  text: message,
  size: "sm",
  weight: "bold",
  color,
  wrap: true,
  align: "center",
  margin: "md",
});

const fullInfoPill = ({ title, value, bg, color = palette.brown }) => ({
  type: "box",
  layout: "horizontal",
  backgroundColor: bg,
  cornerRadius: "18px",
  paddingAll: "12px",
  margin: "md",
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text, wrap: true, flex: 3 }),
    text({ text: value, size: "sm", weight: "bold", color, wrap: true, align: "end", flex: 5 }),
  ],
});

const characterPanel = ({ titleCard, signals }) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: signals.isOver ? palette.softRed : palette.sky,
  cornerRadius: "22px",
  paddingAll: "16px",
  margin: "md",
  contents: [
    text({ text: "🎴 Character Card", size: "xs", weight: "bold", color: palette.muted, wrap: true }),
    text({ text: titleCard.emoji || "✨", size: "xxl", align: "center", margin: "xs" }),
    text({ text: titleCard.name, size: "lg", weight: "bold", color: titleCard.color || palette.brown, wrap: true, align: "center" }),
  ],
});

export const buildFoodAuraFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const titleCard = getDailyTitle(signals, summary);

  return {
    type: "flex",
    altText: "ฉายาวันนี้",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: palette.cream,
        paddingAll: "18px",
        contents: [
          text({ text: `🏷️ ฉายาวันนี้ · ${getRarityLabel(titleCard.rarity)}`, size: "sm", weight: "bold", color: titleCard.color || palette.orange, wrap: true }),
          text({ text: `${titleCard.emoji} ${titleCard.name}`, size: "xxl", weight: "bold", color: titleCard.color || palette.brown, wrap: true, margin: "xs" }),
          characterPanel({ titleCard, signals }),
          text({ text: titleVibe(signals, titleCard), size: "md", color: palette.brown, weight: "bold", wrap: true, margin: "md" }),
          footerLine(signals.isEmpty ? "ส่งมื้อแรกมาก่อน เดี๋ยวฉายามา 📸" : "แปะจะรอดูว่าพรุ่งนี้จะอีโวร่างรึยัง ;)"),
        ],
      },
    },
  };
};

export const buildFoodWrappedFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const titleCard = getDailyTitle(signals, summary);
  const culprit = diagnoseMainCulprit(signals);
  const topMealText = signals.topMeal
    ? `${truncate(signals.topMeal, 28)}${signals.topMealKcal > 0 ? ` · ~${Math.round(signals.topMealKcal)} kcal` : ""}`
    : "ยังไม่มีมื้อเด่น";

  return {
    type: "flex",
    altText: "วันนี้อาหารฟ้องว่า…",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: palette.cream,
        paddingAll: "18px",
        contents: [
          text({ text: "💡 วันนี้อาหารฟ้องว่า", size: "sm", weight: "bold", color: palette.orange }),
          text({ text: `${culprit.emoji} ${culprit.label}`, size: "xxl", weight: "bold", color: signals.isOver ? palette.red : palette.brown, wrap: true, margin: "xs" }),
          evidenceBox([
            `⭐ มื้อเด่น: ${topMealText}`,
            `🔥 รวมวันนี้: ${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`,
            `${culprit.emoji} ตัวการหลัก: ${culprit.label}`,
          ], "🔍 หลักฐานบนโต๊ะ"),
          evidenceBox([culprit.detail], "🧡 แปะสรุปให้"),
          footerLine(signals.isOver ? "มื้อต่อไปเบา ๆ หน่อย แปะว่าเอากลับมาได้ 😅" : "ยังไม่หลุด คุมต่ออีกนิดได้อยู่ 😄"),
        ],
      },
    },
  };
};

export const buildCalorieSummaryFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const titleCard = getDailyTitle(signals, summary);
  const userName = resolveUserName(summary);
  const aura = pickAura(signals);
  const left = Math.max(signals.target - signals.kcal, 0);
  const over = Math.max(signals.kcal - signals.target, 0);
  const topMealText = signals.topMeal
    ? `${truncate(signals.topMeal, 34)}${signals.topMealKcal > 0 ? ` · ~${Math.round(signals.topMealKcal)} kcal` : ""}`
    : "ยังไม่มีมื้อเด่น";
  const statusText = signals.isEmpty
    ? "ยังไม่มีข้อมูลวันนี้ 👀"
    : signals.isOver
      ? `เกินเป้า ${Math.round(over)} kcal แล้วนะ 🫣`
      : `เหลือ ${Math.round(left)} kcal อยู่ 😄`;
  const mascotEmoji = signals.isEmpty ? "🧐" : signals.isOver ? "😤" : signals.isNear ? "👀" : "😄";

  return {
    type: "flex",
    altText: "สรุปวันนี้",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: palette.cream,
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 5,
                contents: [
                  text({ text: "TODAY RECAP", size: "sm", weight: "bold", color: "#A32922" }),
                  text({ text: `ของ${userName} · ${getRarityLabel(titleCard.rarity)}`, size: "sm", weight: "bold", color: titleCard.color || palette.muted, margin: "xs", wrap: true }),
                  text({ text: titleCard.name, size: "xxl", weight: "bold", color: titleCard.color || palette.brown, wrap: true, margin: "xs" }),
                ],
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                contents: [
                  text({ text: mascotEmoji, size: "xxl", align: "center" }),
                  text({ text: signals.isOver ? "แปะเหล่แล้ว" : "แปะโอเค", size: "xxs", color: palette.brown, weight: "bold", align: "center", wrap: true }),
                ],
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: palette.card,
            cornerRadius: "20px",
            paddingAll: "16px",
            margin: "md",
            spacing: "sm",
            contents: [
              text({ text: statusText, size: "xl", weight: "bold", color: signals.isOver ? palette.red : palette.green, wrap: true }),
              { type: "separator", color: "#E5D3C8", margin: "sm" },
              metricRow("🔥 กินไป", `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`, signals.isOver ? palette.red : palette.text),
              metricRow("🍚 คาร์บ", `${Math.round(signals.carb)} g`),
              metricRow("💪 โปรตีน", `${Math.round(signals.protein)} g`, signals.lowProtein ? palette.orange : palette.green),
              metricRow("💧 ไขมัน", `${Math.round(signals.fat)} g`, signals.highFat ? palette.orange : palette.text),
              metricRow("🍬 น้ำตาล", `${Math.round(signals.sugar)} g`, signals.sweetSignal ? palette.orange : palette.text),
              metricRow("🍽️ จำนวนมื้อ", `${Math.round(signals.mealCount)} มื้อ`),
            ],
          },
          fullInfoPill({
            title: "🎯 เป้าหมาย",
            value: signals.isEmpty ? "ยังไม่มีข้อมูลวันนี้" : signals.isOver ? `เกินไป ${Math.round(over)} kcal` : `เหลือได้อีก ${Math.round(left)} kcal`,
            bg: signals.isOver ? palette.softRed : palette.mint,
            color: signals.isOver ? palette.red : palette.brown,
          }),
          fullInfoPill({
            title: "⭐ มื้อเด่น",
            value: topMealText,
            bg: palette.sky,
            color: palette.brown,
          }),
          footerLine(signals.isEmpty ? "📸 ส่งรูปอาหารมาก่อน เดี๋ยวแปะนับให้" : `✨ ${aura.title} · ต่อไปคุมต่ออีกนิด ทรงนี้ใช้ได้`, signals.isOver ? palette.red : palette.blue),
        ],
      },
    },
  };
};

export const buildNutritionFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const left = Math.max(signals.target - signals.kcal, 0);

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
        paddingAll: "18px",
        contents: [
          text({ text: "🥗 โภชนาการวันนี้", size: "xl", weight: "bold", color: palette.text }),
          text({
            text: signals.isEmpty ? "วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้ 👀" : `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal · เหลือ ${Math.round(left)} kcal`,
            size: "sm",
            color: signals.isOver ? palette.red : palette.green,
            weight: "bold",
            wrap: true,
            margin: "sm",
          }),
          evidenceBox([
            `🍚 คาร์บ ${Math.round(signals.carb)} g`,
            `💪 โปรตีน ${Math.round(signals.protein)} g`,
            `💧 ไขมัน ${Math.round(signals.fat)} g`,
            `🍬 น้ำตาล ${Math.round(signals.sugar)} g`,
            signals.topMeal ? `⭐ มื้อเด่น: ${truncate(signals.topMeal, 28)}` : "⭐ มื้อเด่นยังไม่มี",
          ], "สารอาหารคร่าว ๆ"),
          footerLine(signals.lowProtein ? "มื้อต่อไปเพิ่มโปรตีนหน่อย แปะว่าเวิร์ก 💪" : "ดูรวม ๆ แล้วคุมต่อได้ 😄"),
        ],
      },
    },
  };
};
