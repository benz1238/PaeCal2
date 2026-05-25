import { safeNumber } from "./helpers.js";

const normalizeMealName = (meal) => String(meal?.menuName || "").trim();

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

export const getMealMemoryTags = (meal = {}) => {
  const menuName = normalizeMealName(meal);
  const kcal = safeNumber(meal.kcal, 0);
  const protein = safeNumber(meal.protein, 0);
  const carb = safeNumber(meal.carb, 0);
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
    const shortName = name.replace(/\s+/g, " ").slice(0, 40);
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
  if (memory.hasSweetPattern) {
    return "ช่วงนี้หวานแอบถี่นะ แปะเริ่มเหล่แล้ว 👀";
  }

  if (memory.hasFriedPattern) {
    return "ของทอด/ของมันมาใกล้กันหลายรอบแล้วนะ 👀";
  }

  if (memory.hasHeavyPattern) {
    return "วันนี้มีมื้อหนักหลายดอกอยู่ แปะจดไว้แล้ว 😂";
  }

  if (memory.hasLiquidCaloriePattern) {
    return "แคลจากเครื่องดื่มนี่ชอบมาเงียบ ๆ นะเฮีย 🧋";
  }

  if (memory.hasProteinWin) {
    return "แต่โปรตีนวันนี้มีแววดีนะ อันนี้แปะชม 💪";
  }

  return "วันนี้ยังพออ่านเกมได้อยู่ แปะดูให้อยู่ 😄";
};
