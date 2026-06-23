// PaeCal Nutrition Engine (Single Source of Truth)
// Core rule: 1 menu = 1 base value (no stacking logic duplication)

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const MENU_DB = {
  "อกไก่ย่าง": { kcal: 200, protein: 35, fat: 5, carb: 0, type: "fixed" },
  "อกไก่ต้ม": { kcal: 180, protein: 35, fat: 3, carb: 0, type: "fixed" },
  "ไข่ต้ม": { kcal: 70, protein: 6, fat: 5, carb: 0, type: "fixed" },
  "ข้าวสวย": { kcal: 200, protein: 4, fat: 0, carb: 45, type: "fixed" },

  "ไก่คาราเกะ": { kcal: 260, protein: 16, fat: 15, carb: 10, type: "controlled" },
  "ข้าวไก่คาราเกะ": { kcal: 620, protein: 22, fat: 16, carb: 75, type: "controlled" },
  "ผัดไทย": { kcal: 550, protein: 18, fat: 18, carb: 70, type: "controlled" },
  "ก๋วยเตี๋ยว": { kcal: 450, protein: 18, fat: 10, carb: 65, type: "controlled" },

  "default": { kcal: 500, protein: 15, fat: 15, carb: 60, type: "estimated" },
};

function normalizeMenuName(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
}

function findBaseMenu(name = "") {
  const n = normalizeMenuName(name);

  for (const key of Object.keys(MENU_DB)) {
    if (key === "default") continue;
    if (n.includes(normalizeMenuName(key))) return MENU_DB[key];
  }

  return MENU_DB.default;
}

function applyModifier(base, modifiers = {}) {
  const multiplier = clamp(modifiers.multiplier || 1, 0.75, 1.25);

  return {
    kcal: Math.round(base.kcal * multiplier),
    protein: Math.round(base.protein * multiplier),
    fat: Math.round(base.fat * multiplier),
    carb: Math.round(base.carb * multiplier),
  };
}

function getNutrition(menuName, modifiers = {}) {
  const base = findBaseMenu(menuName);
  const final = applyModifier(base, modifiers);

  return {
    menuName,
    base,
    final,
    confidence: base.type,
    note:
      base.type === "fixed"
        ? "locked value"
        : base.type === "controlled"
        ? "range-based estimate"
        : "AI estimated",
  };
}

export {
  getNutrition,
  findBaseMenu,
  applyModifier,
  normalizeMenuName,
  MENU_DB
};