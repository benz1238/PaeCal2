import { DEFAULT_CALORIE_TARGET, safeNumber } from "./helpers.js";
import { buildProgressBar } from "./advice.js";
import { chooseReaction } from "./reactions.js";
import { get7DayMemoryLine, getContextMemoryLine, getMealMemoryTags } from "./memory.js";

const pick = (items = []) => {
  if (!items.length) return "";
  return items[Math.floor(Math.random() * items.length)];
};

const shortClosing = () =>
  pick([
    "ได้อยู่ เดี๋ยวแปะดูให้ 😄",
    "ไม่เป็นไร วันนี้โอแล้ว",
    "พรุ่งนี้ค่อยเอาใหม่ ชิล ๆ จ้า",
    "แปะว่าแค่นี้ยังทัน",
    "รอบหน้าเดี๋ยวแปะช่วยเอง",
  ]);

const overTargetClosing = () =>
  pick([
    "วันนี้พอแค่นี้ก็สวยละ",
    "ถ้าหิวจริง ๆ เอาเบา ๆ พอ",
    "ไม่ต้องแก้ทั้งวัน แค่ไม่เติมหนักก็พอ",
    "พรุ่งนี้ค่อยดึงกลับ ชิล ๆ",
  ]);

const kcalStatusLine = ({ eaten, target }) => {
  const total = safeNumber(eaten, 0);
  const goal = safeNumber(target, DEFAULT_CALORIE_TARGET);
  const over = Math.max(total - goal, 0);
  const left = Math.max(goal - total, 0);

  if (over > 0) return `🔴 เกินเป้าไปประมาณ ${over} kcal`;
  if (left <= 300) return `🟠 เหลือประมาณ ${left} kcal`;
  return `🟢 เหลือประมาณ ${left} kcal`;
};

const shortMealInsight = (signals = {}) => {
  const lines = [];

  if (signals.proteinGood) lines.push("💪 โปรตีนมีอยู่ อันนี้แปะให้ผ่าน");
  if (signals.highFat || signals.friedSignal) lines.push("👀 ของมันแอบมาด้วยนะ ไม่ได้มาเล่น ๆ");
  if (signals.highCarb) lines.push("🍚 คาร์บค่อนข้างนำเกมวันนี้");
  if (signals.sweetSignal) lines.push("👀 หวานมาแบบเนียน ๆ แปะเห็นนะ");
  if (signals.lowProtein) lines.push("💪 โปรตีนยังบางไปนิด มื้อหน้าค่อยเติม");

  if (!lines.length) return ["🍽️ ภาพรวมมื้อนี้โอเคอยู่ ไม่ตึงเกิน"];
  return lines.slice(0, 2);
};

const reactionLineForFood = ({ title, decision }) => {
  const reaction = chooseReaction({ emotion: decision.emotion });
  const mood = decision.mood;
  const bank = {
    over_calorie_heavy: [
      `โอ้โห ${title} วันนี้จัดเต็มแบบมีหลักฐานนะ 😂`,
      `เอ้า ${title} วันนี้แคลพุ่งไม่เบาเลย 😅`,
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
      `หวานมาแล้วนะ แปะเห็นนะ 👀`,
      `ของหวานนี่มันชอบเนียนจริง ๆ เนอะ 😂`,
    ],
    protein_good: [
      `อันนี้แปะให้ผ่าน โปรตีนมาดี 💪`,
      `มื้อนี้มีทรงนะ โปรตีนไม่แย่เลย 😄`,
    ],
    heavy_meal: [
      `มื้อนี้มาแน่นนะ ${title} 🍛`,
      `จานนี้ไม่เบาเลยนะ ${title} 😂`,
    ],
    balanced: [
      `มื้อนี้ดูโอเคอยู่นะ ${title} 🍽️`,
      `แปะดูแล้ว มื้อนี้ไปได้อยู่ 😄`,
    ],
  };

  return pick(bank[mood] || bank.balanced) || reaction?.emotion || "แปะดูให้แล้วนะ 😄";
};

const softSuggestionFromFood = ({ decision }) => {
  const { day, signals, mood } = decision;

  if (day.isVeryOver) {
    return `วันนี้เกินเป้าแล้ว
ถ้ายังหิวจริง ๆ เอาเบา ๆ พอ

${overTargetClosing()}`;
  }

  if (day.isOver) {
    return `วันนี้ล้นเป้าแล้วนิดนึง
ไม่ต้องไปฝืนชดเชยนะ
แค่ไม่เติมหนักต่อก็พอ`;
  }

  if (day.isNearLimit) {
    return `วันนี้ใกล้เต็มแล้ว
มื้อถัดไปเอาเบา ๆ หน่อยก็พอ`;
  }

  if (mood === "fried_or_fat") {
    return `ถ้ามีมื้อหน้า
พักทอดสักรอบก็เซฟกว่า`;
  }

  if (mood === "sweet_heavy") {
    return `มื้อถัดไปไม่เติมหวานเพิ่มก็พอ
แคลมันชอบมาเงียบ ๆ`;
  }

  if (signals.lowProtein) {
    return `รอบหน้าเติมโปรตีนอีกนิด
ไข่ ไก่ ปลา เต้าหู้ ได้หมด`;
  }

  return `มื้อนี้ยังไปได้
เดี๋ยวมื้อถัดไปค่อยบาลานซ์`;
};

const foodLogCommentLine = ({ decision }) => {
  const { day, signals, mood } = decision;
  const memoryLine = decision.mention7DayMemory ? get7DayMemoryLine(day.memory7) : "";

  if (day.isVeryOver) {
    return [
      "วันนี้เกินเป้าแบบชัดแล้วนะ เฮียเบนซ์ 👀",
      softSuggestionFromFood({ decision }),
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  if (day.isOver) {
    return [
      "วันนี้เริ่มล้นเป้าแล้วนะ 👀",
      softSuggestionFromFood({ decision }),
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  if (mood === "fried_or_fat") {
    return [
      "ของทอดมาละหนึ่ง แปะเห็นนะ 👀",
      softSuggestionFromFood({ decision }),
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  if (mood === "sweet_heavy") {
    return [
      "หวานมาแบบเนียน ๆ เลยนะ",
      softSuggestionFromFood({ decision }),
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  if (signals.proteinGood && !signals.isHeavy) {
    return [
      "โปรตีนมีอยู่ อันนี้แปะให้ผ่าน 💪",
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  return [softSuggestionFromFood({ decision }), memoryLine].filter(Boolean).join("\n");
};

export const renderFoodLogReply = ({ title, meal, summary, decision }) => {
  const day = decision.day;
  const signals = decision.signals;
  const progress = buildProgressBar(day.eaten, day.target);
  const insight = shortMealInsight(signals).join("\n");
  const memoryLine = getContextMemoryLine(day.memory);
  const sevenDayLine = decision.mention7DayMemory ? get7DayMemoryLine(day.memory7) : "";
  const memoryBlock = [memoryLine, sevenDayLine].filter(Boolean).join("\n");

  return `${reactionLineForFood({ title, decision })}

🍽️ เมนูที่แปะเห็น
${signals.menuName}

🔥 ประมาณ ${signals.kcal} kcal

📌 แปะขอเมนต์สั้น ๆ
${insight}
${memoryBlock}

📊 วันนี้กินไปแล้ว
${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

${softSuggestionFromFood({ title, decision })}`;
};

const listOptions = (items = []) => items.map((item) => `- ${item}`).join("\n");

const optionsByContext = ({ decision }) => {
  const { day, wantsConvenience } = decision;

  if (day.isOver) {
    return wantsConvenience
      ? ["ไข่ต้ม + น้ำเปล่า", "อกไก่/ปลาแบบไม่ทอด", "โยเกิร์ตไม่หวาน", "สลัดโปรตีน น้ำสลัดน้อย"]
      : ["ต้มจืดเต้าหู้หมูสับ", "เกาเหลาไม่ใส่กระเทียมเจียว", "ไข่ต้ม + ผัก", "ปลา/ไก่ย่างไม่มัน"];
  }

  if (day.isLowBudget) {
    return ["ไข่ต้ม", "เต้าหู้", "ซุปใส", "โยเกิร์ตไม่หวาน"];
  }

  if (day.isMediumBudget || day.highFatDay || day.highCarbDay || day.memory?.hasFriedPattern) {
    return ["สุกี้น้ำไก่", "เกาเหลา + ข้าวนิดเดียว", "ต้มจืดเต้าหู้หมูสับ", "ข้าวครึ่งทัพพี + ไข่ต้ม"];
  }

  if (wantsConvenience) {
    return ["อกไก่ + ไข่ต้ม", "ข้าวกล้อง + ทูน่า/ปลา", "โยเกิร์ตไม่หวาน + ไข่ต้ม", "สลัดโปรตีน น้ำสลัดน้อย"];
  }

  return ["สุกี้น้ำ", "ก๋วยเตี๋ยวน้ำ ไม่กระเทียมเจียว", "ข้าวกะเพราไม่มัน + ไข่ต้ม", "ข้าวปลา/ไก่ย่าง"];
};

export const renderMealSuggestionReply = ({ title, decision }) => {
  const { day, wantsConvenience } = decision;
  const progress = buildProgressBar(day.eaten, day.target);
  const options = optionsByContext({ decision });
  const memoryLine = getContextMemoryLine(day.memory);
  const sevenDayLine = decision.mention7DayMemory ? get7DayMemoryLine(day.memory7) : "";
  const memoryBlock = [memoryLine, sevenDayLine].filter(Boolean).join("\n");

  if (day.isOver) {
    return `${title} วันนี้แคลล้ำเส้นไปแล้วนะ 😅

📊 สถานะตอนนี้
กินไปแล้ว ${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

👀 แปะดูจากวันนี้
${memoryBlock}

🍲 ถ้ายังหิวจริง ๆ
แปะอยากให้ไปทางเบา ๆ ก่อน:

${listOptions(options)}

คืนนี้ไม่ต้องแก้ชีวิตหรอก
แค่ไม่ซ้ำหนักก็เก่งแล้ว 😂`;
  }

  if (day.isLowBudget) {
    return `${title} วันนี้เหลือแคลไม่เยอะแล้วนะ 🟠

📊 เหลือประมาณ ${day.left} kcal

🥚 ถ้าหิวจริง ๆ เอาเบา ๆ พอ:

${listOptions(options)}

เอาพออยู่ท้องนะ
ไม่ต้องฝืนอด แปะไม่เอาดราม่า 😂`;
  }

  if (day.isMediumBudget || day.highFatDay || day.highCarbDay || day.memory?.hasFriedPattern) {
    return `${title} วันนี้ยังพอมีพื้นที่อยู่ 🍲

📊 เหลือประมาณ ${day.left} kcal

👀 แปะดูจากวันนี้
${memoryBlock}

มื้อนี้ไปทางอุ่น ๆ เบา ๆ ดีกว่า:

${listOptions(options)}

เอาแบบอิ่ม แต่ไม่หนักต่อเนื่องนะ 😄`;
  }

  if (wantsConvenience) {
    return `${title} ถ้าเอาแบบซื้อง่ายนะ 🏪

📊 วันนี้ยังเหลือประมาณ ${day.left} kcal

แปะเลือกให้แบบไม่วุ่นวาย:

${listOptions(options)}

ง่าย ๆ แต่ไม่หลุดไกลจ้า 😄`;
  }

  return `${title} วันนี้ยังมีพื้นที่อยู่ 🍚

📊 เหลือประมาณ ${day.left} kcal

แปะว่าไปทางมื้ออุ่น ๆ ง่าย ๆ ดี:

${listOptions(options)}

เอาแบบอิ่ม
แต่ไม่ลากยาวถึงพรุ่งนี้ 😂`;
};

const recapHeadline = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) return "วันนี้คือสายจัดเต็มแบบมีหลักฐานนะ 😂";
  if (day.isOver) return "วันนี้มีหลุดโค้งนิดนึงนะ 👀";
  if (memory.hasFriedPattern) return "วันนี้ของทอดมาแอบถี่นะ แปะเห็น 👀";
  if (memory.hasSweetPattern) return "วันนี้หวานมาหลายจังหวะอยู่นะ 👀";
  if (day.isNearLimit) return "วันนี้เกือบเต็มหลอดแล้วนะ 🟠";
  if (day.goodProteinDay || memory.hasProteinWin) return "วันนี้โปรตีนมีทรง แปะยิ้มอยู่ 😄";
  return "วันนี้ทรงยังโอเคอยู่ 😄";
};

const mvpLine = ({ proteinMeal, memory }) => {
  if (proteinMeal) {
    return `💪 ${proteinMeal.menuName || "มื้อโปรตีน"}
โปรตีนดูดีที่สุดของวัน
อันนี้แปะชมก่อน`;
  }

  if (memory.hasProteinWin) {
    return `💪 วันนี้มีโปรตีนดีอยู่
แปะให้ผ่านแบบไม่ต้องประชุม`;
  }

  return `💪 วันนี้ยังไม่มี MVP ชัด ๆ
แต่ยังตั้งหลักได้อยู่`;
};

const problemLine = ({ problemMeal, memory }) => {
  if (memory.hasSweetPattern) {
    return `ของหวาน
วันนี้มาเกินหนึ่งจังหวะ แปะเห็นนะ 👀`;
  }

  if (memory.hasFriedPattern) {
    return `ของทอด/ของมัน
วันนี้มาใกล้กันหลายรอบอยู่ 👀`;
  }

  if (problemMeal) {
    const tags = getMealMemoryTags(problemMeal);
    const reason = tags.isSweet
      ? "หวานดันแคลวันนี้เลย"
      : tags.isFried || tags.highFat
        ? "ตัวดันไขมันวันนี้เลย"
        : tags.highCarb
          ? "คาร์บมาแน่นสุดของวัน"
          : "ตัวดันแคลวันนี้เลย";

    return `${problemMeal.menuName || "มื้อหนักสุด"}
${reason} แปะจดไว้แล้ว 😂`;
  }

  return `ยังไม่มีตัวปัญหาชัด ๆ
ถือว่ารอดไปก่อน`;
};

const moodLine = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) {
    return `😅 Mood รวม
หลุดแบบมีหลักฐาน แต่ยังตั้งหลักได้`;
  }

  if (day.isOver) {
    return `😅 Mood รวม
เกินนิด ๆ แต่ยังเอาอยู่`;
  }

  if (memory.hasSweetPattern) {
    return `👀 Mood รวม
หวานถี่ไปนิด แต่ยังเบรกทัน`;
  }

  if (memory.hasFriedPattern) {
    return `👀 Mood รวม
ของทอดมาถี่ แปะขอเบรกมือเบา ๆ`;
  }

  if (day.goodProteinDay || memory.hasProteinWin) {
    return `😄 Mood รวม
โปรตีนมาดี แปะยังยิ้มอยู่`;
  }

  return `😄 Mood รวม
ไปได้เรื่อย ๆ ยังไม่หลุดโค้ง`;
};

const nextStepLine = ({ day, memory }) => {
  if (day.isOver || memory.hasHeavyPattern) {
    return `❤️ มื้อต่อไป
เลี่ยงทอดสักมื้อ
เติมผักกับโปรตีนพอ`;
  }

  if (memory.hasSweetPattern) {
    return `❤️ มื้อต่อไป
พักน้ำหวานก่อนสักรอบ
แล้วไปทางโปรตีนกับผัก`;
  }

  if (memory.hasFriedPattern) {
    return `❤️ มื้อต่อไป
พักทอดก่อนหนึ่งมื้อ
ไปทางต้ม/ย่างพอ`;
  }

  return `❤️ มื้อต่อไป
คุมของทอด/น้ำหวานนิดนึง
แล้วเน้นโปรตีนดี ๆ ต่อ`;
};

export const renderDailyRecapMessages = ({ title, decision }) => {
  const { day, problemMeal, proteinMeal, memory = day.memory || {} } = decision;
  const progress = buildProgressBar(day.eaten, day.target);
  const sevenDayLine = decision.mention7DayMemory ? get7DayMemoryLine(day.memory7) : "";

  const firstMessage = `📊 สรุปวันนี้ของ${title}

${recapHeadline({ day, memory })}

🔥 ภาพรวมวันนี้
กินไปแล้ว ${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

🏆 MVP วันนี้
${mvpLine({ proteinMeal, memory })}`;

  const secondMessage = `👀 แต่...
${problemLine({ problemMeal, memory })}${sevenDayLine ? `\n${sevenDayLine}` : ""}

${moodLine({ day, memory })}

${nextStepLine({ day, memory })}

${shortClosing()}`;

  return [firstMessage, secondMessage];
};

export const renderDailyRecapReply = ({ title, decision }) => {
  return renderDailyRecapMessages({ title, decision }).join("\n\n");
};

export const renderFallbackReply = () => {
  return `แปะขออภัย ระบบสะดุดนิดนึง 😅

ลองส่งใหม่อีกทีนะ
เดี๋ยวแปะตั้งหลักแป๊บ`;
};

export const renderNoFoodDetectedReply = () => {
  return `แปะมองไม่ทันอะ 😅

ส่งใหม่ใกล้ ๆ ได้มั้ย
เอาให้เห็นอาหารชัด ๆ หน่อยน้า`;
};

export const renderFoodLogMessages = ({ title, meal, summary, decision }) => {
  const day = decision.day;
  const signals = decision.signals;
  const progress = buildProgressBar(day.eaten, day.target);

  const firstMessage = `${reactionLineForFood({ title, decision })}

🍽️ เมนูที่แปะเห็น
${signals.menuName}

🔥 ประมาณ ${signals.kcal} kcal`;

  const secondMessage = `📊 วันนี้กินไปแล้ว
${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})`;

  const thirdMessage = foodLogCommentLine({ decision });

  return [firstMessage, secondMessage, thirdMessage].filter(Boolean);
};
