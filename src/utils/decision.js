import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";

const HIGH_CARB_MEAL = 85;
const HIGH_FAT_MEAL = 35;
const LOW_PROTEIN_MEAL = 20;
const HIGH_CARB_DAY = 220;
const HIGH_FAT_DAY = 80;
const GOOD_PROTEIN_DAY = 90;

export const getDayContext = (summary = {}) => {
  const eaten = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const left = Math.max(target - eaten, 0);
  const over = Math.max(eaten - target, 0);
  const percent = target > 0 ? eaten / target : 0;

  const carb = safeNumber(summary.totalCarb, 0);
  const protein = safeNumber(summary.totalProtein, 0);
  const fat = safeNumber(summary.totalFat, 0);
  const mealCount = safeNumber(summary.mealCount, 0);
  const meals = Array.isArray(summary.meals) ? summary.meals : [];

  return {
    eaten,
    target,
    left,
    over,
    percent,
    carb,
    protein,
    fat,
    mealCount,
    meals,
    isOver: percent >= 1,
    isVeryOver: percent >= 1.2,
    isNearLimit: percent >= 0.8 && percent < 1,
    isLowBudget: left > 0 && left <= 300,
    isMediumBudget: left > 300 && left <= 600,
    isHighBudget: left > 600,
    highCarbDay: carb >= HIGH_CARB_DAY,
    highFatDay: fat >= HIGH_FAT_DAY,
    goodProteinDay: protein >= GOOD_PROTEIN_DAY,
  };
};

export const getMealSignals = (meal = {}) => {
  const menuName = String(meal.menuName || "อาหาร");
  const kcal = safeNumber(meal.kcal, 0);
  const carb = safeNumber(meal.carb, 0);
  const protein = safeNumber(meal.protein, 0);
  const fat = safeNumber(meal.fat, 0);
  const lower = menuName.toLowerCase();

  const friedKeywords = ["ทอด", "ไข่ดาว", "กรอบ", "fried", "หมูกรอบ", "ไก่ทอด"];
  const sweetKeywords = ["หวาน", "ชาไทย", "ชานม", "น้ำหวาน", "เค้ก", "ขนม", "โกโก้", "กาแฟเย็น"];

  return {
    menuName,
    kcal,
    carb,
    protein,
    fat,
    isHeavy: kcal >= 700,
    isVeryHeavy: kcal >= 900,
    highCarb: carb >= HIGH_CARB_MEAL,
    highFat: fat >= HIGH_FAT_MEAL,
    lowProtein: protein < LOW_PROTEIN_MEAL && kcal >= 400,
    proteinGood: protein >= 30,
    friedSignal: friedKeywords.some((word) => lower.includes(word)),
    sweetSignal: sweetKeywords.some((word) => lower.includes(word)),
  };
};

export const decideFoodLog = ({ meal = {}, summary = {} }) => {
  const day = getDayContext(summary);
  const signals = getMealSignals(meal);

  let mood = "balanced";
  let action = "pass";
  let emotion = "happy";

  if (day.isVeryOver) {
    mood = "over_calorie_heavy";
    action = "warn_soft";
    emotion = "over_calorie";
  } else if (day.isOver) {
    mood = "over_calorie";
    action = "warn_soft";
    emotion = "over_calorie";
  } else if (signals.sweetSignal) {
    mood = "sweet_heavy";
    action = "tease_warn";
    emotion = "sweet_heavy";
  } else if (signals.friedSignal || signals.highFat) {
    mood = "fried_or_fat";
    action = "tease_warn";
    emotion = "fried_heavy";
  } else if (signals.proteinGood && !signals.isHeavy) {
    mood = "protein_good";
    action = "praise";
    emotion = "protein_good";
  } else if (signals.isHeavy) {
    mood = "heavy_meal";
    action = "soft_suggestion";
    emotion = "shocked";
  }

  return { type: "food_log", day, signals, mood, action, emotion };
};

export const decideMealSuggestion = ({ summary = {}, text = "" }) => {
  const day = getDayContext(summary);
  const lower = String(text || "").toLowerCase();
  const wantsConvenience = [
    "เซเว่น",
    "7-11",
    "7 eleven",
    "ร้านสะดวกซื้อ",
    "สะดวกซื้อ",
    "ซื้อง่าย",
    "ซื้อกินง่าย",
    "ออฟฟิศ",
    "ระหว่างทาง",
    "งบไม่เกิน",
  ].some((word) => lower.includes(word));

  let mood = "normal_suggestion";
  let action = "suggest_balanced";
  let emotion = "happy";

  if (day.isVeryOver) {
    mood = "over_calorie_heavy";
    action = "suggest_very_light";
    emotion = "over_calorie";
  } else if (day.isOver) {
    mood = "over_calorie";
    action = "suggest_light";
    emotion = "over_calorie";
  } else if (day.isLowBudget) {
    mood = "low_budget";
    action = "suggest_snack";
    emotion = "thinking";
  } else if (day.isMediumBudget) {
    mood = "medium_budget";
    action = "suggest_light_meal";
    emotion = "thinking";
  } else if (day.highFatDay) {
    mood = "high_fat_day";
    action = "suggest_low_fat";
    emotion = "fried_heavy";
  } else if (day.highCarbDay) {
    mood = "high_carb_day";
    action = "suggest_lower_carb";
    emotion = "thinking";
  }

  return {
    type: "meal_suggestion",
    day,
    wantsConvenience,
    mood,
    action,
    emotion,
  };
};

export const decideDailyRecap = ({ summary = {} }) => {
  const day = getDayContext(summary);
  const meals = day.meals;

  const sortedByKcal = [...meals].sort((a, b) => safeNumber(b.kcal) - safeNumber(a.kcal));
  const problemMeal = sortedByKcal[0] || null;
  const proteinMeal = [...meals].sort((a, b) => safeNumber(b.protein) - safeNumber(a.protein))[0] || null;

  let mood = "balanced_day";
  let emotion = "happy";

  if (day.isVeryOver) {
    mood = "big_day";
    emotion = "over_calorie";
  } else if (day.isOver) {
    mood = "slightly_over";
    emotion = "over_calorie";
  } else if (day.isNearLimit) {
    mood = "near_limit";
    emotion = "thinking";
  } else if (day.goodProteinDay) {
    mood = "protein_win";
    emotion = "protein_good";
  }

  return {
    type: "daily_recap",
    day,
    meals,
    problemMeal,
    proteinMeal,
    mood,
    emotion,
  };
};
