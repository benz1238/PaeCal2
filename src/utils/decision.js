import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";
import { getMealMemoryTags, shouldMention7DayMemory, summarizeMealMemory } from "./memory.js";

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
  const memory = summarizeMealMemory(meals);
  const memory7 = summary.memory7 || null;

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
    memory,
    memory7,
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
  const tags = getMealMemoryTags(meal);

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
    friedSignal: tags.isFried,
    sweetSignal: tags.isSweet,
    liquidCaloriesSignal: tags.isLiquidCalories,
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

  const decision = { type: "food_log", day, signals, mood, action, emotion };
  return {
    ...decision,
    mention7DayMemory: shouldMention7DayMemory({ memory7: day.memory7, decision }),
  };
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

  const decision = {
    type: "meal_suggestion",
    day,
    wantsConvenience,
    mood,
    action,
    emotion,
  };

  return {
    ...decision,
    mention7DayMemory: shouldMention7DayMemory({ memory7: day.memory7, decision }),
  };
};

const getMealProblemScore = (meal = {}) => {
  const tags = getMealMemoryTags(meal);
  let score = 0;

  score += Math.round(safeNumber(meal.kcal, 0) / 120);
  score += tags.isFried ? 4 : 0;
  score += tags.isSweet ? 4 : 0;
  score += tags.highFat ? 3 : 0;
  score += tags.highCarb ? 2 : 0;
  score += tags.isLiquidCalories ? 2 : 0;

  return score;
};

export const decideDailyRecap = ({ summary = {} }) => {
  const day = getDayContext(summary);
  const meals = day.meals;
  const memory = day.memory;

  const problemMeal = [...meals]
    .sort((a, b) => getMealProblemScore(b) - getMealProblemScore(a))[0] || null;

  const proteinMeal = [...meals]
    .filter((meal) => safeNumber(meal.protein, 0) >= 20)
    .sort((a, b) => safeNumber(b.protein) - safeNumber(a.protein))[0] || null;

  let mood = "balanced_day";
  let emotion = "happy";

  if (day.isVeryOver || memory.hasHeavyPattern) {
    mood = "big_day";
    emotion = "over_calorie";
  } else if (day.isOver) {
    mood = "slightly_over";
    emotion = "over_calorie";
  } else if (memory.hasFriedPattern) {
    mood = "fried_pattern";
    emotion = "fried_heavy";
  } else if (memory.hasSweetPattern) {
    mood = "sweet_pattern";
    emotion = "sweet_heavy";
  } else if (day.isNearLimit) {
    mood = "near_limit";
    emotion = "thinking";
  } else if (day.goodProteinDay || memory.hasProteinWin) {
    mood = "protein_win";
    emotion = "protein_good";
  }

  const decision = {
    type: "daily_recap",
    day,
    meals,
    memory,
    problemMeal,
    proteinMeal,
    mood,
    emotion,
  };

  return {
    ...decision,
    mention7DayMemory: shouldMention7DayMemory({ memory7: day.memory7, decision }),
  };
};
