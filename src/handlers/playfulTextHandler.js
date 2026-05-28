import { replyText } from "../services/line.js";

const normalizeLooseText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

const pick = (items = []) => items[Math.floor(Math.random() * items.length)] || "";

const FOOD_OR_SYSTEM_PATTERN = /(กิน|อาหาร|ข้าว|ก๋วยเตี๋ยว|บะหมี่|หมู|ไก่|ปลา|ไข่|ชา|กาแฟ|น้ำหวาน|แคล|kcal|โปรตีน|คาร์บ|ไขมัน|สรุป|ลบมื้อ|แก้มื้อ|ตั้งเป้า|เป้าหมาย|ฉายา|วันนี้อาหารฟ้อง|กินไรดี|กินอะไรดี)/i;

const PAECAL_SELF_PATTERN = /(แปะ|แปะแคล|paecal|pae\s*cal|ตัวเอง|นี่ใคร|คือใคร|รู้จักตัวเอง|จำตัวเอง|รูปแปะ|หน้าแปะ)/i;
const CAT_DOG_PATTERN = /(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat|หมา|สุนัข|dog|โฮ่ง|บ๊อก)/i;
const PHOTOSHOP_PATTERN = /(photoshop|โฟโต้ชอป|โฟโต้ช็อป|ps\b|adobe\s*photoshop)/i;
const APP_LOGO_PATTERN = /(logo|โลโก้|ไอคอน|icon|แอป|app|โปรแกรม)/i;
const PLAYFUL_GREETING_PATTERN = /^(ดี|หวัดดี|สวัสดี|อยู่ไหม|แปะอยู่ไหม|แปะ)$/i;

export const getPlayfulTextReply = (text = "") => {
  const value = normalizeLooseText(text);
  if (!value) return "";

  if (PAECAL_SELF_PATTERN.test(value)) {
    return pick([
      "ใช่ นี่อั๊วะเอง 555\nแต่อย่าเอาแปะไปนับแคลนะ ลื้อส่งของกินมา เดี๋ยวแปะอ่านทรงให้ 👀",
      "ใช่ดิ นี่อั๊วะเอง 👀\nรูปแปะไม่มี kcal นะ มีแต่ความตั้งใจดูแลลื้อ 555\nส่งอาหารมา เดี๋ยวอั๊วะดูให้",
      "เอ้า จำได้อยู่ นี่แปะเอง 555\nส่งของกินมาดีกว่า เดี๋ยวแปะอ่านทรงให้",
    ]);
  }

  if (CAT_DOG_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    if (/(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat)/i.test(value)) {
      return pick([
        "xiǎomāo lailai มาม่ะ 🐱\nน่ารักอยู่ แต่แปะยังลงแคลให้น้องไม่ได้นะ 555\nลื้อส่งของกินมา เดี๋ยวแปะอ่านทรงให้ 👀",
        "เอ้า เสี่ยวเมามาแล้ว 555\nแปะให้ผ่านหมวดน่ารัก แต่ยังไม่ใช่มื้ออาหารนะ\nส่งจานของลื้อมา เดี๋ยวดูให้",
        "xiǎomāo น่ารักแหละ 👀\nแต่น้องไม่มี kcal ให้แปะจดนะ 555\nของกินลื้ออยู่ไหน ส่งมา ๆ",
      ]);
    }

    return pick([
      "เอ้า น้องหมามา 555\nแปะให้คะแนนความน่ารักก่อน แต่แคลยังไม่ลงนะ\nส่งอาหารของลื้อมา เดี๋ยวแปะดูให้",
      "โฮ่งมาแบบนี้ แปะยิ้มอยู่ 555\nแต่ยังไม่ใช่ของกินนะ ลื้อส่งจานจริงมาได้เลย",
      "น้องหมาได้อยู่ 👀\nแต่แปะนับแคลให้น้องไม่ได้อะ ส่งมื้อของลื้อมาแทน",
    ]);
  }

  if (PHOTOSHOP_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า Photoshop มาเฉย 555\nอันนี้แปะนับแคลไม่ได้อะ\nส่งของกินมา เดี๋ยวแปะอ่านทรงให้ 👀",
      "Photoshop กินไม่ได้เด้อ 555\nแปะยังลงมื้อให้ไม่ได้\nเอารูปอาหารมาดีกว่า เดี๋ยวดูให้",
      "อันนี้ Photoshop นะ 👀\nไม่ใช่ของกิน แปะยังไม่กล้าจดเป็นมื้อ 555\nส่งจานจริงมาได้เลย",
    ]);
  }

  if (APP_LOGO_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า อันนี้โลโก้/ไอคอนนะ 555\nแปะนับแคลจากแอปไม่ได้อะ\nส่งของกินมา เดี๋ยวแปะอ่านทรงให้ 👀",
      "ไอคอนแอปกินไม่ได้เด้อ 555\nแปะยังลงมื้อให้ไม่ได้\nเอารูปอาหารมาดีกว่า เดี๋ยวดูให้",
      "อันนี้ดูเป็นโลโก้/แอปนะ 👀\nแปะยังไม่กล้านับเป็นมื้ออาหาร 555\nส่งจานจริงมาได้เลย",
    ]);
  }

  if (PLAYFUL_GREETING_PATTERN.test(value)) {
    return pick([
      "อยู่ ๆ แปะมาแล้ว 👀\nวันนี้กินอะไรมา ส่งมาให้แปะอ่านทรงได้เลย",
      "มาแล้ว ลื้อจะให้แปะดูมื้อไหน 👀\nส่งรูปหรือพิมพ์อาหารมาก็ได้",
      "แปะอยู่ตรงนี้แหละ 555\nมีมื้อไหนอยากให้ดู ส่งมาเลย",
    ]);
  }

  return "";
};

export const handlePlayfulText = async (event) => {
  const text = event.message?.text || "";
  const reply = getPlayfulTextReply(text);
  if (!reply) return false;

  await replyText(event.replyToken, reply);
  return true;
};
