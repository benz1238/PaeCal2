const ALIAS_RULES = [
  { canonicalKey: "หมูกระทะ", aliases: ["หมูทะ", "หมูกะทะ", "หมูกระทะ", "บุฟหมูทะ", "บุฟเฟต์หมูทะ", "ปิ้งย่าง"] },
  { canonicalKey: "ชาบู", aliases: ["ชาบู", "สุกี้", "hotpot", "hot pot"] },
  { canonicalKey: "มัทฉะ/ชาเขียว", aliases: ["ชาเขียวเพียว", "ชาเขียวมัจฉะ", "ชาเขียวมัทฉะ", "มัจฉะเพียว", "มัทฉะเพียว", "matcha", "matcha pure", "ชาเขียวไม่หวาน"] },
  { canonicalKey: "ชาไทย", aliases: ["ชาไทย", "ชาเย็น", "ชานมไทย", "ชาตรามือ"] },
  { canonicalKey: "ข้าวแกงสองอย่าง", aliases: ["ข้าวแกงสองอย่าง", "ข้าวแกง 2 อย่าง", "ข้าวราดแกงสองอย่าง", "ข้าวราดแกง 2 อย่าง", "ข้าวแกงสองกับ", "ข้าวแกง"] },
  { canonicalKey: "ไก่ทอดหน้าโรงเรียน", aliases: ["ไก่ทอดหน้าโรงเรียน", "ไก่ทอดหน้า รร", "ไก่ทอดรร", "ไก่ทอดโรงเรียน", "ไก่หน้าโรงเรียน"] },
  { canonicalKey: "หมูปิ้ง", aliases: ["หมูปิ้ง", "หมูปิ้ง 5 ไม้", "หมูปิ้งห้าไม้", "หมูปิ้งไม้", "หมูปิ้งนมสด"] },
  { canonicalKey: "ไส้กรอกชีส", aliases: ["ไส้กรอกชีส", "ใส้กรอกชีส", "ไส้กรอกชีสส", "ชีสไส้กรอก"] },
  { canonicalKey: "ลูกชิ้นปลาระเบิด", aliases: ["ลูกชิ้นปลาระเบิด", "ลูกชิ้นปลา ระเบิด", "ลูกชิ้นทอด", "ลูกชิ้นปลาทอด"] },
  { canonicalKey: "ข้าวขาหมู", aliases: ["ข้าวขาหมู", "ขาหมู", "คากิ", "ข้าวคากิ"] },
  { canonicalKey: "ข้าวมันไก่", aliases: ["ข้าวมันไก่", "ข้าวมันไก่ต้ม", "ข้าวมันไก่ทอด"] },
  { canonicalKey: "ข้าวหมูกรอบ", aliases: ["ข้าวหมูกรอบ", "หมูกรอบ", "ข้าวกะเพราหมูกรอบ", "ข้าวกระเพราหมูกรอบ"] },
  { canonicalKey: "กะเพรา", aliases: ["กะเพรา", "กระเพรา", "ผัดกะเพรา", "ผัดกระเพรา", "ข้าวกะเพรา", "ข้าวกระเพรา"] },
  { canonicalKey: "เมนูเส้น", aliases: ["ก๋วยเตี๋ยว", "บะหมี่", "ราเมง", "มาม่า", "เส้นเล็ก", "เส้นหมี่", "เส้นใหญ่"] },
  { canonicalKey: "ของหวาน", aliases: ["เค้ก", "ขนม", "โดนัท", "คุกกี้", "ไอติม", "ไอศกรีม", "บิงซู", "บราวนี่"] },
];

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const escapeRegExp = (text = "") => String(text).replace(ESCAPE_RE, "\\$&");

export const normalizeFoodText = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[!！?？.,，、;；:：()[\]{}"'“”‘’]/g, " ")
  .replace(/[~ๆ]+/g, "")
  .replace(/^\s*(วันนี้|เมื่อกี้|มื้อเช้า|มื้อเที่ยง|มื้อเย็น|ตอนนี้)?\s*(กิน|กินไป|จัด|ซัด|แดก)\s+/i, "")
  .replace(/\s+/g, " ")
  .trim();

const compact = (value = "") => normalizeFoodText(value).replace(/\s+/g, "");

export const canonicalizeFoodTerm = (value = "") => {
  const normalized = normalizeFoodText(value);
  const compacted = compact(normalized);

  for (const rule of ALIAS_RULES) {
    const matchedAliases = rule.aliases.filter((alias) => {
      const aliasNorm = normalizeFoodText(alias);
      const aliasCompact = compact(alias);
      return normalized.includes(aliasNorm) || compacted.includes(aliasCompact);
    });

    if (matchedAliases.length) {
      return {
        raw: value,
        normalized,
        canonicalKey: rule.canonicalKey,
        matchedAliases,
      };
    }
  }

  return {
    raw: value,
    normalized,
    canonicalKey: normalized,
    matchedAliases: [],
  };
};

export const extractFoodTermCandidates = (text = "") => {
  const normalized = normalizeFoodText(text);
  if (!normalized) return [];

  const candidates = [];
  const seen = new Set();

  for (const rule of ALIAS_RULES) {
    for (const alias of rule.aliases) {
      const aliasNorm = normalizeFoodText(alias);
      const aliasCompact = compact(alias);
      if (!aliasNorm) continue;
      if (normalized.includes(aliasNorm) || compact(normalized).includes(aliasCompact)) {
        if (!seen.has(rule.canonicalKey)) {
          candidates.push({
            raw: alias,
            normalized: aliasNorm,
            canonicalKey: rule.canonicalKey,
            matchedAliases: [alias],
          });
          seen.add(rule.canonicalKey);
        }
      }
    }
  }

  if (candidates.length) return candidates;

  return normalized
    .split(/\s*(?:\+|,|และ|กับ|พร้อม|\n)\s*/i)
    .map((part) => canonicalizeFoodTerm(part))
    .filter((item) => item.normalized && item.normalized.length >= 2)
    .filter((item) => {
      if (seen.has(item.canonicalKey)) return false;
      seen.add(item.canonicalKey);
      return true;
    });
};

export const getAliasRules = () => ALIAS_RULES;
