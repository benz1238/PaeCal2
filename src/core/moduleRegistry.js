// PaeCal Module Registry (Single Source Import Map)
// Goal: eliminate ESM/CJS ambiguity + prevent wrong import paths

// ONLY place where core modules should be imported from

import { getNutrition } from "../utils/nutritionEngine.js";

export {
  getNutrition
};

// Future modules should be added ONLY here:
// export { computeMetabolism } from "../v2/metabolismEngine.js";
// export { predictHabits } from "../v3/habitEngine.js";
