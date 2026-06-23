// PaeCal V3 - Habit Prediction Engine (NO AI CORE)
// Goal: detect risk patterns from behavior logs (cost-free)

function sum(arr) { return arr.reduce((a,b)=>a+b,0); }
function avg(arr) { return arr.length ? sum(arr)/arr.length : 0; }

function lastN(logs, n) {
  return logs.slice(-n);
}

function calcNightEating(logs=[]) {
  return logs.filter(l => (l.hour ?? 12) >= 21).length;
}

function calcOvereatDays(logs=[], target=2000) {
  const days = {};

  logs.forEach(l => {
    const d = (l.date || "").slice(0,10);
    days[d] = (days[d] || 0) + (l.kcal || 0);
  });

  return Object.values(days).filter(v => v > target).length;
}

function calcSugarSpike(logs=[]) {
  return avg(logs.map(l => l.sugar || 0));
}

function riskScore(logs=[]) {
  const recent = lastN(logs, 14);

  const night = calcNightEating(recent);
  const overeat = calcOvereatDays(recent);
  const sugar = calcSugarSpike(recent);

  let score = 0;

  score += night * 12;        // late eating risk
  score += overeat * 15;      // calorie overrun
  score += sugar * 0.5;       // sugar load

  score = Math.min(100, Math.round(score));

  return {
    score,
    level: score > 70 ? "high" : score > 40 ? "medium" : "low"
  };
}

export function predictHabits(logs=[]) {
  const risk = riskScore(logs);

  const suggestions = [];

  if (risk.level === "high") {
    suggestions.push("ลดมื้อดึก 1-2 วัน");
    suggestions.push("คุมหวานลงหน่อย");
  } else if (risk.level === "medium") {
    suggestions.push("ระวังของหวานช่วงเย็น");
  } else {
    suggestions.push("ดีมาก keep going");
  }

  return {
    ...risk,
    suggestions,
    mode: "v3_habit_engine"
  };
}