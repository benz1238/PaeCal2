// PaeCal V2 - Personal Metabolism Engine (NO AI CORE)
// Goal: adaptive TDEE without external AI cost

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calcBMR({ weight, height, age, gender }) {
  // Mifflin-St Jeor (deterministic)
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calcActivityFactor(logs = []) {
  const kcalList = logs.map(l => l.kcal || 0);
  const a = avg(kcalList);

  if (a < 1800) return 1.2;
  if (a < 2200) return 1.35;
  if (a < 2600) return 1.5;
  return 1.7;
}

function calcTrend(logs = []) {
  if (logs.length < 3) return 0;
  const recent = logs.slice(-3).map(l => l.kcal);
  const older = logs.slice(-6, -3).map(l => l.kcal);

  return avg(recent) - avg(older || []);
}

export function computeMetabolism(userProfile, logs = []) {
  const bmr = calcBMR(userProfile);
  const activity = calcActivityFactor(logs);
  const tdee = bmr * activity;

  const trend = calcTrend(logs);

  let adaptiveTDEE = tdee;

  if (trend < -200) adaptiveTDEE *= 0.97;
  if (trend > 200) adaptiveTDEE *= 1.03;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    adaptiveTDEE: Math.round(adaptiveTDEE),
    trend,
    mode: "v2_metabolism_engine"
  };
}
