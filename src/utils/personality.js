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
      `โอ้โห ${title} วันนี้ยอดรวมเริ่มตึงแล้วนะ 😂`,
      `เอ้า ${title} วันนี้แคลพุ่งไม่เบาเลย 555+`,
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
    return `ถ้ายังหิวจริง ๆ เอาเบา ๆ พอ 😅
พรุ่งนี้ค่อยดึงกลับ ชิล ๆ 😄`;
  }

  if (day.isOver) {
    return `ถ้ายังหิวจริง ๆ เอาเบา ๆ พอนะ 😅
ไม่ต้องฝืนแก้ทั้งวัน แค่ไม่เติมหนักต่อก็พอ 😄`;
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
      "วันนี้เกินเป้าแบบชัด ๆ แล้วนะ เฮียเบนซ์ 👀",
      "ถ้ายังหิวจริง ๆ เอาเบา ๆ พอนะ 😅",
      "พรุ่งนี้ค่อยดึงกลับ ชิล ๆ 😄",
      memoryLine,
    ].filter(Boolean).join("\n");
  }

  if (day.isOver) {
    return [
      "วันนี้เริ่มเกินเป้าแล้วนะ เฮียเบนซ์ 👀",
      "ถ้ายังหิวจริง ๆ เอาเบา ๆ พอนะ 😅",
      "ไม่ต้องฝืนแก้ทั้งวัน แค่ไม่เติมหนักต่อก็พอ 😄",
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
  return renderFoodLogMessages({ title, meal, summary, decision }).join("\n\n");
};

const listOptions = (items = []) => items.map((item) => `- ${item}`).join("\n");

const getBangkokHour = () => {
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false,
    }).format(new Date());

    return Number(value) % 24;
  } catch {
    return new Date().getHours();
  }
};

const getMealTimeContext = () => {
  const hour = getBangkokHour();

  if (hour >= 5 && hour < 10) {
    return {
      key: "breakfast",
      label: "ตอนเช้าๆแบบนี้",
      intro: "เอาเป็นแบบอุ่น ๆ อยู่ท้องดีกว่า:",
      closing: "เริ่มวันแบบไม่ตีกับท้อง แปะว่าโอเค 😄",
    };
  }

  if (hour >= 10 && hour < 14) {
    return {
      key: "lunch",
      label: "ตอนนี้เที่ยงพอดี",
      intro: "เอาเป็นเมนคอร์สได้เลย แต่ไม่ต้องมันจัด:",
      closing: "กินให้อิ่มแบบไม่ง่วงบ่าย แปะเชียร์อันนี้ 😄",
    };
  }

  if (hour >= 14 && hour < 17) {
    return {
      key: "pre_dinner",
      label: "นี่ก็บ่ายแล้ว",
      intro: "ถ้าหิวตอนนี้ เอาแบบกันหลุดก่อนดีกว่า:",
      closing: "อย่าเพิ่งจัดหนักตอนนี้ เดี๋ยวมื้อเย็นจะต่อยาก 😅",
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      key: "dinner",
      label: "ตอนนี้เย็นแล้ว",
      intro: "มื้อนี้เอาอิ่มพอดี ไม่ลากยาวดีกว่า:",
      closing: "เอาให้อิ่มพอดี ๆ คืนนี้จะได้ไม่แน่นเกิน 😄",
    };
  }

  if (hour >= 21 || hour < 2) {
    return {
      key: "late_night",
      label: "ตอนนี้ดึกแล้วนะ",
      intro: "ถ้ายังหิวจริง ๆ เบา ๆ ก็พอนะ:",
      closing: "ดึกแล้ว ไม่ต้องเล่นใหญ่ เดี๋ยวท้องทำงานโอที 😂",
    };
  }

  return {
    key: "very_late",
    label: "เวลานี้ควรนอนมากกว่ากินแล้วนะ 555",
    intro: "ถ้าหิวจริง ๆ เอาแค่รองท้องเบา ๆ:",
    closing: "กินกันวูบพอ แล้วไปพักนะ 😴",
  };
};

const optionsForTime = ({ timeContext, day, wantsConvenience }) => {
  const key = timeContext?.key || "dinner";

  if (day.isOver) {
    if (key === "late_night" || key === "very_late") {
      return ["ซุปใส/ต้มจืดถ้วยเล็ก", "ไข่ต้ม 1 ฟอง", "โยเกิร์ตไม่หวาน", "นมจืด/น้ำเต้าหู้ไม่หวาน"];
    }

    return wantsConvenience
      ? ["ไข่ต้ม + น้ำเปล่า", "อกไก่/ปลาแบบไม่ทอด", "โยเกิร์ตไม่หวาน", "สลัดโปรตีน น้ำสลัดน้อย"]
      : ["ต้มจืดเต้าหู้หมูสับ", "เกาเหลาไม่ใส่กระเทียมเจียว", "ไข่ต้ม + ผัก", "ปลา/ไก่ย่างไม่มัน"];
  }

  if (day.isLowBudget) {
    if (key === "late_night" || key === "very_late") {
      return ["ไข่ต้ม", "ซุปใส", "โยเกิร์ตไม่หวาน", "นมจืด/น้ำเต้าหู้ไม่หวาน"];
    }

    return ["ไข่ต้ม", "เต้าหู้", "ซุปใส", "โยเกิร์ตไม่หวาน"];
  }

  if (wantsConvenience) {
    if (key === "breakfast") return ["ไข่ต้ม + นมจืด", "โยเกิร์ตไม่หวาน + กล้วย", "ข้าวกล้อง + ทูน่า", "แซนด์วิชไก่ + น้ำเปล่า"];
    if (key === "late_night" || key === "very_late") return ["ไข่ต้ม", "นมจืด", "โยเกิร์ตไม่หวาน", "อกไก่นิดเดียว"];
    return ["อกไก่ + ไข่ต้ม", "ข้าวกล้อง + ทูน่า/ปลา", "โยเกิร์ตไม่หวาน + ไข่ต้ม", "สลัดโปรตีน น้ำสลัดน้อย"];
  }

  if (key === "breakfast") {
    return ["ข้าวต้มปลา/ไก่", "โจ๊กหมูใส่ไข่", "ไข่ต้ม + กล้วย", "โยเกิร์ตไม่หวาน + ผลไม้"];
  }

  if (key === "lunch") {
    return ["ข้าวกะเพราไก่ไม่มัน + ไข่ต้ม", "ข้าวปลา/ไก่ย่าง + ผัก", "สุกี้น้ำไก่", "ก๋วยเตี๋ยวน้ำ ไม่กระเทียมเจียว"];
  }

  if (key === "pre_dinner") {
    return ["สุกี้น้ำไก่", "ต้มจืดเต้าหู้หมูสับ", "เกาเหลา + ข้าวนิดเดียว", "ไข่ต้ม + โยเกิร์ตไม่หวาน"];
  }

  if (key === "dinner") {
    return ["สุกี้น้ำ", "ข้าวปลา/ไก่ย่าง + ผัก", "ต้มจืดเต้าหู้หมูสับ + ข้าวครึ่งทัพพี", "ก๋วยเตี๋ยวน้ำ ไม่กระเทียมเจียว"];
  }

  return ["ซุปใส", "ไข่ต้ม", "โยเกิร์ตไม่หวาน", "นมจืด/น้ำเต้าหู้ไม่หวาน"];
};

const optionsByContext = ({ decision, timeContext }) => {
  const { day, wantsConvenience } = decision;
  return optionsForTime({ timeContext, day, wantsConvenience });
};

export const renderMealSuggestionReply = ({ title, decision }) => {
  const { day, wantsConvenience } = decision;
  const timeContext = getMealTimeContext();
  const progress = buildProgressBar(day.eaten, day.target);
  const options = optionsByContext({ decision, timeContext });
  const memoryLine = getContextMemoryLine(day.memory);
  const sevenDayLine = decision.mention7DayMemory ? get7DayMemoryLine(day.memory7) : "";
  const contextBlock = [memoryLine, sevenDayLine].filter(Boolean).join("\n") || "วันนี้ดูจากแคลที่เหลือก่อนนะ";

  if (day.isOver) {
    return `${title} วันนี้แคลล้ำเส้นไปแล้วนะ 😅

📊 สถานะตอนนี้
กินไปแล้ว ${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})

👀 แปะดูจากตอนนี้
${contextBlock}

🍲 ${timeContext.intro}

${listOptions(options)}

${timeContext.closing}`;
  }

  if (day.isLowBudget) {
    return `${title} วันนี้เหลือแคลไม่เยอะแล้วนะ 🟠

📊 เหลือประมาณ ${day.left} kcal

🥚 ${timeContext.label}
${timeContext.intro}

${listOptions(options)}

${timeContext.closing}`;
  }

  if (day.isMediumBudget || day.highFatDay || day.highCarbDay || day.memory?.hasFriedPattern) {
    return `${title} วันนี้ยังพอมีพื้นที่อยู่ 🍲

📊 เหลือประมาณ ${day.left} kcal

👀 แปะดูจากตอนนี้
${contextBlock}

${timeContext.intro}

${listOptions(options)}

${timeContext.closing}`;
  }

  if (wantsConvenience) {
    return `${title} ถ้าเอาแบบซื้อง่ายนะ 🏪

📊 วันนี้ยังเหลือประมาณ ${day.left} kcal

${timeContext.label}
${timeContext.intro}

${listOptions(options)}

ง่าย ๆ แต่ไม่หลุดไกลจ้า 😄`;
  }

  return `${title} วันนี้ยังมีพื้นที่อยู่ 🍚

📊 เหลือประมาณ ${day.left} kcal

${timeContext.label}
${timeContext.intro}

${listOptions(options)}

${timeContext.closing}`;
};

const recapHeadline = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) return "วันนี้ยอดรวมตึงนิดนึงนะ 555+";
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

const fallbackReplies = [
  `เมื่อกี้แปะวูบไปแป๊บนึง 😵‍💫
ลองส่งใหม่อีกทีนะ`,
  `แปะสะดุดขาตัวเองนิดนึง 😅
ส่งมาใหม่อีกที เดี๋ยวดูให้`,
  `เมื่อกี้แปะหน้ามืดนิดนึง 555
ลองอีกทีนะ`,
  `แปะเผลอหลับตาไปแวบนึง 😴
ลองส่งใหม่อีกทีนะ`,
  `เมื่อกี้แปะหลุดโฟกัสนิดนึง 😅
ส่งใหม่อีกทีนะ`
];

export const renderFallbackReply = () => {
  return pick(fallbackReplies);
};

const normalizeSubject = (value) => String(value || "").trim();

const pickNoFoodReply = (variants) => pick(variants.map((lines) => lines.join("\n")));

export const renderNoFoodDetectedReply = ({ imageSubject, imageCaption } = {}) => {
  const subject = normalizeSubject(imageSubject);
  const caption = normalizeSubject(imageCaption);
  const detail = `${subject} ${caption}`.trim();

  if (/ไก่|chicken/i.test(detail)) {
    if (/กาแฟ|coffee|birdy|กระป๋อง/i.test(detail)) {
      return pickNoFoodReply([
        ["อันนี้ไก่ถือกาแฟนะ 😂", "แปะขอแปะไว้ก่อน ยังไม่นับเป็นมื้อให้จ้า", "ส่งรูปอาหารจริงมา เดี๋ยวแปะจัดให้ 🍽️"],
        ["ไก่บอดี้แน่น แถมถือกาแฟด้วย 555+", "แต่แปะยังนับเป็นมื้อให้ไม่ได้นะ", "ส่งจานที่กินมาจริง ๆ เดี๋ยวแปะดูให้ 🍽️"],
        ["รูปนี้ไก่มาเป็นพรีเซนเตอร์เฉย 555++", "กาแฟอยู่ในมือไก่ แปะยังไม่กล้าลงมื้อให้", "ถ้าลื้อดื่มเอง ส่งรูปเครื่องดื่มชัด ๆ มาได้เลย"],
      ]);
    }

    return pickNoFoodReply([
      ["อันนี้ไก่นะ 555", "ยังไม่ใช่มื้อที่แปะนับแคลให้ได้จ้า", "ส่งรูปอาหารมา เดี๋ยวแปะจัดให้ 🍽️"],
      ["ไก่มาเฉยเลย 😂", "แปะขอแปะไว้ก่อน ยังไม่นับเป็นมื้อให้น้า", "ส่งจานที่กินมา เดี๋ยวแปะดูให้"],
      ["รูปนี้น้องไก่ชัดมาก 55", "แต่ยังไม่ใช่อาหารบนจานของลื้อนะ", "ส่งรูปมื้อจริงมา แปะจัดให้ 🍽️"],
    ]);
  }

  if (/แมว|cat/i.test(detail)) {
    return pickNoFoodReply([
      ["เอ้า อันนี้แมวนี่นา 😂", "น่ารักอยู่ แต่แปะนับแคลให้น้องไม่ได้จ้า", "ส่งรูปอาหารมา เดี๋ยวแปะจัดให้ 🍽️"],
      ["แมวมาเองเลย 555+", "อันนี้แปะขอแปะไว้ก่อนนะ", "ส่งจานที่กินมาจริง ๆ เดี๋ยวแปะดูให้"],
      ["น้องแมวน่ารัก ผ่านเลย 👀", "แต่ผ่านในหมวดความน่ารัก ไม่ใช่หมวดแคลนะ 555", "ส่งรูปอาหารมา แปะจัดให้"],
    ]);
  }

  if (/หมา|สุนัข|dog/i.test(detail)) {
    return pickNoFoodReply([
      ["อันนี้น้องหมานะ 555", "แปะขอแปะไว้ก่อน ยังไม่ใช่มื้อข้าว", "ส่งรูปจานที่กินมา เดี๋ยวแปะจัดให้ 🍽️"],
      ["น้องหมามาเต็มเฟรมเลย 😂", "แปะนับแคลให้น้องไม่ได้จ้า", "ส่งอาหารของลื้อมาแทน เดี๋ยวแปะดูให้"],
      ["หมวดนี้แปะให้ความน่ารักก่อน 55", "แต่ยังลงมื้อไม่ได้", "ส่งรูปอาหารมา แปะจัดให้ 🍽️"],
    ]);
  }

  if (/คน|หน้า|selfie|เซลฟี่/i.test(detail)) {
    return pickNoFoodReply([
      ["อันนี้รูปคนนะ 555", "แปะดูแคลจากหน้าไม่ได้จ้า", "ส่งรูปอาหารมา เดี๋ยวแปะจัดให้ 🍽️"],
      ["อันนี้เหมือนเซลฟี่นะ 👀", "แปะขอแปะไว้ก่อน ยังไม่ใช่อาหาร", "ส่งจานที่กินมา แปะดูให้"],
      ["รูปนี้ยังไม่ใช่มื้ออาหารน้า 😅", "แปะยังลงแคลให้ไม่ได้", "ส่งรูปอาหารมา เดี๋ยวแปะจัดให้"],
    ]);
  }

  if (/จอ|คอม|หน้าจอ|screenshot|screen/i.test(detail)) {
    return pickNoFoodReply([
      ["อันนี้เหมือนรูปหน้าจอนะ 55", "แปะขอแปะไว้ก่อน ยังนับแคลไม่ได้จ้า", "ส่งรูปอาหารจริงมา เดี๋ยวแปะจัดให้ 🍽️"],
      ["รูปจอใช่มะ 👀", "ยังไม่ใช่ของกินที่แปะลงมื้อได้", "ส่งจานอาหารมาอีกที แปะดูให้"],
      ["อันนี้แปะเห็นเป็นหน้าจอนะ 555+", "ยังไม่ลงแคลให้น้า", "เอารูปอาหารจริงมา เดี๋ยวจัดให้"],
    ]);
  }

  if (subject && !/อาหาร|food|meal|เครื่องดื่ม|drink|beverage/i.test(subject)) {
    return pickNoFoodReply([
      [`อันนี้เหมือนรูป${subject}นะ 👀`, "ยังไม่ใช่อาหารที่แปะนับแคลได้จ้า", "ส่งรูปจานที่กินมา เดี๋ยวแปะจัดให้ 🍽️"],
      [`แปะเห็นเป็น${subject}นะ 555`, "ขอแปะไว้ก่อน ยังไม่ลงมื้อให้", "ส่งอาหารจริงมาอีกทีได้เลย"],
      [`รูป${subject}มาแบบชัดอยู่ 😂`, "แต่ยังไม่ใช่ของกินที่นับแคลได้", "ถ่ายจานอาหารมา เดี๋ยวแปะดูให้"],
    ]);
  }

  return pickNoFoodReply([
    ["อันนี้ยังไม่ใช่อาหารนะ 55", "แปะขอแปะไว้ก่อน นับแคลให้ไม่ถนัดจ้า", "ส่งรูปจานที่กินมา เดี๋ยวแปะจัดให้ 🍽️"],
    ["แปะยังไม่เห็นของกินชัด ๆ นะ 👀", "ขอรูปอาหารอีกทีได้มะ", "เดี๋ยวแปะดูให้"],
    ["รูปนี้แปะยังลงมื้อให้ไม่ชัวร์ 😅", "เอาอาหารชัด ๆ อีกนิดนึง", "แปะจัดให้เลย"],
  ]);
};


const isDrinkMealName = (name = "") => {
  const menuName = String(name || "").trim();
  if (!menuName) return false;

  if (/^(ชา|นม|กาแฟ|โกโก้|โค้ก|โค๊ก|เป๊ปซี่|น้ำอัดลม|น้ำหวาน|เครื่องดื่ม)$/i.test(menuName)) return true;

  return /(ชานม|ชามะนาว|ชาไทย|ชาเขียว|ชาดำ|ชาเย็น|มัทฉะ|โกโก้|กาแฟ|ลาเต้|คาปูชิโน|อเมริกาโน่|นมเย็น|นมสด|โค้ก|โคก|โค๊ก|เป๊ปซี่|น้ำอัดลม|สไปรท์|แฟนต้า|น้ำหวาน|หวานเย็น|น้ำแดง|น้ำเขียว|น้ำผลไม้|สมูทตี้|เครื่องดื่ม|coke|cola|pepsi|coffee|tea|milk|cocoa|latte|smoothie|juice|moccona|มอคโคน่า|nescafe|เนสกาแฟ|birdy|เบอร์ดี้|milo|ไมโล|ovaltine|โอวัลติน)/i.test(menuName);
};

const nutritionLine = ({ carb = 0, protein = 0, fat = 0 } = {}) => {
  return `🥦 โภชนาการ: คาร์บ ${Math.round(Number(carb || 0))}g / โปรตีน ${Math.round(Number(protein || 0))}g / ไขมัน ${Math.round(Number(fat || 0))}g`;
};

const drinkSugarLine = ({ menuName = "", kcal = 0, carb = 0 } = {}) => {
  if (!isDrinkMealName(menuName)) return "";

  const kcalValue = Number(kcal || 0) || 0;
  const carbValue = Number(carb || 0) || 0;

  if (/หวานน้อย|ไม่หวาน|0\s*%|zero|ซีโร่|sugar\s*free/i.test(menuName)) {
    return "🍬 น้ำตาล: น่าจะเบากว่าปกติ แต่อย่าเพิ่งไว้ใจหมดนะ 👀";
  }

  if (kcalValue >= 250 || carbValue >= 45) {
    return "🍬 น้ำตาล: น่าจะมาแน่นพอตัวเลยนะ 555+";
  }

  if (kcalValue >= 120 || carbValue >= 20) {
    return "🍬 น้ำตาล: มีมาพอให้แปะเห็นอยู่นะ 👀";
  }

  return "🍬 น้ำตาล: ดูไม่แรงมาก แต่ก็แปะไว้ก่อนนะ";
};

export const renderFoodLogMessages = ({ title, meal, summary, decision }) => {
  const day = decision.day;
  const signals = decision.signals;
  const progress = buildProgressBar(day.eaten, day.target);

  const isDrink = isDrinkMealName(signals.menuName);
  const sugarLine = isDrink ? drinkSugarLine({ menuName: signals.menuName, kcal: signals.kcal, carb: signals.carb }) : "";
  const macroLine = !isDrink ? nutritionLine({ carb: signals.carb, protein: signals.protein, fat: signals.fat }) : "";

  const firstMessage = `${reactionLineForFood({ title, decision })}

🍽️ เมนู
${signals.menuName}

🔥 ประมาณ ${signals.kcal} kcal${sugarLine ? `
${sugarLine}` : ""}${macroLine ? `
${macroLine}` : ""}`;

  const secondMessage = `📊 วันนี้กินไปแล้ว
${day.eaten} / ${day.target} kcal
${kcalStatusLine({ eaten: day.eaten, target: day.target })}
(${progress})`;

  const thirdMessage = foodLogCommentLine({ decision });

  return [firstMessage, secondMessage, thirdMessage].filter(Boolean);
};
