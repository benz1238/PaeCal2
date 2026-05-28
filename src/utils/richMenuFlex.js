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

const truncate = (value, max = 26) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const normalizeMealRow = (meal = {}) => ({
  name: String(
    meal.menuName ||
    meal.menu_name ||
    meal.name ||
    meal.mealName ||
    meal.foodName ||
    meal.title ||
    ""
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
    summary.topMealName ||
    summary.topMeal ||
    summary.problemMealName ||
    summary.highestMealName ||
    summary.maxMealName ||
    summary.mostCaloriesMealName ||
    summary.lastMeal?.menuName ||
    summary.lastMeal?.menu_name ||
    ""
  ).trim();

  const directKcal = safeNumber(
    summary.topMealKcal ??
    summary.problemMealKcal ??
    summary.highestMealKcal ??
    summary.maxMealKcal ??
    summary.mostCaloriesMealKcal ??
    summary.lastMeal?.kcal,
    0
  );

  if (directName) return { name: directName, kcal: directKcal };

  const meals = resolveMeals(summary);
  if (!meals.length) return { name: "", kcal: 0 };
  return [...meals].sort((a, b) => b.kcal - a.kcal)[0] || { name: "", kcal: 0 };
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
    highCarb: carb >= 220,
    highFat: fat >= 75,
    sweetSignal: sugar >= 35,
  };
};

const pickFoodPersona = (signals) => {
  if (signals.isEmpty) return "ยังไม่มีหลักฐาน 👀";
  if (signals.isOver && signals.highFat) return "ตัวตึงของมัน 🔥";
  if (signals.isOver) return "วันนี้จัดเต็มไปนิด 🫣";
  if (signals.sweetSignal) return "หวานมีบทนำ 🧋";
  if (signals.highFat) return "ของมันมีพิรุธ 🍗";
  if (signals.lowProtein) return "โปรตีนยังแอบหลบ 💪";
  if (signals.isNear) return "เกือบเต็มแต่ยังเอาอยู่ 👀";
  return "ทรงนี้ใช้ได้ 😄";
};

const pickAura = (signals) => {
  if (signals.isEmpty) return { title: "Aura ยังไม่ขึ้น", color: palette.muted, emoji: "👀", mascot: "🧐" };
  if (signals.isOver && signals.highFat) return { title: "ออร่ากรอบมัน", color: palette.red, emoji: "🍗", mascot: "😤" };
  if (signals.isOver) return { title: "ออร่าแน่นพุง", color: palette.red, emoji: "🔥", mascot: "😳" };
  if (signals.sweetSignal) return { title: "ออร่าหวานนำ", color: palette.orange, emoji: "🧋", mascot: "👀" };
  if (signals.highFat) return { title: "ออร่าของมัน", color: palette.orange, emoji: "🍟", mascot: "🫣" };
  if (signals.lowProtein) return { title: "ออร่าโปรตีนหาย", color: palette.orange, emoji: "💪", mascot: "🤔" };
  return { title: "ออร่าคุมได้", color: palette.green, emoji: "✨", mascot: "😄" };
};

const paesRead = (signals) => {
  if (signals.isEmpty) return "แปะยังอ่านทรงไม่ได้ ขอหลักฐานมื้อแรกก่อนจ้า 👀";
  if (signals.isOver) return "แปะว่าอิ่มจริง วันนี้พอแล้วนะ มื้อต่อไปเบา ๆ 😅";
  if (signals.sweetSignal) return "วันนี้หวานมีซีนอยู่นะ ไม่ดุ แต่แปะเห็นนะ 👀";
  if (signals.highFat) return "ของมันเริ่มออกหน้าแล้ว มื้อต่อไปตัดด้วยของเบาหน่อย 😄";
  if (signals.lowProtein) return "ภาพรวมโอเค แต่โปรตีนยังบางไปนิด เติมอีกหน่อยจะสวย 💪";
  return "ทรงวันนี้ยังเอาอยู่ ไม่ต้องซีมาก แต่คุมต่ออีกนิด 😄";
};

const evidenceLines = (signals) => {
  if (signals.isEmpty) {
    return ["ยังไม่มีมื้อให้แปะอ่าน", "ส่งรูปอาหารมาก่อน 📸", "เดี๋ยวแปะอ่านทรงให้ 👀"];
  }

  const lines = [];
  if (signals.topMeal) {
    const kcalText = signals.topMealKcal > 0 ? ` ~${Math.round(signals.topMealKcal)} kcal` : "";
    lines.push(`⭐ มื้อเด่น: ${truncate(signals.topMeal, 19)}${kcalText}`);
  }
  if (signals.sweetSignal) lines.push("🍬 น้ำตาลเริ่มมีบท");
  if (signals.highFat) lines.push("🍟 ไขมันขึ้นนำเกม");
  if (signals.lowProtein) lines.push("💪 โปรตีนยังเบาไปนิด");
  if (signals.isOver) lines.push("🔥 วันนี้เกินเป้าแล้ว");
  if (!lines.length) lines.push("✅ แคลรวมยังพอคุมได้", "😄 ทรงวันนี้ไม่แย่", "📸 มื้อต่อไปคุมต่ออีกนิด");

  return lines.slice(0, 3);
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

const miniPill = ({ title, value, bg, color = palette.brown }) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: bg,
  cornerRadius: "18px",
  paddingAll: "12px",
  flex: 1,
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text, wrap: true }),
    text({ text: value, size: "sm", weight: "bold", color, wrap: true, margin: "xs" }),
  ],
});

export const buildFoodWrappedFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const persona = pickFoodPersona(signals);
  const aura = pickAura(signals);
  const lines = evidenceLines(signals);

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
          text({ text: persona, size: "xxl", weight: "bold", color: palette.brown, wrap: true, margin: "xs" }),
          text({
            text: signals.isEmpty ? "แปะยังไม่มีหลักฐานวันนี้นะ ส่งรูปมาก่อน เดี๋ยวแปะอ่านให้ 📸" : `Food Aura: ${aura.emoji} ${aura.title}`,
            size: "sm",
            color: aura.color,
            weight: "bold",
            wrap: true,
            margin: "sm",
          }),
          evidenceBox(lines, "🔍 หลักฐานที่แปะจับได้"),
          evidenceBox([paesRead(signals)], "🧡 แปะอ่านว่า"),
          footerLine(signals.isEmpty ? "ส่งรูปมา เดี๋ยวแปะอ่านทรงให้ 👀" : "ต่อไปคุมต่ออีกนิด ทรงนี้ยังไหว 😄"),
        ],
      },
    },
  };
};

export const buildFoodAuraFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const aura = pickAura(signals);
  const lines = evidenceLines(signals);

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
          text({ text: "🏷️ ฉายาวันนี้", size: "sm", weight: "bold", color: palette.orange }),
          text({ text: `${aura.emoji} ${aura.title}`, size: "xxl", weight: "bold", color: aura.color, wrap: true, margin: "xs" }),
          text({
            text: signals.isEmpty ? "ยังตั้งฉายาไม่ได้ แปะยังไม่มีมื้อให้จับทรง 👀" : "แปะตั้งให้จากทรงอาหารวันนี้นะ ไม่ต้องซีมาก 555",
            size: "sm",
            color: palette.brown,
            wrap: true,
            margin: "sm",
          }),
          evidenceBox(lines, "🕵️ หลักฐานที่แปะจับได้"),
          footerLine(signals.isEmpty ? "ส่งมื้อแรกมาก่อน เดี๋ยวฉายามา 📸" : "พรุ่งนี้ส่งอีก เดี๋ยวแปะอ่านต่อ 😄"),
        ],
      },
    },
  };
};

export const buildCalorieSummaryFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const aura = pickAura(signals);
  const left = Math.max(signals.target - signals.kcal, 0);
  const over = Math.max(signals.kcal - signals.target, 0);
  const topMealText = signals.topMeal
    ? `${truncate(signals.topMeal, 18)}${signals.topMealKcal > 0 ? ` · ~${Math.round(signals.topMealKcal)} kcal` : ""}`
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
                  text({ text: "ของแปะแคล", size: "sm", weight: "bold", color: palette.muted, margin: "xs" }),
                  text({ text: pickFoodPersona(signals), size: "xxl", weight: "bold", color: palette.brown, wrap: true, margin: "xs" }),
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
            backgroundColor: "#FDE68A",
            cornerRadius: "22px",
            paddingAll: "16px",
            margin: "md",
            contents: [
              text({ text: "💡 วันนี้อาหารฟ้องว่า", size: "sm", weight: "bold", color: palette.text, wrap: true }),
              text({ text: signals.topMeal ? topMealText : paesRead(signals), size: "lg", weight: "bold", color: palette.brown, wrap: true, margin: "xs" }),
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
              text({ text: "📊 สรุปวันนี้", size: "lg", weight: "bold", color: palette.text }),
              text({ text: statusText, size: "xl", weight: "bold", color: signals.isOver ? palette.red : palette.green, wrap: true }),
              { type: "separator", color: "#E5D3C8", margin: "sm" },
              metricRow("🔥 กินไป", `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`, signals.isOver ? palette.red : palette.text),
              metricRow("🍚 คาร์บ", `${Math.round(signals.carb)} g`),
              metricRow("💪 โปรตีน", `${Math.round(signals.protein)} g`, signals.lowProtein ? palette.orange : palette.green),
              metricRow("💧 ไขมัน", `${Math.round(signals.fat)} g`, signals.highFat ? palette.orange : palette.text),
              metricRow("🍬 น้ำตาล", `${Math.round(signals.sugar)} g`, signals.sweetSignal ? palette.orange : palette.text),
              metricRow("🍽️ มื้อ", `${Math.round(signals.mealCount)} มื้อ`),
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "md",
            spacing: "md",
            contents: [
              miniPill({ title: "🎯 เป้าหมาย", value: signals.isOver ? "วันนี้เกินแล้ว" : "ยังเอาอยู่", bg: signals.isOver ? palette.softRed : palette.mint, color: signals.isOver ? palette.red : palette.brown }),
              miniPill({ title: "⭐ มื้อเด่น", value: topMealText, bg: palette.sky, color: palette.brown }),
            ],
          },
          footerLine(signals.isEmpty ? "📸 ส่งรูปอาหารมาก่อน เดี๋ยวแปะนับให้" : "📸 ต่อไปคุมต่ออีกนิด ทรงนี้ใช้ได้", signals.isOver ? palette.red : palette.blue),
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
            signals.topMeal ? `⭐ มื้อเด่น: ${truncate(signals.topMeal, 18)}` : "⭐ มื้อเด่นยังไม่มี",
          ], "สารอาหารคร่าว ๆ"),
          footerLine(signals.lowProtein ? "มื้อต่อไปเพิ่มโปรตีนหน่อย แปะว่าเวิร์ก 💪" : "ดูรวม ๆ แล้วคุมต่อได้ 😄"),
        ],
      },
    },
  };
};
