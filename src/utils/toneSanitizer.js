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

const LINE_ENDING_CLEANUPS = [
  [/\s+([!?！？,.，。])/g, "$1"],
  / {2,}/g,
];

export const sanitizePaeCalTone = (input = "") => {
  let text = String(input || "");

  for (const [pattern, replacement] of DIALOGUE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

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
