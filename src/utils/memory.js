import { safeNumber } from "./helpers.js";

export const MEMORY_WINDOW_DAYS = 7;

const normalizeMealName = (meal) =>
  String(meal?.menuName || meal?.foodName || meal?.name || meal?.title || "").trim();

const includesAny = (text, words) => {
  const lower = String(text || "").toLowerCase();
  return words.some((word) => lower.includes(word));
};

const FRIED_WORDS = [
  "ทอด",
  "กรอบ",
  "ไข่ดาว",
  "หมูกรอบ",
  "ไก่กรอบ",
  "ไก่ทอด",
  "เฟรนช์ฟราย",
  "fried",
];

const SWEET_WORDS = [
  "หวาน",
  "ชาไทย",
  "ชานม",
  "โกโก้",
  "น้ำหวาน",
  "เค้ก",
  "ขนม",
  "โดนัท",
  "ไอศกรีม",
  "ไอติม",
  "บิงซู",
  "ลาเต้",
  "กาแฟเย็น",
];

const LIQUID_CAL_WORDS = [
  "ชาไทย",
  "ชานม",
  "โกโก้",
  "กาแฟเย็น",
  "ลาเต้",
  "น้ำหวาน",
  "น้ำอัดลม",
  "ปั่น",
];

const PROTEIN_WORDS = [
  "ไก่",
  "อกไก่",
  "ปลา",
  "ไข่",
  "หมู",
  "เนื้อ",
  "เต้าหู้",
  "ทูน่า",
  "กุ้ง",
  "ปลาหมึก",
];

const cleanFoodName = (name = "") => String(name).trim().replace(/\s+/g, " ").slice(0, 40);

const toMealList = ({ summary = {}, meals = [], fallbackMeal = null } = {}) => {
  if (Array.isArray(meals) && meals.length) return meals;
  if (Array.isArray(summary.meals) && summary.meals.length) return summary.meals;
  if (fallbackMeal && normalizeMealName(fallbackMeal)) return [fallbackMeal];
  return [];
};

const isLateMeal = (meal = {}) => {
  const raw = meal.createdAt || meal.updatedAt || meal.dateTime || meal.timestamp || meal.time || "";
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const hour = date.getHours();
  return hour >= 21 || hour <= 3;
};

export const getMealMemoryTags = (meal = {}) => {
  const menuName = normalizeMealName(meal);
  const kcal = safeNumber(meal.kcal ?? meal.estimatedCalories, 0);
  const protein = safeNumber(meal.protein, 0);
  const carb = safeNumber(meal.carb ?? meal.carbs, 0);
  const fat = safeNumber(meal.fat, 0);

  return {
    menuName,
    isFried: includesAny(menuName, FRIED_WORDS) || fat >= 35,
    isSweet: includesAny(menuName, SWEET_WORDS),
    isLiquidCalories: includesAny(menuName, LIQUID_CAL_WORDS),
    hasProteinSignal: includesAny(menuName, PROTEIN_WORDS) || protein >= 25,
    isHeavy: kcal >= 700,
    isVeryHeavy: kcal >= 900,
    highCarb: carb >= 85,
    highFat: fat >= 35,
    proteinGood: protein >= 30,
  };
};

export const summarizeMealMemory = (meals = []) => {
  const list = Array.isArray(meals) ? meals : [];
  const tagged = list.map((meal) => ({ meal, tags: getMealMemoryTags(meal) }));

  const friedCount = tagged.filter((item) => item.tags.isFried).length;
  const sweetCount = tagged.filter((item) => item.tags.isSweet).length;
  const liquidCaloriesCount = tagged.filter((item) => item.tags.isLiquidCalories).length;
  const heavyCount = tagged.filter((item) => item.tags.isHeavy).length;
  const proteinGoodCount = tagged.filter((item) => item.tags.proteinGood).length;

  const lastMeal = list[list.length - 1] || null;
  const repeatedMenuMap = new Map();

  for (const meal of list) {
    const name = normalizeMealName(meal);
    if (!name) continue;
    const shortName = cleanFoodName(name);
    repeatedMenuMap.set(shortName, (repeatedMenuMap.get(shortName) || 0) + 1);
  }

  const repeatedMenus = [...repeatedMenuMap.entries()]
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topKcalMeal = [...list].sort((a, b) => safeNumber(b.kcal) - safeNumber(a.kcal))[0] || null;
  const topFatMeal = [...list].sort((a, b) => safeNumber(b.fat) - safeNumber(a.fat))[0] || null;
  const topProteinMeal = [...list].sort((a, b) => safeNumber(b.protein) - safeNumber(a.protein))[0] || null;

  return {
    mealCount: list.length,
    friedCount,
    sweetCount,
    liquidCaloriesCount,
    heavyCount,
    proteinGoodCount,
    lastMeal,
    repeatedMenus,
    topKcalMeal,
    topFatMeal,
    topProteinMeal,
    hasFriedPattern: friedCount >= 2,
    hasSweetPattern: sweetCount >= 2,
    hasLiquidCaloriePattern: liquidCaloriesCount >= 1,
    hasHeavyPattern: heavyCount >= 2,
    hasProteinWin: proteinGoodCount >= 1,
  };
};

export const getContextMemoryLine = (memory = {}) => {
  if (memory.hasSweetPattern) return "ช่วงนี้หวานแอบถี่นะ แปะเริ่มเหล่แล้ว 👀";
  if (memory.hasFriedPattern) return "ของทอด/ของมันมาใกล้กันหลายรอบแล้วนะ 👀";
  if (memory.hasHeavyPattern) return "วันนี้มีมื้อหนักหลายดอกอยู่ แปะจดไว้แล้ว 😂";
  if (memory.hasLiquidCaloriePattern) return "แคลจากเครื่องดื่มนี่ชอบมาเงียบ ๆ นะเฮีย 🧋";
  if (memory.hasProteinWin) return "แต่โปรตีนวันนี้มีแววดีนะ อันนี้แปะชม 💪";
  return "วันนี้ยังพออ่านเกมได้อยู่ แปะดูให้อยู่ 😄";
};

const decideDailyMoodTag = ({ mealCount, totalKcal, heavyCount, sweetCount, friedCount, proteinLowCount, lateMealCount }) => {
  if (mealCount <= 0) return "no_data";
  if (heavyCount >= 2 || totalKcal >= 2200) return "heavy_day";
  if (sweetCount >= 2) return "sweet_day";
  if (friedCount >= 2) return "fried_day";
  if (proteinLowCount >= 2) return "protein_light";
  if (lateMealCount >= 1) return "late_meal";
  return "balanced";
};

const buildDailySummaryText = ({ mealCount, heavyCount, sweetCount, friedCount, proteinLowCount, lateMealCount }) => {
  if (mealCount <= 0) return "วันนี้ยังไม่มีข้อมูลมื้ออาหาร";
  if (heavyCount >= 2) return "วันนี้มื้อหนักมาเยอะนิดนึง";
  if (sweetCount >= 2) return "วันนี้หวานโผล่มาบ่อยหน่อย";
  if (friedCount >= 2) return "วันนี้ของทอดมาค่อนข้างชัด";
  if (proteinLowCount >= 2) return "วันนี้โปรตีนดูเบาไปนิด";
  if (lateMealCount >= 1) return "วันนี้มีมื้อดึกนิดนึง";
  return "วันนี้รวม ๆ ยังโอเคอยู่";
};

export const buildDailyMemorySnapshot = ({ userId, date, summary = {}, meals = [], fallbackMeal = null } = {}) => {
  const mealList = toMealList({ summary, meals, fallbackMeal });
  const totalKcal = safeNumber(
    summary.todayCalories ?? summary.totalToday ?? summary.totalKcal ?? summary.kcal,
    mealList.reduce((sum, meal) => sum + safeNumber(meal.kcal ?? meal.estimatedCalories, 0), 0)
  );

  const counts = mealList.reduce(
    (acc, meal) => {
      const tags = getMealMemoryTags(meal);
      if (tags.isHeavy) acc.heavyCount += 1;
      if (tags.isSweet) acc.sweetCount += 1;
      if (tags.isFried) acc.friedCount += 1;
      if (!tags.hasProteinSignal && safeNumber(meal.kcal ?? meal.estimatedCalories, 0) >= 300) acc.proteinLowCount += 1;
      if (isLateMeal(meal)) acc.lateMealCount += 1;

      const name = cleanFoodName(tags.menuName);
      if (name) acc.foodNames.push(name);
      return acc;
    },
    { heavyCount: 0, sweetCount: 0, friedCount: 0, proteinLowCount: 0, lateMealCount: 0, foodNames: [] }
  );

  const mealCount = safeNumber(summary.mealCount, mealList.length);
  const moodTag = decideDailyMoodTag({ totalKcal, mealCount, ...counts });
  const summaryText = buildDailySummaryText({ mealCount, ...counts });

  return {
    userId: String(userId || ""),
    date: String(date || ""),
    totalKcal,
    mealCount,
    heavyCount: counts.heavyCount,
    sweetCount: counts.sweetCount,
    friedCount: counts.friedCount,
    proteinLowCount: counts.proteinLowCount,
    lateMealCount: counts.lateMealCount,
    topFoods: counts.foodNames.slice(-5).join(", "),
    moodTag,
    summaryText,
    updatedAt: new Date().toISOString(),
  };
};

const parseTopFoods = (value = "") =>
  String(value || "")
    .split(",")
    .map((item) => cleanFoodName(item))
    .filter(Boolean);

const getRepeatedFoods = (foods = []) => {
  const map = new Map();
  for (const food of foods) {
    const key = cleanFoodName(food);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return [...map.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
};

export const build7DayMemorySummary = (rows = []) => {
  const list = Array.isArray(rows) ? rows.slice(-MEMORY_WINDOW_DAYS) : [];
  const totals = {
    days: list.length,
    totalKcal: 0,
    mealCount: 0,
    heavyCount: 0,
    sweetCount: 0,
    friedCount: 0,
    proteinLowCount: 0,
    lateMealCount: 0,
  };
  const foods = [];

  for (const row of list) {
    totals.totalKcal += safeNumber(row.totalKcal, 0);
    totals.mealCount += safeNumber(row.mealCount, 0);
    totals.heavyCount += safeNumber(row.heavyCount, 0);
    totals.sweetCount += safeNumber(row.sweetCount, 0);
    totals.friedCount += safeNumber(row.friedCount, 0);
    totals.proteinLowCount += safeNumber(row.proteinLowCount, 0);
    totals.lateMealCount += safeNumber(row.lateMealCount, 0);
    foods.push(...parseTopFoods(row.topFoods));
  }

  const avgKcal = totals.days > 0 ? Math.round(totals.totalKcal / totals.days) : 0;
  const patternTags = [];
  if (totals.heavyCount >= 4) patternTags.push("heavy_often");
  if (totals.sweetCount >= 4) patternTags.push("sweet_often");
  if (totals.friedCount >= 4) patternTags.push("fried_often");
  if (totals.proteinLowCount >= 4) patternTags.push("protein_low_often");
  if (totals.lateMealCount >= 3) patternTags.push("late_meal_often");
  if (!patternTags.length && totals.days > 0) patternTags.push("mostly_balanced");

  return {
    ...totals,
    avgKcal,
    repeatedFoods: getRepeatedFoods(foods),
    patternTags,
  };
};

export const shouldMention7DayMemory = ({ memory7 = {}, decision = {} } = {}) => {
  const days = safeNumber(memory7?.days, 0);

  // Do not make the bot sound fake when the app only has 1-2 days of data.
  // Persistent memory should feel earned, not like surveillance.
  if (days < 4) return false;

  if (decision.type === "daily_recap" || decision.type === "meal_suggestion") return true;

  const tags = Array.isArray(memory7.patternTags) ? memory7.patternTags : [];
  const signals = decision.signals || {};

  if (signals.sweetSignal && tags.includes("sweet_often")) return true;
  if ((signals.friedSignal || signals.highFat) && tags.includes("fried_often")) return true;
  if (signals.lowProtein && tags.includes("protein_low_often")) return true;
  if (signals.isHeavy && tags.includes("heavy_often")) return true;

  return false;
};

export const get7DayMemoryLine = (memory7 = {}) => {
  if (safeNumber(memory7?.days, 0) < 4) return "";

  const tags = Array.isArray(memory7.patternTags) ? memory7.patternTags : [];

  if (tags.includes("sweet_often")) return "ช่วงนี้หวานโผล่บ่อยนะ แปะเห็นอยู่ 👀";
  if (tags.includes("fried_often")) return "ช่วงนี้ของทอดมาถี่นิดนึงนะ";
  if (tags.includes("protein_low_often")) return "ช่วงนี้โปรตีนดูเบาไปหน่อย รอบหน้าเติมนิดก็สวย";
  if (tags.includes("heavy_often")) return "ช่วงนี้มื้อหนักมาถี่นิดนึง เดี๋ยวค่อยดึงกลับแบบไม่เครียด";
  if (tags.includes("late_meal_often")) return "ช่วงนี้มื้อดึกแอบมีบ่อยนะ เอาแบบเบา ๆ จะนอนสบายกว่า";

  const repeated = Array.isArray(memory7.repeatedFoods) ? memory7.repeatedFoods[0] : null;
  if (repeated?.name) return `${repeated.name} โผล่มาซ้ำอยู่เหมือนกันนะ แปะจำได้ 😄`;

  return "";
};

export const format7DayMemoryForPrompt = (memory7 = {}) => {
  if (!memory7?.days) return "No 7-day food memory yet. Do not pretend to remember past meals.";

  const lines = [
    `7-day memory available: ${memory7.days} day(s).`,
    `Average daily kcal: around ${memory7.avgKcal || 0}.`,
    `Heavy meals: ${memory7.heavyCount || 0}.`,
    `Sweet food/drinks: ${memory7.sweetCount || 0}.`,
    `Fried food: ${memory7.friedCount || 0}.`,
    `Low-protein meals: ${memory7.proteinLowCount || 0}.`,
    `Late meals: ${memory7.lateMealCount || 0}.`,
  ];

  if (Array.isArray(memory7.repeatedFoods) && memory7.repeatedFoods.length) {
    lines.push(`Repeated foods: ${memory7.repeatedFoods.map((item) => item.name).join(", ")}.`);
  }

  if (Array.isArray(memory7.patternTags) && memory7.patternTags.length) {
    lines.push(`Pattern tags: ${memory7.patternTags.join(", ")}.`);
  }

  lines.push("Use this gently. Never shame, judge, or mention body shape.");
  return lines.join("\n");
};
