import {
  buildDailyMemorySnapshot,
  build7DayMemorySummary,
  get7DayMemoryLine,
  shouldMention7DayMemory,
} from "./src/utils/memory.js";
import { decideFoodLog } from "./src/utils/decision.js";

const meal = { menuName: "ไก่ทอดกับชาไทย", kcal: 820, carb: 90, protein: 22, fat: 40 };
const snapshot = buildDailyMemorySnapshot({
  userId: "U_TEST",
  date: "2026-05-25",
  summary: { todayCalories: 1800, mealCount: 3 },
  meals: [meal, { menuName: "เค้ก", kcal: 450, carb: 60, protein: 5, fat: 20 }],
});

if (snapshot.userId !== "U_TEST") throw new Error("snapshot userId failed");
if (snapshot.sweetCount < 2) throw new Error("sweet count failed");

const memory7 = build7DayMemorySummary([snapshot, snapshot, snapshot, snapshot]);
if (!memory7.patternTags.includes("sweet_often")) throw new Error("7-day sweet pattern failed");

const decision = decideFoodLog({ meal, summary: { todayCalories: 1800, calorieTarget: 2300, memory7 } });
if (!shouldMention7DayMemory({ memory7, decision })) throw new Error("mention rule failed");
if (!get7DayMemoryLine(memory7)) throw new Error("memory line failed");

console.log("Memory phase local tests passed");
