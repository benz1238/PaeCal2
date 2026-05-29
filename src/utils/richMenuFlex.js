import { getRarityLabel, selectDailyTitle } from "./titleBank.js";
import { chooseDailyRecapStickerUrl } from "./paeStickerAssets.js";

const palette = {
  blue: "#003C88",
  cream: "#FFF7ED",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  brown: "#7C2D12",
  green: "#0F766E",
  sky: "#E0F2FE",
  orange: "#D97706",
  red: "#DC2626",
  softRed: "#FEE2E2",
  mint: "#D9FBEF",
};

let footerCounter = 0;
const rotate = (items = []) => items[(footerCounter++) % Math.max(items.length, 1)] || "";
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const truncate = (value, max = 28) => {
  const textValue = String(value || "").trim();
  if (!textValue) return "-";
  return textValue.length > max ? `${textValue.slice(0, max - 1)}…` : textValue;
};
const text = (props) => ({ type: "text", ...props });
const stickerImage = (url, size = "76px") => url
  ? ({ type: "image", url, size, aspectMode: "fit", aspectRatio: "1:1", gravity: "center" })
  : text({ text: "👀", size: "xxl", align: "center" });

const normalizeMealRow = (meal = {}) => ({
  name: String(meal.menuName || meal.menu_name || meal.name || meal.mealName || meal.foodName || meal.title || "").trim(),
  kcal: safeNumber(meal.kcal ?? meal.calories ?? meal.calorie ?? meal.energy, 0),
});

const resolveMeals = (summary = {}) => {
  const candidates = [summary.meals, summary.todayMeals, summary.logs, summary.items, summary.foods];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length) return list.map(normalizeMealRow).filter((meal) => meal.name || meal.kcal > 0);
  }
  return [];
};

const resolveTopMeal = (summary = {}) => {
  const directName = String(summary.topMealName || summary.topMeal || summary.problemMealName || summary.highestMealName || summary.maxMealName || summary.mostCaloriesMealName || summary.lastMeal?.menuName || summary.lastMeal?.menu_name || "").trim();
  const directKcal = safeNumber(summary.topMealKcal ?? summary.problemMealKcal ?? summary.highestMealKcal ?? summary.maxMealKcal ?? summary.mostCaloriesMealKcal ?? summary.lastMeal?.kcal, 0);
  if (directName) return { name: directName, kcal: directKcal };
  const meals = resolveMeals(summary);
  if (!meals.length) return { name: "", kcal: 0 };
  return [...meals].sort((a, b) => b.kcal - a.kcal)[0] || { name: "", kcal: 0 };
};

const cleanUserName = (value = "") => String(value || "").trim().replace(/^(แปะ|อาแปะ|เฮีย|เจ๊|ซ้อ|อาตี๋|ตี๋|หมวย)+/i, "").trim();
const resolveUserName = (summary = {}) => cleanUserName(summary.name || summary.displayName || summary.display_name || summary.title || summary.nickname || "") || "ลื้อ";
const getSummaryNumber = (summary = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = safeNumber(summary?.[key], NaN);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
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
    kcal, target, carb, protein, fat, sugar, mealCount,
    topMeal: topMeal.name,
    topMealKcal: topMeal.kcal,
    isEmpty: kcal <= 0 && mealCount <= 0,
    isOver: kcal > target,
    isVeryOver: kcal > target * 1.35,
    isNear: kcal > 0 && target - kcal <= 250,
    lowProtein: protein > 0 && protein < 45,
    proteinGood: protein >= 75,
    goodProteinDay: protein >= 75,
    highCarb: carb >= 220,
    highFat: fat >= 75,
    sweetSignal: sugar >= 35,
    hasSweetPattern: sugar >= 60,
    hasFriedPattern: fat >= 85,
    hasHeavyPattern: kcal > target * 1.35,
  };
};

const getDailyTitle = (signals, summary = {}) => selectDailyTitle(signals, {
  userId: summary.userId || summary.lineUserId || summary.line_user_id || "",
  date: summary.date || "today",
  topMeal: signals.topMeal,
});

const stickerUrlForSignals = (signals = {}, options = {}) => chooseDailyRecapStickerUrl({ day: signals, memory: signals }, options);

const buildTwoLineTitle = (left, right, leftSuffix = "") => {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  if (!a || !b) return `${a}${b}`;
  return `${a}${leftSuffix}\n${b}`;
};

const formatDailyTitle = (name = "") => {
  const title = String(name || "").trim();
  if (!title) return "-";

  const exact = {
    "น้ำมันคือพลังงานชีวิต": buildTwoLineTitle("น้ำมันคือ", "พลังงานชีวิต", "..."),
    "หมูกระทะเยียวยาทุกสิ่ง": buildTwoLineTitle("หมูกระทะจะ", "เยียวยาทุกสิ่ง", "..."),
    "คาร์บไม่เคยทำร้ายใคร": buildTwoLineTitle("คาร์บไม่เคย", "ทำร้ายใคร"),
    "ไขมันไม่เข้าใครออกใคร": buildTwoLineTitle("ไขมันไม่เข้า", "ใครออกใคร"),
    "แป้งก่อน โปรตีนทีหลัง": buildTwoLineTitle("แป้งก่อน", "โปรตีนทีหลัง"),
    "มาม่าตอนเที่ยงคืน Ambassador": buildTwoLineTitle("มาม่าตอนเที่ยงคืน", "Ambassador"),
  };
  if (exact[title]) return exact[title];

  const splitBeforeWord = (word, leftSuffix = "") => {
    const idx = title.indexOf(word);
    if (idx <= 0) return null;
    const left = title.slice(0, idx).trim();
    const right = title.slice(idx).trim();
    if (!left || !right) return null;
    return buildTwoLineTitle(left, right, leftSuffix);
  };

  if (title.includes("เยียวยา")) {
    const idx = title.indexOf("เยียวยา");
    const left = title.slice(0, idx).trim();
    const right = title.slice(idx).trim();
    if (left && right) return buildTwoLineTitle(`${left}จะ`, right, "...");
  }

  if (title.includes("คือ") && title.includes("พลังงาน")) {
    const idx = title.indexOf("พลังงาน");
    const left = title.slice(0, idx).trim();
    const right = title.slice(idx).trim();
    if (left && right) return buildTwoLineTitle(left, right, "...");
  }

  if (title.includes("กับ")) {
    const idx = title.indexOf("กับ");
    const left = title.slice(0, idx).trim();
    const right = title.slice(idx).trim();
    if (left.length >= 6 && right) return buildTwoLineTitle(left, right);
  }

  return (
    splitBeforeWord("ไม่เคย") ||
    splitBeforeWord("ทำร้าย") ||
    splitBeforeWord("ทำให้") ||
    splitBeforeWord("พลังงาน", "...") ||
    splitBeforeWord("แห่ง") ||
    (title.length > 16 && title.includes(" ")
      ? title.replace(/\s+([^\s]+)$/, "\n$1")
      : title)
  );
};

const footerText = (message = "") => String(message || "").replace(/\s+/g, " ").replace(/(.{18,26})\s+/g, "$1\n").trim();

const speechBubbleFooter = (message, color = palette.blue, stickerUrl = "") => ({
  type: "box",
  layout: "horizontal",
  spacing: "8px",
  margin: "sm",
  alignItems: "flex-end",
  contents: [
    { type: "box", layout: "vertical", width: "46px", height: "46px", contents: [stickerImage(stickerUrl, "46px")] },
    {
      type: "box",
      layout: "vertical",
      flex: 1,
      backgroundColor: "#FFFFFF",
      cornerRadius: "16px",
      paddingAll: "10px",
      contents: [text({ text: footerText(message), size: "sm", weight: "bold", color, wrap: true, align: "start", maxLines: 2 })],
    },
  ],
});

const heroStickerBackground = (stickerUrl = "") => ({
  type: "box",
  layout: "vertical",
  position: "absolute",
  offsetTop: "0px",
  offsetEnd: "0px",
  width: "142px",
  height: "142px",
  contents: [stickerImage(stickerUrl, "142px")],
});

const recapHeroTitle = ({ userName, rarityLabel, titleCard, titleText, stickerUrl }) => ({
  type: "box",
  layout: "vertical",
  height: "132px",
  paddingTop: "0px",
  paddingEnd: "0px",
  contents: [
    heroStickerBackground(stickerUrl),
    text({ text: "TODAY RECAP BY แปะ", size: "sm", weight: "bold", color: "#A32922", wrap: false, maxLines: 1 }),
    text({ text: `${userName} · ${rarityLabel}`, size: "sm", weight: "bold", color: titleCard.color || palette.muted, margin: "xs", wrap: true, maxLines: 1 }),
    text({ text: titleText, size: "xxl", weight: "bold", color: titleCard.color || palette.brown, wrap: true, margin: "xs", maxLines: 3 }),
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

const fullInfoPill = ({ title, value, bg, color = palette.brown }) => ({
  type: "box",
  layout: "horizontal",
  backgroundColor: bg,
  cornerRadius: "16px",
  paddingAll: "10px",
  margin: "sm",
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text, wrap: true, flex: 4 }),
    text({ text: value, size: "sm", weight: "bold", color, wrap: true, align: "end", flex: 6, maxLines: 2 }),
  ],
});

const evidenceBox = (lines, title = "หลักฐานที่แปะจับได้") => ({
  type: "box",
  layout: "vertical",
  backgroundColor: palette.card,
  cornerRadius: "18px",
  paddingAll: "14px",
  spacing: "sm",
  margin: "md",
  contents: [
    text({ text: title, size: "sm", weight: "bold", color: palette.text, wrap: true }),
    ...lines.map((line) => text({ text: `• ${line}`, size: "sm", color: palette.brown, wrap: true })),
  ],
});

const calorieFooter = (signals) => rotate(signals.isEmpty ? [
  "โต๊ะยังว่างอยู่ แปะรอมื้อแรกนะ",
  "เริ่มมื้อแรกเมื่อไหร่ แปะจะจดให้เอง",
] : signals.isOver ? [
  "วันนี้ใจใหญ่ไปนิด\nพรุ่งนี้ค่อยตั้งหลักใหม่",
  "เกินแล้วรู้ตัวก็ดี\nพรุ่งนี้แปะช่วยดึงกลับ",
] : [
  "คุมต่ออีกนิด แปะว่าเอาอยู่",
  "เหลือพื้นที่อยู่ อย่าเจี๊ยะเพลินนะ",
]);

const wrappedFooter = (signals) => rotate(signals.isEmpty ? [
  "โต๊ะยังว่างอยู่ แปะรอหลักฐานก่อน",
  "ส่งมื้อแรกมาเมื่อไหร่ เดี๋ยวแปะอ่านทรงให้",
] : signals.isOver ? [
  "ไอหยา วันนี้มีหลุด แต่ยังไม่พัง พรุ่งนี้ค่อยตัดเกมใหม่",
  "วันนี้ใจใหญ่ไปนิด พรุ่งนี้แปะช่วยดึงกลับ",
] : [
  "คุมต่ออีกนิด แปะว่าเอาอยู่",
  "อั๊วะให้ผ่านก่อน แต่พรุ่งนี้ยังต้องดูต่อ",
]);

const titleFooter = (signals) => rotate(signals.isEmpty ? [
  "ยังไม่มีหลักฐาน แปะยังไม่ตั้งฉายามั่ว 555",
  "มื้อแรกมาเมื่อไหร่ เดี๋ยวแปะตั้งให้แบบมีชั้นเชิง",
] : [
  "พรุ่งนี้มาดูกันใหม่ แปะรออยู่ 555+",
  "อั๊วะจดไว้แล้ว พรุ่งนี้มาดูว่าอีโวไหม",
]);

const nutritionFooter = (signals) => rotate(signals.isEmpty ? [
  "ส่งมื้อแรกมา เดี๋ยวแปะเปิดโพยให้",
  "ยังไม่มีโพยให้เปิด แปะรอมื้อแรกอยู่",
] : signals.lowProtein ? [
  "โปรตีนยังบางไปนิด มื้อต่อไปเติมหน่อย แปะว่าเวิร์ก",
  "เติมไข่/ปลา/ไก่หน่อย โพยจะสวยขึ้นทันที",
] : [
  "ตัวเลขไม่ตีกันมาก อั๊วะว่าโอเคอยู่",
  "คุมแบบนี้ต่อได้ แต่อย่าชะล่าใจนะลื้อ",
]);

const diagnoseMainCulprit = (signals) => {
  if (signals.isEmpty) return { label: "ยังไม่มีหลักฐาน", detail: "วันนี้โต๊ะยังโล่ง แปะรอดูมื้อแรกอยู่" };
  if (signals.isOver && signals.highFat) return { label: "ของทอด/มันขึ้นนำ", detail: "ไอหยา แคลกับไขมันมาพร้อมกัน มื้อต่อไปตัดของทอดก่อน" };
  if (signals.isOver) return { label: "แคลเกินเป้า", detail: "วันนี้ใจใหญ่ไปนิด แต่ยังตั้งหลักใหม่ได้" };
  if (signals.sweetSignal) return { label: "หวานมีซีน", detail: "น้ำหวาน/ของหวานมีบทอยู่ แปะเห็นนะ" };
  if (signals.highFat) return { label: "ไขมันออกหน้า", detail: "ของมันมาแบบไม่หลบ แปะเหล่อยู่" };
  if (signals.highCarb) return { label: "คาร์บนำทาง", detail: "แป้งนำทีม วันนี้ลื้อมาแนวอิ่มจริง" };
  if (signals.lowProtein) return { label: "โปรตีนยังบาง", detail: "ทรงรวมโอเค เติมโปรตีนอีกหน่อยจะสวย" };
  return { label: "ทรงยังนิ่ง", detail: "วันนี้ดูเรียบร้อย แปะให้ผ่านแบบยิ้ม ๆ" };
};

const characterPanel = ({ titleCard, signals, stickerUrl }) => ({
  type: "box",
  layout: "horizontal",
  backgroundColor: signals.isOver ? palette.softRed : palette.sky,
  cornerRadius: "22px",
  paddingAll: "14px",
  margin: "md",
  spacing: "10px",
  contents: [
    { type: "box", layout: "vertical", width: "76px", height: "76px", contents: [stickerImage(stickerUrl, "76px")] },
    { type: "box", layout: "vertical", flex: 1, contents: [
      text({ text: "ฉายาลื้อจากแปะ", size: "xs", weight: "bold", color: palette.muted, wrap: true }),
      text({ text: formatDailyTitle(titleCard.name), size: "lg", weight: "bold", color: titleCard.color || palette.brown, wrap: true, maxLines: 3 }),
    ]},
  ],
});

export const buildFoodAuraFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const titleCard = getDailyTitle(signals, summary);
  const stickerUrl = stickerUrlForSignals(signals);
  const footerStickerUrl = stickerUrlForSignals(signals, { flipped: true });
  return {
    type: "flex",
    altText: "ฉายาวันนี้",
    contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", backgroundColor: palette.cream, paddingAll: "18px", contents: [
      text({ text: `ฉายาลื้อจากแปะ · ${getRarityLabel(titleCard.rarity)}`, size: "sm", weight: "bold", color: titleCard.color || palette.orange, wrap: true }),
      text({ text: formatDailyTitle(titleCard.name), size: "xxl", weight: "bold", color: titleCard.color || palette.brown, wrap: true, margin: "xs", maxLines: 3 }),
      characterPanel({ titleCard, signals, stickerUrl }),
      text({ text: signals.isEmpty ? "ส่งมื้อแรกมาก่อน เดี๋ยวแปะตั้งฉายาให้" : "อั๊วะพูดจริงไม่ได้โม้~", size: "md", color: palette.brown, weight: "bold", wrap: true, margin: "md" }),
      speechBubbleFooter(titleFooter(signals), palette.blue, footerStickerUrl),
    ] } },
  };
};

export const buildFoodWrappedFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const culprit = diagnoseMainCulprit(signals);
  const stickerUrl = stickerUrlForSignals(signals);
  const footerStickerUrl = stickerUrlForSignals(signals, { flipped: true });
  const topMealText = signals.topMeal ? `${truncate(signals.topMeal, 28)}${signals.topMealKcal > 0 ? ` · ~${Math.round(signals.topMealKcal)} kcal` : ""}` : "ยังไม่มีมื้อเด่น";
  return {
    type: "flex",
    altText: "วันนี้อาหารฟ้องว่า…",
    contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", backgroundColor: palette.cream, paddingAll: "18px", contents: [
      { type: "box", layout: "horizontal", spacing: "10px", contents: [
        { type: "box", layout: "vertical", width: "64px", height: "64px", contents: [stickerImage(stickerUrl, "64px")] },
        { type: "box", layout: "vertical", flex: 1, contents: [
          text({ text: "วันนี้อาหารฟ้องว่า…", size: "sm", weight: "bold", color: palette.orange }),
          text({ text: culprit.label, size: "xl", weight: "bold", color: signals.isOver ? palette.red : palette.brown, wrap: true }),
        ]},
      ]},
      evidenceBox([`มื้อเด่น: ${topMealText}`, `รวมวันนี้: ${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`], "หลักฐานบนโต๊ะ"),
      text({ text: culprit.detail, size: "md", color: palette.brown, weight: "bold", wrap: true, margin: "md" }),
      speechBubbleFooter(wrappedFooter(signals), palette.blue, footerStickerUrl),
    ] } },
  };
};

export const buildCalorieSummaryFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const titleCard = getDailyTitle(signals, summary);
  const userName = resolveUserName(summary);
  const left = Math.max(signals.target - signals.kcal, 0);
  const over = Math.max(signals.kcal - signals.target, 0);
  const stickerUrl = stickerUrlForSignals(signals);
  const footerStickerUrl = stickerUrlForSignals(signals, { flipped: true });
  const topMealText = signals.topMeal ? `${truncate(signals.topMeal, 28)}${signals.topMealKcal > 0 ? ` · ~${Math.round(signals.topMealKcal)} kcal` : ""}` : "ยังไม่มีมื้อเด่น";
  const statusText = signals.isEmpty ? "เอ้า วันนี้ยังไม่มีข้อมูลเลย" : signals.isOver ? "ไอหยา วันนี้ถังเต็มแล้วนะ" : `โอเค เหลืออีก ${Math.round(left)} kcal`;
  const titleText = formatDailyTitle(titleCard.name);

  return {
    type: "flex",
    altText: "สรุปวันนี้",
    contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", backgroundColor: palette.cream, paddingAll: "12px", contents: [
      recapHeroTitle({ userName, rarityLabel: getRarityLabel(titleCard.rarity), titleCard, titleText, stickerUrl }),
      { type: "box", layout: "vertical", backgroundColor: palette.card, cornerRadius: "18px", paddingAll: "12px", margin: "sm", spacing: "xs", contents: [
        text({ text: statusText, size: "xl", weight: "bold", color: signals.isOver ? palette.red : palette.green, wrap: true, maxLines: 2 }),
        { type: "separator", color: "#E5D3C8", margin: "xs" },
        metricRow("กินไป", `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal`, signals.isOver ? palette.red : palette.text),
        metricRow("คาร์บ", `${Math.round(signals.carb)} g`),
        metricRow("โปรตีน", `${Math.round(signals.protein)} g`, signals.lowProtein ? palette.orange : palette.green),
        metricRow("ไขมัน", `${Math.round(signals.fat)} g`, signals.highFat ? palette.orange : palette.text),
        metricRow("น้ำตาล", `${Math.round(signals.sugar)} g`, signals.sweetSignal ? palette.orange : palette.text),
        metricRow("จำนวนมื้อ", `${Math.round(signals.mealCount)} มื้อ`),
      ]},
      fullInfoPill({ title: "เป้าหมาย", value: signals.isEmpty ? "ยังไม่มีข้อมูลวันนี้" : signals.isOver ? `เกิน ${Math.round(over)} kcal` : `เหลือ ${Math.round(left)} kcal`, bg: signals.isOver ? palette.softRed : palette.mint, color: signals.isOver ? palette.red : palette.brown }),
      fullInfoPill({ title: "มื้อเด่น", value: topMealText, bg: palette.sky, color: palette.brown }),
      speechBubbleFooter(calorieFooter(signals), signals.isOver ? palette.red : palette.blue, footerStickerUrl),
    ] } },
  };
};

export const buildNutritionFlexMessage = ({ summary = {} } = {}) => {
  const signals = getSummarySignals(summary);
  const left = Math.max(signals.target - signals.kcal, 0);
  const stickerUrl = stickerUrlForSignals(signals);
  const footerStickerUrl = stickerUrlForSignals(signals, { flipped: true });
  return {
    type: "flex",
    altText: "โภชนาการวันนี้",
    contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", backgroundColor: palette.cream, paddingAll: "18px", contents: [
      { type: "box", layout: "horizontal", spacing: "10px", contents: [
        { type: "box", layout: "vertical", width: "64px", height: "64px", contents: [stickerImage(stickerUrl, "64px")] },
        { type: "box", layout: "vertical", flex: 1, contents: [
          text({ text: "แปะเปิดโพยโภชนาการให้", size: "xl", weight: "bold", color: palette.text, wrap: true }),
          text({ text: signals.isEmpty ? "วันนี้ยังไม่มีมื้อที่แปะจดไว้เลย" : `${Math.round(signals.kcal)} / ${Math.round(signals.target)} kcal · เหลือ ${Math.round(left)} kcal`, size: "sm", color: signals.isOver ? palette.red : palette.green, weight: "bold", wrap: true, margin: "sm" }),
        ]},
      ]},
      evidenceBox([`คาร์บ ${Math.round(signals.carb)} g`, `โปรตีน ${Math.round(signals.protein)} g`, `ไขมัน ${Math.round(signals.fat)} g`, `น้ำตาล ${Math.round(signals.sugar)} g`, signals.topMeal ? `มื้อเด่น: ${truncate(signals.topMeal, 28)}` : "มื้อเด่นยังไม่มี"], "แปะจับตัวเลขมาให้"),
      speechBubbleFooter(nutritionFooter(signals), palette.blue, footerStickerUrl),
    ] } },
  };
};
