const DIALOGUE_REPLACEMENTS = [
  [/จ้า/g, "นะ"],
  [/น้า/g, "นะ"],
  [/ครับ/g, ""],
  [/ค่ะ/g, ""],
  [/คะ/g, ""],
  [/เฮีย/g, "แปะ"],
  [/เจ๊/g, "แปะ"],
  [/อาตี๋/g, "ลื้อ"],
  [/หมวย/g, "ลื้อ"],
];

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

const HAS_FLAVOR_PREFIX = /^(ไอหยา|เอ้า|โอ้โห|อือหือ|โอเค|หืม|อา\.{0,3}|แปะ|ลื้อ|555|เออ)\b/i;
const LINE_ENDING_CLEANUPS = [
  [/\s+([!?！？,.，。])/g, "$1"],
  / {2,}/g,
];

const shouldSkipFlavor = (text = "") => {
  if (!text.trim()) return true;
  if (HAS_FLAVOR_PREFIX.test(text.trim())) return true;
  if (/^(📊|🔥|🏆|👀|❤️|🍲|🥚|🔍|🎯|🧾|🗑️)/.test(text.trim())) return true;
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

  // Avoid awkward repeats like "โอเค โอเค..." or "ไอหยา ไอหยา...".
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
    .replace(/ลองส่งใหม่อีกที(?!นะ|อะ|แหละ)/g, "ลองส่งใหม่อีกทีนะ");
};

export const sanitizePaeCalTone = (input = "") => {
  let text = String(input || "");

  for (const [pattern, replacement] of DIALOGUE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = addThaiChatParticles(text);
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
