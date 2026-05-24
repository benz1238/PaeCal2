export const DEFAULT_CALORIE_TARGET = 2300;
export const EMPTY_PROGRESS = "⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪";

export const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const isFemaleText = (gender) => {
  const genderText = String(gender || "").trim().toLowerCase();

  return (
    genderText.includes("หญิง") ||
    genderText.includes("ผู้หญิง") ||
    genderText === "ญ" ||
    genderText === "f" ||
    genderText.includes("female")
  );
};

export const calculateTDEE = (statsText) => {
  const parts = String(statsText || "").trim().split(/\s+/);

  const gender = parts[0] || "";
  const age = parseInt(parts[1], 10) || 30;
  const height = parseInt(parts[2], 10) || 165;
  const weight = parseInt(parts[3], 10) || 60;
  const female = isFemaleText(gender);

  const bmr = 10 * weight + 6.25 * height - 5 * age + (female ? -161 : 5);
  return Math.round(bmr * 1.375);
};
