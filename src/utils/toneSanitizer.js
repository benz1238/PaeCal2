const DIALOGUE_REPLACEMENTS = [
  [/จ๊ะ/g, "อะ"],
  [/จ้ะ/g, "อะ"],
  [/จ้า/g, "อะ"],
  [/น้า/g, "นะ"],
  [/ครับ/g, ""],
  [/ค่ะ/g, ""],
  [/คะ/g, ""],
  [/เจ๊/g, "แปะ"],
];

const SENSITIVE_BODY_REPLACEMENTS = [
  [/กระดูกจะทิ่ม/g, "แรงหมดเอานะ แปะเป็นห่วง"],
  [/กินเยอะขนาดนี้/g, "มื้อนี้หนักไปนิด"],
  [/ต้องปรับหุ่น/g, "ถ้าอยากปรับสุขภาพ"],
  [/ต้องลด/g, "ค่อย ๆ ปรับ"],
  [/ต้องผอม/g, "เอาให้แข็งแรงขึ้นก่อน"],
  [/อยากผอม/g, "อยากปรับสุขภาพ"],
  [/เพิ่มน้ำหนักไม่ได้/g, "เพิ่มแรงก็ทำได้ แค่เอาแบบมีแรง ไม่ฝืน"],
];

const PERSONALITY_COPY_REPLACEMENTS = [
  [/พรุ่งนี้ค่อยเอาใหม่ ชิล ๆ อะ/g, "พรุ่งนี้ค่อยเอาใหม่ แปะว่าเอาอยู่"],
  [/พรุ่งนี้ค่อยเอาใหม่ ชิล ๆ/g, "พรุ่งนี้ค่อยเอาใหม่ แปะว่าเอาอยู่"],
  [/พรุ่งนี้ค่อยดึงกลับ ชิล ๆ/g, "พรุ่งนี้ค่อยดึงกลับ แปะว่าเอาอยู่"],
  [/ยังไม่นับเป็นมื้อให้อะ/g, "ยังไม่ลงมื้อให้ แปะขอดูของกินจริงนิดนึง"],
  [/ยังไม่ใช่มื้อที่แปะนับแคลให้ได้อะ/g, "ยังไม่ใช่มื้อที่แปะลงแคลให้ได้อะ"],
  [/แปะนับแคลให้น้องไม่ได้อะ/g, "น้องน่ารักอยู่ แปะเล่นด้วยได้ แต่เรื่องมื้อเดี๋ยวค่อยว่ากัน"],
  [/แปะดูแคลจากหน้าไม่ได้อะ/g, "ดูด้วยตาเปล่าไม่ได้หรอกลื้อ แปะขอดูของกินจริงดีกว่า กินให้อิ่ม นอนให้หลับ มีแรงไว้ก่อน 🍵"],
  [/ยังนับแคลไม่ได้อะ/g, "ยังลงแคลไม่ได้อะ"],
  [/นับแคลให้ไม่ถนัดอะ/g, "แปะยังอ่านแคลไม่ออกอะ"],
  [/ส่งรูปอาหารจริงมา เดี๋ยวแปะจัดให้/g, "ไหน... ส่งของกินจริงมาให้แปะดูสิ"],
  [/ส่งรูปอาหารมา เดี๋ยวแปะจัดให้/g, "ไหน... ส่งของกินมาให้แปะดูสิ"],
  [/ส่งรูปจานที่กินมา เดี๋ยวแปะจัดให้/g, "ไหน... ส่งจานที่กินมาให้แปะดูสิ"],
  [/ส่งรูปจานที่กินมา/g, "ไหน... ส่งจานที่กินมาให้แปะดูสิ"],
  [/ส่งอาหารจริงมาอีกทีได้เลย/g, "ไหน... ส่งของกินจริงมาให้แปะดูสิ"],
  [/ส่งรูปมื้อจริงมา แปะจัดให้/g, "ส่งมื้อจริงมา แปะดูให้"],
  [/เดี๋ยวจัดให้/g, "เดี๋ยวแปะดูให้"],
  [/กดดูแคลวันนี้ต่อได้เลย/g, "แตะดูแคลวันนี้ต่อได้เลย แปะจดไว้แล้ว"],
];

const CHINESE_FLAVOR_WORDS = /(อั๊วะ|ลื้อ|ไอหยา|เจี๊ยะ|โฮ่วเจี๊ยะ|เฮง|อาตี๋|หมวย|เฮีย|xiǎomāo|เสี่ยวเมา)/;

const FLAVOR_PREFIX_RULES = [
  {
    pattern: /(ล้ำเส้น|เกินเป้า|แคลพุ่ง|ตึง|หนัก|หลุด|ไขมัน|ของมัน|ทอด|หวาน|น้ำหวาน|ของหวาน|จุก|แน่น)/i,
    prefix: "ไอหยา ",
  },
  {
    pattern: /(ยังไม่มี|ไม่เจอ|หาแล้ว|ส่งใหม่|ลองส่ง|ลองใหม่|ไม่ใช่อาหาร|ยังไม่เห็น|ยังไม่ชัวร์)/i,
    prefix: "เอ้า ",
  },
  {
    pattern: /(โอเค|ได้อยู่|รอดอยู่|ผ่าน|โปรตีน|มีทรง|สวยละ|แปะว่าโอเค|เอาอยู่)/i,
    prefix: "โอเค ",
  },
];

const HAS_FLAVOR_PREFIX = /^(ไอหยา|เอ้า|โอ้โห|อือหือ|โอเค|หืม|อา\.{0,3}|แปะ|ลื้อ|อั๊วะ|เฮีย|อาตี๋|หมวย|เจี๊ยะ|โฮ่วเจี๊ยะ|xiǎomāo|เสี่ยวเมา|555|เออ|ใช่|สุดหล่อ)\b/i;
const LINE_ENDING_CLEANUPS = [
  [/\s+([!?！？,.，。])/g, "$1"],
  / {2,}/g,
];

const shouldSkipFlavor = (text = "") => {
  if (!text.trim()) return true;
  if (HAS_FLAVOR_PREFIX.test(text.trim())) return true;
  if (/^(📊|🔥|🏆|👀|❤️|🍲|🥚|🔍|🎯|🧾|🗑️|🏷️|🥗|📸)/.test(text.trim())) return true;
  if (/^[-•]/.test(text.trim())) return true;
  return false;
};

const addPrefixFlavor = (text = "") => {
  const lines = text.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return text;

  const line = lines[firstContentIndex].trimStart();
  if (shouldSkipFlavor(line)) return text;

  const rule = FLAVOR_PREFIX_RULES.find(({ pattern }) => pattern.test(line));
  if (!rule) return text;
  if (line.startsWith(rule.prefix.trim())) return text;

  lines[firstContentIndex] = lines[firstContentIndex].replace(line, `${rule.prefix}${line}`);
  return lines.join("\n");
};

const addThaiChatParticles = (text = "") => {
  return text
    .replace(/ไม่ต้องเครียด(?!นะ|อะ|แหละ)/g, "ไม่ต้องเครียดอะ")
    .replace(/ไม่ต้องตกใจ(?!นะ|อะ|แหละ)/g, "ไม่ต้องตกใจนะ")
    .replace(/พออยู่ท้องก็พอ(?!นะ|อะ|แหละ)/g, "พออยู่ท้องก็พอแหละ")
    .replace(/แค่ไม่ลากยาวพอ(?!นะ|อะ|แหละ)/g, "แค่ไม่ลากยาวพอแหละ")
    .replace(/แค่ไม่ซ้ำหนักก็พอ(?!นะ|อะ|แหละ)/g, "แค่ไม่ซ้ำหนักก็พอแหละ")
    .replace(/มื้อถัดไปเบาลงพอ(?!นะ|อะ|แหละ)/g, "มื้อถัดไปเบาลงพอแหละ")
    .replace(/ส่งมาใหม่อีกที(?!นะ|อะ|แหละ)/g, "ส่งมาใหม่อีกทีนะ")
    .replace(/ลองส่งใหม่อีกที(?!นะ|อะ|แหละ)/g, "ลองส่งใหม่อีกทีนะ")
    .replace(/ดูรวม ๆ แล้วคุมต่อได้(?!นะ|อะ|แหละ)/g, "ดูรวม ๆ แล้วคุมต่อได้อยู่")
    .replace(/ส่งรูปอาหารมา เดี๋ยวแปะนับให้(?!นะ|อะ|แหละ)/g, "ส่งรูปอาหารมา เดี๋ยวแปะนับให้เอง 👀");
};

const replaceFromBank = (text = "", bank = []) => {
  let output = text;
  for (const [pattern, replacement] of bank) {
    output = output.replace(pattern, replacement);
  }
  return output;
};

const textFlavorScore = (text = "") => {
  let total = 0;
  for (const char of String(text || "")) total += char.charCodeAt(0);
  return total % 5;
};

const addOccasionalChineseWarmth = (text = "") => {
  if (!text.trim()) return text;
  if (CHINESE_FLAVOR_WORDS.test(text)) return text;
  if (textFlavorScore(text) !== 0) return text;

  return text
    .replace(/พรุ่งนี้ค่อยเอาใหม่ แปะว่าเอาอยู่/g, "พรุ่งนี้ค่อยเอาใหม่ เฮง ๆ แปะว่าเอาอยู่")
    .replace(/พรุ่งนี้ค่อยดึงกลับ แปะว่าเอาอยู่/g, "พรุ่งนี้ค่อยดึงกลับ เฮง ๆ แปะว่าเอาอยู่")
    .replace(/เดี๋ยวแปะดูให้/g, "เดี๋ยวแปะดูให้ ลื้อไม่ต้องรีบ")
    .replace(/แปะว่าเอาอยู่/g, "แปะว่าเอาอยู่ เฮง ๆ");
};

export const sanitizePaeCalTone = (input = "") => {
  let text = String(input || "");

  text = replaceFromBank(text, DIALOGUE_REPLACEMENTS);
  text = replaceFromBank(text, SENSITIVE_BODY_REPLACEMENTS);
  text = replaceFromBank(text, PERSONALITY_COPY_REPLACEMENTS);
  text = addThaiChatParticles(text);
  text = addOccasionalChineseWarmth(text);
  text = addPrefixFlavor(text);

  text = text
    .replace(LINE_ENDING_CLEANUPS[0], "$1")
    .replace(LINE_ENDING_CLEANUPS[1], " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return text;
};

export const sanitizePaeCalTextMessages = (texts) => {
  const list = Array.isArray(texts) ? texts : [texts];
  return list.map((text) => sanitizePaeCalTone(text));
};
