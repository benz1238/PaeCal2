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
      "ใช่ นี่อั๊วะเอง 555\nแปะยืนรออ่านทรงของกินอยู่ ส่งมาให้ดูสิ 👀",
      "ใช่ดิ นี่อั๊วะเอง 👀\nรูปแปะไม่มี kcal นะ มีแต่ความตั้งใจดูแลลื้อ 555\nไหน... ส่งของกินมาให้แปะดูสิ",
      "เอ้า จำได้อยู่ นี่แปะเอง 555\nมีของกินอะไรให้แปะดูบ้าง ส่งมาเลย",
    ]);
  }

  if (CAT_DOG_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    if (/(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat)/i.test(value)) {
      return pick([
        "xiǎomāo lailai มาม่ะ 🐱\nน่ารักขนาดนี้ แปะขอลูบหัวก่อน 555\nแล้วลื้อมีอะไรกิน ส่งมาให้แปะดูสิ",
        "เอ้า เสี่ยวเมามาแล้ว 555\nแปะให้ผ่านหมวดน่ารักก่อนเลย 👀\nไหน... ของกินลื้ออยู่ไหน",
        "xiǎomāo มาม่ะ ๆ 👀\nน้องน่ารัก แปะยิ้มแล้ว\nทีนี้ส่งของกินลื้อมาบ้าง เดี๋ยวแปะดูให้",
      ]);
    }

    return pick([
      "เอ้า น้องหมามา 555\nโฮ่ว น่ารักอยู่ แปะให้ผ่านก่อน 👀\nแล้วลื้อกินอะไร ส่งมาให้แปะดูสิ",
      "โฮ่งมาแบบนี้ แปะยิ้มอยู่ 555\nน้องได้อยู่มาก\nไหน... ของกินลื้ออยู่ไหน",
      "น้องหมาได้อยู่ 👀\nแปะขอเล่นกับน้องแป๊บ\nแล้วค่อยมาดูมื้อลื้อ ส่งมาเลย",
    ]);
  }

  if (PHOTOSHOP_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า Photoshop มาเฉย 555\nอันนี้แปะยังอ่านทรงของกินไม่ออกอะ\nไหน... ส่งของกินมาให้แปะดูสิ 👀",
      "Photoshop กินไม่ได้เด้อ 555\nแปะขอดูของกินจริงนิดนึง\nส่งมา เดี๋ยวแปะอ่านทรงให้",
      "อันนี้ Photoshop นะ 👀\nไม่ใช่ของกิน แปะยังไม่กล้าจดเป็นมื้อ 555\nไหน... จานจริงอยู่ไหน",
    ]);
  }

  if (APP_LOGO_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า อันนี้โลโก้/ไอคอนนะ 555\nแปะยังอ่านเป็นมื้อไม่ได้อะ\nไหน... ส่งของกินมาให้แปะดูสิ 👀",
      "ไอคอนแอปกินไม่ได้เด้อ 555\nแปะขอดูของกินจริงนิดนึง\nส่งมา เดี๋ยวดูให้",
      "อันนี้ดูเป็นโลโก้/แอปนะ 👀\nแปะยังไม่กล้าจดเป็นมื้อ 555\nจานจริงมาหน่อย",
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
