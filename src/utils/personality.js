import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";
import { buildProgressBar } from "./advice.js";
import { chooseReaction } from "./reactions.js";

const pick = (items = []) => {
  if (!items.length) return "";
  return items[Math.floor(Math.random() * items.length)];
};

const kcalStatusLine = ({ eaten, target }) => {
  const total = safeNumber(eaten, 0);
  const goal = safeNumber(target, DEFAULT_CALORIE_TARGET);
  const over = Math.max(total - goal, 0);
  const left = Math.max(goal - total, 0);

  if (over > 0) return `🔴 เกินเป้าไปประมาณ ${over} kcal`;
  if (left <= 300) return `🟠 เหลือประมาณ ${left} kcal`;
  return `🟢 เหลือประมาณ ${left} kcal`;
};

const compactMacroInsight = ({ carb, protein, fat }) => {
  const notes = [];

  if (safeNumber(protein) >= 30) notes.push("โปรตีนถือว่ามีอยู่ 💪");
  if (safeNumber(carb) >= 85) notes.push("คาร์บมาค่อนข้างแน่น 🍚");
  if (safeNumber(fat) >= 35) notes.push("ไขมันก็แอบตามมานิดนึง 👀");

  if (!notes.length) return "ภาพรวมมื้อนี้ค่อนข้างบาลานซ์นะ";
  return notes.slice(0, 2).join("\n");
};

const suggestionFromFoodDecision = ({ decision, title }) => {
  const { day, signals, mood } = decision;

  if (day.isVeryOver) {
    return `วันนี้ล้ำเส้นไปไกลแล้วนะ ${title} 😅

ถ้ายังหิวจริง ๆ
เอาแค่อะไรเบา ๆ พออยู่ท้องน้า`;
  }

  if (day.isOver) {
    return `วันนี้แตะเกินเป้าแล้วนะ ${title} 🟠

มื้อถัดไปขอเบา ๆ หน่อย
ไม่ต้องแก้ชีวิต แค่ไม่ซ้ำหนักก็พอ 😂`;
  }

  if (mood === "fried_or_fat") {
    return `มื้อหน้าลองลดทอด/มันนิดนึงนะ
แปะว่าเอาอยู่ 😄`;
  }

  if (mood === "sweet_heavy") {
    return `หวานมาแล้วหนึ่ง 👀
มื้อถัดไปขอไม่เติมน้ำหวานเพิ่มน้า`;
  }

  if (signals.lowProtein) {
    return `มื้อหน้าหาโปรตีนเพิ่มนิดนึง
ไข่ต้ม ไก่ ปลา เต้าหู้ ได้หมดเลยจ้า`;
  }

  if (day.isNearLimit) {
    return `วันนี้ใกล้เต็มเป้าแล้ว
มื้อถัดไปเบา ๆ ก็สวยแล้วจ้า`;
  }

  return `กินให้อร่อยได้เลย
เดี๋ยวแปะช่วยบาลานซ์มื้อถัดไปต่อ 😄`;
};

export const renderFoodLogReply = ({ title, meal, summary, decision }) => {
  const day = decision.day;
  const signals = decision.signals;
  const progress = buildProgressBar(day.eaten, day.target);
  const reaction = chooseReaction({ emotion: decision.emotion });

  const reactions = {
    over_calorie_heavy: [
      `โอ้โห วันนี้จัดเต็มแบบมีหลักฐานนะ ${title} 😂`,
      `เอ้า ${title} วันนี้แคลพุ่งไม่เบาเลยนะ 😅`,
    ],
    over_calorie: [
      `มื้อนี้ทำแคลล้ำเส้นแล้วนะ ${title} 😅`,
      `วันนี้เริ่มเกินเป้าแล้วนะ ${title} 👀`,
    ],
    fried_or_fat: [
      `โอเค มื้อนี้สายมันมาแล้วหนึ่ง 👀`,
      `มื้อนี้ดูเพลิน แต่ไขมันแอบมานะ 😂`,
    ],
    sweet_heavy: [
      `หวานมาแล้วนะ แปะเห็นนะ 😭`,
      `ของหวานนี่มันชอบเนียนจริง ๆ เนอะ 😂`,
    ],
    protein_good: [
      `อันนี้แปะให้ผ่าน โปรตีนมาดี 💪`,
      `มื้อนี้มีทรงนะ โปรตีนไม่แย่เลย 😄`,
    ],
    heavy_meal: [
      `มื้อนี้มาแน่นนะ ${title} 🍛`,
      `จานนี้ไม่เบาเลยนะเฮีย 😂`,
    ],
    balanced: [
      `มื้อนี้ดูโอเคอยู่นะ ${title} 🍽️`,
      `แปะดูแล้ว มื้อนี้ไปได้อยู่ 😄`,
    ],
  };

  return `${pick(reactions[decision.mood] || reactions.balanced)}

น่าจะเป็น:
${signals.menuName} 🍽️

ประมาณ ${signals.kcal} kcal

${compactMacroInsight(signals)}

📊 วันนี้กินไปแล้ว:
${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

${suggestionFromFoodDecision({ decision, title })}`;
};

export const renderMealSuggestionReply = ({ title, decision }) => {
  const { day, wantsConvenience, mood } = decision;
  const progress = buildProgressBar(day.eaten, day.target);

  if (day.isOver) {
    const options = wantsConvenience
      ? ["ไข่ต้ม + น้ำเปล่า", "อกไก่/ปลาแบบไม่ทอด", "โยเกิร์ตไม่หวาน", "สลัดโปรตีน น้ำสลัดน้อย"]
      : ["ต้มจืดเต้าหู้หมูสับ", "เกาเหลาไม่ใส่กระเทียมเจียว", "ไข่ต้ม + ผัก", "ปลา/ไก่ย่างไม่มัน"];

    return `${title} วันนี้แคลล้ำเส้นไปแล้วนะ 😅

กินไปแล้ว ${day.eaten} / ${day.target} kcal
(${progress})

ถ้ายังหิวจริง ๆ
แปะอยากให้ไปทางเบา ๆ ก่อน:

- ${options.join("\n- ")}

คืนนี้ไม่ต้องแก้ชีวิตหรอก
แค่ไม่ซ้ำหนักก็เก่งแล้ว 😂`;
  }

  if (day.isLowBudget) {
    return `${title} วันนี้เหลือแคลไม่เยอะแล้วนะ 🟠

เหลือประมาณ ${day.left} kcal

ถ้าหิวจริง ๆ เอาเบา ๆ พอ:

- ไข่ต้ม 🥚
- เต้าหู้
- ซุปใส
- โยเกิร์ตไม่หวาน

ไม่ต้องอดนะ แค่ไม่ลากยาวพอจ้า`;
  }

  if (day.isMediumBudget || mood === "high_fat_day" || mood === "high_carb_day") {
    return `${title} วันนี้ยังพอมีพื้นที่อยู่ 🍲

เหลือประมาณ ${day.left} kcal
แปะอยากให้กินอุ่น ๆ เบา ๆ หน่อย

- สุกี้น้ำไก่
- เกาเหลา + ข้าวนิดเดียว
- ต้มจืดเต้าหู้หมูสับ
- ข้าวครึ่งทัพพี + ไข่ต้ม

เอาแบบอิ่ม แต่ไม่หนักต่อเนื่องนะ 😄`;
  }

  if (wantsConvenience) {
    return `${title} ถ้าเอาแบบซื้อง่ายนะ 🏪

วันนี้ยังเหลือประมาณ ${day.left} kcal
แปะเลือกให้แบบไม่วุ่นวาย:

- อกไก่ + ไข่ต้ม
- ข้าวกล้อง + ทูน่า/ปลา
- โยเกิร์ตไม่หวาน + ไข่ต้ม
- สลัดโปรตีน น้ำสลัดน้อย

ง่าย ๆ แต่ไม่หลุดไกลจ้า 😄`;
  }

  return `${title} วันนี้ยังมีพื้นที่อยู่ 🍚

เหลือประมาณ ${day.left} kcal
แปะว่าไปทางมื้ออุ่น ๆ ง่าย ๆ ดี:

- สุกี้น้ำ
- ก๋วยเตี๋ยวน้ำ ไม่กระเทียมเจียว
- ข้าวกะเพราไม่มัน + ไข่ต้ม
- ข้าวปลา/ไก่ย่าง

เอาแบบอิ่ม แต่ไม่ลากยาวถึงพรุ่งนี้ 😂`;
};

export const renderDailyRecapReply = ({ title, decision }) => {
  const { day, problemMeal, proteinMeal, mood } = decision;
  const progress = buildProgressBar(day.eaten, day.target);
  const headline = day.isOver
    ? "วันนี้คือสายจัดเต็มนะ 😂"
    : day.isNearLimit
      ? "วันนี้เกือบเต็มหลอดแล้วนะ 👀"
      : "วันนี้ทรงยังโอเคอยู่ 😄";

  const mvp = proteinMeal
    ? `💪 ${proteinMeal.menuName || "มื้อโปรตีน"} — โปรตีนดูดีที่สุดของวัน`
    : "💪 วันนี้ยังไม่มี MVP ชัด ๆ";

  const problem = problemMeal
    ? `🍚 ${problemMeal.menuName || "มื้อหนักสุด"} — ตัวดันแคลวันนี้เลย 😂`
    : "🍚 ยังไม่มีเมนูตัวปัญหาชัด ๆ";

  const moodLine = day.isVeryOver
    ? "Mood รวม: หลุดแบบมีหลักฐาน แต่ไม่ต้องเครียดนะ 😅"
    : day.isOver
      ? "Mood รวม: เกินนิด ๆ แต่ยังตั้งหลักได้"
      : day.goodProteinDay
        ? "Mood รวม: โปรตีนมาดี แปะยิ้มอยู่"
        : "Mood รวม: ไปได้เรื่อย ๆ ยังไม่หลุดโค้ง";

  const tomorrow = day.isOver
    ? "พรุ่งนี้เอาง่าย ๆ\nลดทอด ลดหวาน แล้วเติมผักกับโปรตีนก่อน\nเดี๋ยวก็กลับเข้าร่องได้จ้า ❤️"
    : "มื้อถัดไปคุมของทอด/น้ำหวานนิดนึง\nแล้วเน้นโปรตีนดี ๆ ต่อ แปะว่าเริ่มสวยละ ❤️";

  return `📊 สรุปวันนี้ของ${title}

${headline}

กินไปแล้ว ${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

MVP วันนี้:
${mvp}

ตัวปัญหาประจำวัน:
${problem}

${moodLine}

${tomorrow}`;
};

export const renderFallbackReply = () => {
  return `แปะขออภัย ระบบสะดุดนิดนึง 😭

ลองส่งใหม่อีกทีนะ
เดี๋ยวแปะตั้งหลักแป๊บ`;
};

export const renderNoFoodDetectedReply = () => {
  return `แปะมองไม่ทันอะ 😭

ส่งใหม่ใกล้ ๆ ได้มั้ย
เอาให้เห็นอาหารชัด ๆ หน่อยน้า`;
};
