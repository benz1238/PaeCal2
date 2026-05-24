import { DEFAULT_CALORIE_TARGET, EMPTY_PROGRESS, safeNumber } from "./helpers.js";

export const buildProgressBar = (total, target) => {
  const totalKcal = safeNumber(total, 0);
  const calorieTarget = safeNumber(target, DEFAULT_CALORIE_TARGET);
  const percent = calorieTarget > 0 ? totalKcal / calorieTarget : 0;

  const blocks = Math.min(Math.round(percent * 10), 10);
  const emptyBlocks = 10 - blocks;

  let barEmoji = "🟢";

  if (percent >= 1) {
    barEmoji = "🔴";
  } else if (percent >= 0.8) {
    barEmoji = "🟠";
  }

  return barEmoji.repeat(blocks) + "⚪".repeat(emptyBlocks);
};

export const getSmartMealAdvice = ({
  title,
  kcal,
  carb,
  protein,
  fat,
  total,
  calorieTarget,
}) => {
  const mealKcal = safeNumber(kcal, 0);
  const mealCarb = safeNumber(carb, 0);
  const mealProtein = safeNumber(protein, 0);
  const mealFat = safeNumber(fat, 0);
  const totalKcal = safeNumber(total, mealKcal);
  const target = safeNumber(calorieTarget, DEFAULT_CALORIE_TARGET);
  const percent = target > 0 ? totalKcal / target : 0;

  if (percent >= 1.2) {
    return `วันนี้เกินเป้าไปเยอะแล้วนะ ${title} 😅 ไม่ต้องเครียดน้า มื้อถัดไปแปะแนะนำเบาๆ เน้นโปรตีนกับผักก่อนจ้า`;
  }

  if (percent >= 1) {
    return `วันนี้แตะเกินเป้าแล้วนะ ${title} 🛑 มื้อถัดไปขอเป็นต้ม/ย่าง/น้ำใส จะบาลานซ์กว่าจ้า`;
  }

  if (mealFat >= 35) {
    return `มื้อนี้ไขมันค่อนข้างแน่นแล้วนะ ${title} มื้อหน้าลองลดของทอด แล้วเลือกโปรตีนย่าง/ต้มแทนจะดีมากจ้า`;
  }

  if (mealCarb >= 85) {
    return `มื้อนี้คาร์บมาแน่นอยู่นะ ${title} 🍚 มื้อหน้าลองลดข้าว/เส้นนิดนึง แล้วเพิ่มโปรตีนกับผักจะบาลานซ์ขึ้นจ้า`;
  }

  if (mealProtein < 20 && mealKcal >= 400) {
    return `มื้อนี้โปรตีนยังน้อยไปนิดนะ ${title} มื้อหน้าลองเติมไข่ต้ม อกไก่ เต้าหู้ หรือปลาเข้าไปหน่อยจ้า`;
  }

  if (percent >= 0.8) {
    return `วันนี้ใกล้เต็มเป้าแล้วนะ ${title} 🟠 มื้อถัดไปเอาเบาๆ แต่ไม่ต้องอดนะ แปะช่วยดูให้จ้า`;
  }

  return `มื้อนี้โอเคอยู่นะ ${title} กินให้อร่อย แล้วเดี๋ยวแปะช่วยบาลานซ์มื้อถัดไปให้จ้า ❤️`;
};

export const getFoodLogText = ({
  menuName,
  kcal,
  carb,
  protein,
  fat,
  total,
  calorieTarget,
}) => {
  const mealKcal = safeNumber(kcal, 0);
  const totalKcal = safeNumber(total, mealKcal);
  const target = safeNumber(calorieTarget, DEFAULT_CALORIE_TARGET);
  const progress = buildProgressBar(totalKcal, target);

  return `🔍 ${menuName}
จานนี้มีแคลอรี่ประมาณ ${mealKcal} kcal! 🍚

🍚 คาร์โบไฮเดรต ${safeNumber(carb, 0)} g
💪 โปรตีน ${safeNumber(protein, 0)} g
💧 ไขมัน ${safeNumber(fat, 0)} g

📊 สถานะวันนี้:
(${progress})
🔥 กินไปแล้วรวม: ${totalKcal} / ${target} kcal จ้า!`;
};

export const getSummaryText = ({ title, summary }) => {
  const total = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const progress = buildProgressBar(total, target) || EMPTY_PROGRESS;
  const percent = target > 0 ? total / target : 0;

  let note = "";

  if (percent >= 1.2) {
    note = `\n\nวันนี้เกินเป้าไปเยอะแล้วนะ ${title} 😅 มื้อถัดไปขอเบาๆ เน้นโปรตีนกับผักก่อนจ้า`;
  } else if (percent >= 1) {
    note = `\n\nวันนี้เกินเป้าแล้วนะ ${title} 🛑 มื้อถัดไปเลือกต้ม/ย่าง/น้ำใส จะบาลานซ์กว่าจ้า`;
  } else if (percent >= 0.8) {
    note = `\n\nใกล้เต็มเป้าแล้วนะ ${title} 🟠 มื้อถัดไปเอาเบาๆ แต่ไม่ต้องอดน้า`;
  } else {
    note = `\n\nวันนี้ยังบาลานซ์ได้อยู่นะ ${title} เดี๋ยวแปะช่วยดูต่อให้จ้า ❤️`;
  }

  return `📊 สรุปวันนี้ของ${title}

(${progress})

🔥 กินไปแล้วรวม: ${total} / ${target} kcal

🍚 คาร์บรวม ${summary.totalCarb || 0} g
💪 โปรตีนรวม ${summary.totalProtein || 0} g
💧 ไขมันรวม ${summary.totalFat || 0} g${note}`;
};

export const getMealSuggestionText = ({ title, summary }) => {
  const eaten = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const left = Math.max(target - eaten, 0);

  let suggestion = "";

  if (left >= 700) {
    suggestion =
      "ตอนนี้ยังมีพื้นที่ให้กินได้อยู่จ้า ลองเป็นข้าว + โปรตีนดีๆ เช่น ข้าวอกไก่ ไข่ต้ม กะเพราไม่มัน หรือสุกี้น้ำก็ได้";
  } else if (left >= 400) {
    suggestion =
      "แนะนำมื้อพอดีๆ เช่น สุกี้น้ำไก่ ยำทูน่า เกาเหลา + ข้าวนิดหน่อย หรือข้าวไข่ต้มเพิ่มผัก";
  } else if (left > 0) {
    suggestion =
      "วันนี้เหลือแคลไม่เยอะแล้วน้า ลองเป็นไข่ต้ม โยเกิร์ตไม่หวาน เต้าหู้ หรือสลัดโปรตีนเบาๆ";
  } else {
    suggestion =
      "วันนี้แคลเต็มแล้วจ้า ถ้าหิวจริงๆ เอาแบบเบามากๆ เช่น ไข่ต้ม น้ำเปล่า หรือผักลวกนะลูก";
  }

  return `${title} วันนี้เหลือประมาณ ${left} kcal นะ 🍚

${suggestion}

ส่งรูปอาหารมาก็ได้ เดี๋ยวแปะดูแคลให้จ้า 📸`;
};
