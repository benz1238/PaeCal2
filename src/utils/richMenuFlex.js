const palette = {
  blue: "#003C88",
  yellow: "#FFD204",
  cream: "#FFF7ED",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  brown: "#7C2D12",
  green: "#0F766E",
  orange: "#D97706",
  red: "#DC2626",
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

const getSummarySignals = (summary = {}) => {
  const kcal = getSummaryNumber(summary, ["todayCalories", "totalToday", "totalKcal", "kcal"], 0);
  const target = getSummaryNumber(summary, ["calorieTarget", "target", "dailyTarget"], 2050);
  const carb = getSummaryNumber(summary, ["totalCarb", "carb"], 0);
  const protein = getSummaryNumber(summary, ["totalProtein", "protein"], 0);
  const fat = getSummaryNumber(summary, ["totalFat", "fat"], 0);
  const sugar = getSummaryNumber(summary, ["totalSugar", "sugar"], 0);
  const mealCount = getSummaryNumber(summary, ["mealCount", "totalMeals"], 0);
  const topMeal = String(summary.topMealName || summary.topMeal || summary.problemMealName || "").trim();

  return {
    kcal,
    target,
    carb,
    protein,
    fat,
    sugar,
    mealCount,
    topMeal,
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
  if (signals.isEmpty) return "ยังไม่มีหลักฐาน";
  if (signals.sweetSignal) return "หวานมาเป็นบท";
  if (signals.highFat) return "ของมันมีพิรุธ";
  if (signals.isOver) return "ตัวตึงมื้อใหญ่";
  if (signals.lowProtein) return "โปรตีนหลบหลังฉาก";
  if (signals.isNear) return "เกือบเต็มแต่ยังคุมได้";
  return "คุมเกมได้อยู่";
};

const pickAura = (signals) => {
  if (signals.isEmpty) return { title: "Aura ยังไม่ขึ้น", color: palette.muted, emoji: "👀" };
  if (signals.sweetSignal) return { title: "ออร่าหวานนำ", color: palette.orange, emoji: "🧋" };
  if (signals.highFat) return { title: "ออร่ากรอบมัน", color: palette.orange, emoji: "🍗" };
  if (signals.isOver) return { title: "ออร่าอิ่มแน่น", color: palette.red, emoji: "🔥" };
  if (signals.lowProtein) return { title: "ออร่าโปรตีนหาย", color: palette.orange, emoji: "💪" };
  return { title: "ออร่าคุมได้", color: palette.green, emoji: "✨" };
};

const evidenceLines = (signals) => {
  if (signals.isEmpty) {
    return ["ยังไม่มีมื้อให้แปะอ่าน", "ส่งรูปอาหารมาก่อน", "เดี๋ยวแปะอ่านทรงให้ 👀"];
  }

  const lines = [];
  if (signals.topMeal) lines.push(`มื้อเด่น: ${truncate(signals.topMeal, 18)}`);
  if (signals.sweetSignal) lines.push("น้ำหวาน/หวานมีบท");
  if (signals.highFat) lines.push("ไขมันขึ้นนำเกม");
  if (signals.lowProtein) lines.push("โปรตีนยังเบาไปนิด");
  if (signals.isOver) lines.push("วันนี้เกินเป้าแล้ว");
  if (!lines.length) lines.push("แคลรวมยังพอคุมได้", "ทรงวันนี้ไม่แย่", "มื้อต่อไปคุมต่ออีกนิด");

  return lines.slice(0, 3);
};

const text = (props) => ({ type: "text", ...props });

const evidenceBox = (lines, title = "หลักฐานที่แปะจับได้") => ({
  type: "box",
  layout: "vertical",
  backgroundColor: "#FFFFFF",
  cornerRadius: "16px",
  paddingAll: "14px",
  spacing: "sm",
  margin: "md",
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text }),
    ...lines.map((line) => text({ text: `• ${line}`, size: "sm", color: palette.brown, wrap: true })),
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
        paddingAll: "16px",
        contents: [
          text({ text: "วันนี้อาหารฟ้องว่า…", size: "sm", weight: "bold", color: palette.orange }),
          text({ text: persona, size: "xxl", weight: "bold", color: palette.brown, wrap: true, margin: "xs" }),
          text({
            text: signals.isEmpty
              ? "แปะยังไม่มีหลักฐานวันนี้นะ ส่งรูปมาก่อน เดี๋ยวแปะอ่านให้"
              : `Food Aura: ${aura.emoji} ${aura.title}`,
            size: "sm",
            color: aura.color,
            weight: "bold",
            wrap: true,
            margin: "sm",
          }),
          evidenceBox(lines),
          footerLine(signals.isEmpty ? "ส่งรูปมา เดี๋ยวแปะอ่านทรงให้" : "มื้อต่อไปคุมต่ออีกนิด แปะว่าเอาอยู่"),
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
        paddingAll: "16px",
        contents: [
          text({ text: "ฉายาวันนี้", size: "sm", weight: "bold", color: palette.orange }),
          text({ text: `${aura.emoji} ${aura.title}`, size: "xxl", weight: "bold", color: aura.color, wrap: true, margin: "xs" }),
          text({
            text: signals.isEmpty
              ? "ยังตั้งฉายาไม่ได้ แปะยังไม่มีมื้อให้จับทรง 👀"
              : "แปะตั้งให้จากทรงอาหารวันนี้นะ ไม่ต้องซีมาก 555",
            size: "sm",
            color: palette.brown,
            wrap: true,
            margin: "sm",
          }),
          evidenceBox(lines),
          footerLine(signals.isEmpty ? "ส่งมื้อแรกมาก่อน เดี๋ยวฉายามา" : "พรุ่งนี้ส่งอีก เดี๋ยวแปะอ่านต่อ"),
        ],
      },
    },
  };
};

export const buildCalorieSummaryFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const left = Math.max(signals.target - signals.kcal, 0);
  const over = Math.max(signals.kcal - signals.target, 0);
  const statusText = signals.isEmpty
    ? "วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้"
    : signals.isOver
      ? `เกินเป้า ${Math.round(over)} kcal`
      : `เหลือ ${Math.round(left)} kcal`;

  return {
    type: "flex",
    altText: "ดูแคลวันนี้",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F8FAFC",
        paddingAll: "16px",
        contents: [
          text({ text: "ดูแคลวันนี้", size: "xl", weight: "bold", color: palette.text }),
          text({
            text: signals.isEmpty ? "ยังไม่มีข้อมูลวันนี้" : `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`,
            size: "xxl",
            weight: "bold",
            color: signals.isOver ? palette.red : palette.blue,
            wrap: true,
            margin: "sm",
          }),
          text({ text: statusText, size: "sm", weight: "bold", color: signals.isOver ? palette.red : palette.green, margin: "xs" }),
          evidenceBox([
            `บันทึกแล้ว ${Math.round(signals.mealCount)} มื้อ`,
            signals.topMeal ? `มื้อเด่น: ${truncate(signals.topMeal, 18)}` : "มื้อเด่นยังไม่มี",
            signals.isEmpty ? "ส่งรูปอาหารมาเริ่มนับได้เลย" : "อยากละเอียดกดโภชนาการต่อได้",
          ], "สรุปเร็ว"),
          footerLine(signals.isEmpty ? "ส่งรูปอาหารมาก่อน เดี๋ยวแปะนับให้" : "ตัวเลขคร่าว ๆ ใช้กะทางได้อยู่", signals.isOver ? palette.red : palette.blue),
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
        backgroundColor: "#F8FAFC",
        paddingAll: "16px",
        contents: [
          text({ text: "โภชนาการวันนี้", size: "xl", weight: "bold", color: palette.text }),
          text({
            text: signals.isEmpty
              ? "วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้"
              : `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal · เหลือ ${Math.round(left)} kcal`,
            size: "sm",
            color: signals.isOver ? palette.red : palette.green,
            weight: "bold",
            wrap: true,
            margin: "sm",
          }),
          evidenceBox([
            `คาร์บ ${Math.round(signals.carb)} g`,
            `โปรตีน ${Math.round(signals.protein)} g`,
            `ไขมัน ${Math.round(signals.fat)} g`,
          ], "สารอาหารคร่าว ๆ"),
          footerLine(signals.lowProtein ? "มื้อต่อไปเพิ่มโปรตีนหน่อย แปะว่าเวิร์ก" : "ดูรวม ๆ แล้วคุมต่อได้"),
        ],
      },
    },
  };
};
