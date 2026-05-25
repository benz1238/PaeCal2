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

export const getSmartMealAdvice = ({ title, kcal, carb, protein, fat, total, calorieTarget }) => {
  const mealKcal = safeNumber(kcal, 0);
  const mealCarb = safeNumber(carb, 0);
  const mealProtein = safeNumber(protein, 0);
  const mealFat = safeNumber(fat, 0);
  const totalKcal = safeNumber(total, mealKcal);
  const target = safeNumber(calorieTarget, DEFAULT_CALORIE_TARGET);
  const percent = target > 0 ? totalKcal / target : 0;

  if (percent >= 1.2) {
    return `วันนี้ล้ำเส้นไปไกลแล้วนะ ${title} 😅\n\nถ้ายังหิวจริง ๆ\nเอาเบา ๆ พออยู่ท้องพอจ้า ❤️`;
  }

  if (percent >= 1) {
    return `วันนี้แตะเกินเป้าแล้วนะ ${title} 🟠\n\nมื้อถัดไปขอเบา ๆ หน่อย\nไม่ต้องแก้ชีวิต แค่ไม่ซ้ำหนักก็พอ 😂`;
  }

  if (mealFat >= 35) {
    return `มื้อนี้ไขมันค่อนข้างแน่นนะ ${title} 👀\n\nมื้อหน้าลองลดทอด/มันนิดนึง\nแปะว่าเอาอยู่จ้า`;
  }

  if (mealCarb >= 85) {
    return `มื้อนี้คาร์บมาแน่นเลยนะ ${title} 🍚\n\nมื้อหน้าลดข้าว/เส้นลงนิดนึง\nแล้วเติมโปรตีนกับผัก แค่นี้สวยละ`;
  }

  if (mealProtein < 20 && mealKcal >= 400) {
    return `มื้อนี้โปรตีนยังน้อยไปนิดนะ ${title} 💪\n\nมื้อหน้าหาไข่ต้ม ไก่ ปลา หรือเต้าหู้เติมหน่อย\nอยู่ท้องขึ้นเยอะเลยจ้า`;
  }

  if (percent >= 0.8) {
    return `วันนี้ใกล้เต็มเป้าแล้วนะ ${title} 🟠\n\nมื้อถัดไปเอาเบา ๆ\nแต่ไม่ต้องอดนะ เดี๋ยวแปะช่วยบาลานซ์ให้`;
  }

  return `มื้อนี้โอเคอยู่นะ ${title} 🍽️\n\nกินให้อร่อยได้เลย\nเดี๋ยวแปะช่วยบาลานซ์ต่อให้จ้า ❤️`;
};

export const getFoodLogText = ({ menuName, kcal, carb, protein, fat, total, calorieTarget }) => {
  const mealKcal = safeNumber(kcal, 0);
  const totalKcal = safeNumber(total, mealKcal);
  const target = safeNumber(calorieTarget, DEFAULT_CALORIE_TARGET);
  const progress = buildProgressBar(totalKcal, target);

  return `🔍 แปะดูให้แล้ว เมนูนี้น่าจะเป็น\n${menuName} 🍽️\n\nประมาณ ${mealKcal} kcal\n\n🍚 คาร์บ ${safeNumber(carb, 0)} g\n💪 โปรตีน ${safeNumber(protein, 0)} g\n💧 ไขมัน ${safeNumber(fat, 0)} g\n\n📊 วันนี้กินไปแล้ว:\n${totalKcal} / ${target} kcal\n(${progress})`;
};

export const getSummaryText = ({ title, summary }) => {
  const total = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const progress = buildProgressBar(total, target) || EMPTY_PROGRESS;
  const over = Math.max(total - target, 0);
  const left = Math.max(target - total, 0);
  const percent = target > 0 ? total / target : 0;

  const statusLine = percent >= 1 ? `🔴 เกินเป้าไปประมาณ ${over} kcal` : `🟢 เหลือประมาณ ${left} kcal`;

  return `📊 สรุปวันนี้ของ${title}\n\nกินไปแล้ว ${total} / ${target} kcal\n${statusLine}\n(${progress})\n\nวันนี้แปะดูแล้ว:\n- 🍚 คาร์บรวม ${summary.totalCarb || 0} g\n- 💪 โปรตีนรวม ${summary.totalProtein || 0} g\n- 💧 ไขมันรวม ${summary.totalFat || 0} g\n\n${percent >= 1 ? "พรุ่งนี้ลดทอด ลดหวาน แล้วเติมผักกับโปรตีนก่อน\nเดี๋ยวก็กลับเข้าร่องได้จ้า ❤️" : "มื้อถัดไปคุมของทอด/น้ำหวานนิดนึง\nแล้วเน้นโปรตีนดี ๆ ต่อ แปะว่าเริ่มสวยละ ❤️"}`;
};

export const getMealSuggestionText = ({ title, summary }) => {
  const eaten = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const left = Math.max(target - eaten, 0);
  const percent = target > 0 ? eaten / target : 0;

  if (percent >= 1) {
    return `${title} วันนี้แคลล้ำเส้นไปแล้วนะ 😅\n\nกินไปแล้ว ${eaten} / ${target} kcal\n\nถ้ายังหิวจริง ๆ\nแปะอยากให้ไปทางเบา ๆ ก่อน:\n\n- ต้มจืด\n- เกาเหลาไม่กระเทียมเจียว\n- ไข่ต้ม + ผัก\n- ปลา/ไก่ย่างไม่มัน\n\nคืนนี้ไม่ต้องแก้ชีวิตหรอก\nแค่ไม่ซ้ำหนักก็เก่งแล้ว 😂`;
  }

  if (left <= 300) {
    return `${title} วันนี้เหลือแคลไม่เยอะแล้วน้า 🟠\n\nเหลือประมาณ ${left} kcal\n\nถ้าหิวจริง ๆ เอาเบา ๆ พอ:\n\n- ไข่ต้ม 🥚\n- เต้าหู้\n- ซุปใส\n- โยเกิร์ตไม่หวาน\n\nไม่ต้องอดนะ แค่ไม่ลากยาวพอจ้า`;
  }

  if (left <= 600) {
    return `${title} วันนี้ยังพอมีพื้นที่อยู่ 🍲\n\nเหลือประมาณ ${left} kcal\nแปะอยากให้กินอุ่น ๆ เบา ๆ หน่อย\n\n- สุกี้น้ำไก่\n- เกาเหลา + ข้าวนิดเดียว\n- ต้มจืดเต้าหู้หมูสับ\n- ข้าวครึ่งทัพพี + ไข่ต้ม\n\nเอาแบบอิ่ม แต่ไม่หนักต่อเนื่องนะ 😄`;
  }

  return `${title} วันนี้ยังมีพื้นที่อยู่ 🍚\n\nเหลือประมาณ ${left} kcal\nแปะว่าไปทางมื้ออุ่น ๆ ง่าย ๆ ดี:\n\n- สุกี้น้ำ\n- ก๋วยเตี๋ยวน้ำ ไม่กระเทียมเจียว\n- ข้าวกะเพราไม่มัน + ไข่ต้ม\n- ข้าวปลา/ไก่ย่าง\n\nเอาแบบอิ่ม แต่ไม่ลากยาวถึงพรุ่งนี้ 😂`;
};
