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
const THANKS_PATTERN = /(ขอบคุณ|แต๊ง|thanks|thank you|thx|ขอบใจ)/i;
const LAUGH_PATTERN = /^(5{2,}|555\+?|ฮ่า+|ฮา+|ขำ|lol|lmao)$/i;
const AFFECTION_PATTERN = /(รักแปะ|แปะน่ารัก|น่ารักจัง|เก่งมาก|ดีมาก|เยี่ยม|สุดยอด)/i;
const SMALL_TALK_PATTERN = /(ทำไรอยู่|ทำอะไรอยู่|เหงา|ง่วง|เบื่อ|เหนื่อย|วันนี้เป็นไง|คุยเล่น|เล่นด้วย|แซวหน่อย)/i;

export const getPlayfulTextReply = (text = "") => {
  const value = normalizeLooseText(text);
  if (!value) return "";

  if (PAECAL_SELF_PATTERN.test(value)) {
    return pick([
      "ใช่ นี่อั๊วะเอง 555\nแปะยืนเฝ้าครัวอยู่ ไม่ได้อู้ 👀",
      "ใช่ดิ นี่อั๊วะเอง 👀\nหน้าตาแบบนี้หาไม่ได้ง่ายนะ 555",
      "เอ้า! จำได้อยู่ นี่แปะเอง\nวันนี้แปะพร้อมประจำการแล้ว",
    ]);
  }

  if (CAT_DOG_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    if (/(แมว|เหมียว|เมี๊ยว|เมี้ยว|มิว|cat)/i.test(value)) {
      return pick([
        "xiǎomāo lailai มาม่ะ 🐱\nน่ารักขนาดนี้ แปะขอลูบหัวก่อน 555",
        "เอ้า! เสี่ยวเมามาแล้ว 555\nแปะให้ผ่านหมวดน่ารักก่อนเลย 👀",
        "xiǎomāo มาม่ะ ๆ 👀\nน้องน่ารัก แปะยิ้มแล้ว",
      ]);
    }

    return pick([
      "เอ้า! น้องหมามา 555\nโฮ่ว น่ารักอยู่ แปะให้ผ่านก่อน 👀",
      "โฮ่งมาแบบนี้ แปะยิ้มอยู่ 555\nน้องได้อยู่มาก",
      "น้องหมาได้อยู่ 👀\nแปะขอเล่นกับน้องแป๊บ",
    ]);
  }

  if (PHOTOSHOP_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า! Photoshop มาเฉย 555\nแปะเกือบหยิบช้อนแล้วเนี่ย",
      "Photoshop กินไม่ได้เด้อ 555\nแปะขอวางตะเกียบก่อน",
      "อันนี้ Photoshop นะ 👀\nแปะอ่านแล้วได้กลิ่นงาน ไม่ได้กลิ่นข้าว 555",
    ]);
  }

  if (APP_LOGO_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "เอ้า! โลโก้มาแล้ว 555\nแปะขอชมก่อน สีดูมีทรงอยู่",
      "ไอคอนแอปกินไม่ได้เด้อ 555\nแต่ถ้าถามว่าดูน่ากดไหม แปะว่าได้อยู่",
      "อันนี้ดูเป็นโลโก้/แอปนะ 👀\nแปะขอทำหน้าเซียนก่อน 555",
    ]);
  }

  if (THANKS_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "ได้เลยลื้อ แปะอยู่ตรงนี้แหละ 😄",
      "ไม่เป็นไร อั๊วะช่วยได้ก็ช่วย 555",
      "โอเค ๆ ไปต่อได้ แปะเฝ้าอยู่ 👀",
    ]);
  }

  if (LAUGH_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "หัวเราะแบบนี้ แปะถือว่ารอด 555",
      "เอ้า! ขำแล้วใช่มะ แปะก็ขำด้วย 555",
      "ดี ๆ ขำไว้ก่อน ชีวิตจะได้ไม่ฝืด 👀",
    ]);
  }

  if (AFFECTION_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "แหม ลื้อพูดแบบนี้ แปะเขินนะ 555",
      "โอ้โห! วันนี้แปะได้กำลังใจแล้วหนึ่ง 😄",
      "อั๊วะรับคำชมไว้ก่อน ไม่คืนแล้วนะ 555",
    ]);
  }

  if (SMALL_TALK_PATTERN.test(value) && !FOOD_OR_SYSTEM_PATTERN.test(value)) {
    return pick([
      "แปะนั่งเฝ้าครัวอยู่ 555\nใครเปิดตู้เย็น แปะเห็นหมดนะ 👀",
      "ตอนนี้แปะกำลังทำหน้าจริงจัง\nแต่ในใจอยากกินเกี๊ยว 555",
      "เหงาได้ แต่อย่าเหงาจนสั่งหวานเพิ่มนะลื้อ 555",
      "ง่วงก็พักก่อน เดี๋ยวค่อยว่ากัน\nสุขภาพต้องมาก่อน แปะพูดจริง 🍵",
    ]);
  }

  if (PLAYFUL_GREETING_PATTERN.test(value)) {
    return pick([
      "อยู่ ๆ แปะมาแล้ว 👀\nวันนี้ให้แปะช่วยอะไรดี",
      "มาแล้วลื้อ\nแปะประจำการอยู่หน้าครัว 555",
      "แปะอยู่ตรงนี้แหละ\nเรียกทีเดียวก็มา เอ้า!",
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
