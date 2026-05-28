import { replyText } from "../services/line.js";

const normalizeLooseText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

const pick = (items = []) => items[Math.floor(Math.random() * items.length)] || "";

const FOOD_OR_SYSTEM_PATTERN = /(กิน|อาหาร|ข้าว|ก๋วยเตี๋ยว|บะหมี่|หมู|ไก่|ปลา|ไข่|ชา|กาแฟ|น้ำหวาน|แคล|kcal|โปรตีน|คาร์บ|ไขมัน|สรุป|ลบมื้อ|แก้มื้อ|ตั้งเป้า|เป้าหมาย|ฉายา|วันนี้อาหารฟ้อง|กินไรดี|กินอะไรดี)/i;

const PAECAL_SELF_PATTERN = /(แปะ|แปะแคล|paecal|pae\s*cal|ตัวเอง|นี่ใคร|คือใคร|รู้จักตัวเอง|จำตัวเอง|รูปแปะ|หน้าแปะ)/i;
const CAT_DOG_PATTERN = /(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat|หมา|สุนัข|dog|โฮ่ง|บ๊อก)/i;
const APP_LOGO_PATTERN = /(photoshop|โฟโต้ชอป|โฟโต้ช็อป|ps\b|logo|โลโก้|ไอคอน|icon|แอป|app|โปรแกรม)/i;
const PLAYFUL_GREETING_PATTERN = /^(ดี|หวัดดี|สวัสดี|อยู่ไหม|แปะอยู่ไหม|แปะ)$/i;

export const getPlayfulTextReply = (text = "") => {
  const value = normalizeLooseText(text);
  if (!value) return "";

  if (PAECAL_SELF_PATTERN.test(value)) {
    return pick([
      "เอ้า นั่นแปะเอง 555\nรูปนี้ลงแคลไม่ได้ แต่แปะให้ผ่านในหมวดความหล่อแบบมีอายุ 👀\nส่งอาหารมา เดี๋ยวตัวจริงดูให้",
      "ใช่ดิ นั่นแปะเอง 555\nแต่อย่าเอาแปะไปนับแคลนะ ลื้อส่งของกินมา เดี๋ยวแปะอ่านทรงให้",
      "อือหือ จำได้อยู่ นั่นแปะเอง 👀\nแต่รูปแปะไม่มี kcal นะ มีแต่ความตั้งใจดูแลลื้อ 555",
    ]);
  }

  if (CAT_DOG_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    if (/(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat)/i.test(value)) {
      return pick([
        "เอ้า แมวมาอีกแล้วเหรอ 555\nน่ารักอยู่ แต่แปะยังลงแคลให้น้องไม่ได้นะ\nถ้าลื้อกินอะไร ส่งจานมา เดี๋ยวแปะดูให้ 👀",
        "เหมียวได้อยู่ 555\nแต่น้องไม่ใช่มื้ออาหารนะ ลื้อส่งของกินมา แปะค่อยนับให้",
        "อันนี้สายแมวชัด ๆ 555\nแปะให้ผ่านหมวดน่ารัก แต่ยังไม่ลงแคลนะ 👀",
      ]);
    }

    return pick([
      "เอ้า น้องหมามา 555\nแปะให้คะแนนความน่ารักก่อน แต่แคลยังไม่ลงนะ\nส่งอาหารของลื้อมา เดี๋ยวแปะดูให้",
      "โฮ่งมาแบบนี้ แปะยิ้มอยู่ 555\nแต่ยังไม่ใช่ของกินนะ ลื้อส่งจานจริงมาได้เลย",
      "น้องหมาได้อยู่ 👀\nแต่แปะนับแคลให้น้องไม่ได้อะ ส่งมื้อของลื้อมาแทน",
    ]);
  }

  if (APP_LOGO_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า อันนี้ Photoshop นะ 555\nแปะนับแคลจากโลโก้ไม่ได้อะ\nส่งของกินมา เดี๋ยวแปะอ่านทรงให้ 👀",
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
