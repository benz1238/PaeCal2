import { getLastMeal, getProfile } from "../services/db.js";
import { replyText } from "../services/line.js";

const nowMs = () => Date.now();
const logTiming = (label, start, extra = "") => console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);

const normalize = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/[\sๆ~!！?？.。…。、,，:：;；\-_=+*()[\]{}"'“”‘’`]+/g, "");

const nameQuestions = new Set(["ฉันชื่ออะไร", "ชื่อฉันคืออะไร", "แปะจำชื่อฉันได้ไหม", "แปะจำชื่อฉันได้มั้ย"]);
const goalQuestions = new Set(["เป้าหมายของฉันคืออะไร", "เป้าหมายตอนนี้คืออะไร", "เป้าสุขภาพของฉันคืออะไร"]);
const lastMealQuestions = new Set(["มื้อก่อนหน้าคืออะไร", "มื้อล่าสุดคืออะไร", "ล่าสุดกินอะไร"]);

const getName = (profile = {}) => String(profile.name || profile.displayName || "").trim();
const getTitle = (profile = {}) => String(profile.title || getName(profile) || "ลื้อ").trim();

const nameReply = (profile = {}) => {
  const name = getName(profile);
  const title = getTitle(profile);
  if (!name) return "แปะยังไม่มีชื่อที่จดไว้เลยนะ 👀\nพิมพ์แบบนี้ได้: ฉันชื่อเบ๊นซ์";
  return `จำได้อยู่ 😄\nลื้อชื่อ ${name}\nแปะเรียกตอนนี้ว่า ${title}`;
};

const goalReply = (profile = {}) => {
  const title = getTitle(profile);
  const goal = String(profile.goal || "").trim();
  const target = Number(profile.calorieTarget || 0);
  if (!goal) return `${title} ยังไม่ได้ตั้งเป้าไว้นะ 👀\nพิมพ์ “ตั้งเป้า” ได้เลย เดี๋ยวแปะดูให้`;
  return `${title} เป้าที่จดไว้คือ:\n${goal}${target ? `\nเป้าต่อวันประมาณ ${Math.round(target)} kcal` : ""}\nแปะว่าโอเคอยู่`;
};

const lastMealReply = (latest = {}) => {
  const meal = latest?.meal || null;
  if (!meal) return "แปะยังไม่เจอมื้อล่าสุดของวันนี้นะ 👀\nส่งรูปหรือพิมพ์เมนูมาก่อนได้เลย";
  const kcal = Number(meal.kcal || 0);
  return `มื้อล่าสุดคือ ${meal.menuName || "อาหาร"}\n${kcal ? `ประมาณ ${Math.round(kcal)} kcal` : "แคลยังไม่ชัด"}\nมื้อนี้แปะจดไว้แล้ว`;
};

export const handleProfileQuestionText = async (event) => {
  const start = nowMs();
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const key = normalize(event.message?.text || "");
  if (!userId || !key) return false;

  if (nameQuestions.has(key)) {
    const profile = await getProfile(userId);
    await replyText(replyToken, nameReply(profile));
    logTiming("event:profileQuestionFast", start, "type=name");
    return true;
  }

  if (goalQuestions.has(key)) {
    const profile = await getProfile(userId);
    await replyText(replyToken, goalReply(profile));
    logTiming("event:profileQuestionFast", start, "type=goal");
    return true;
  }

  if (lastMealQuestions.has(key)) {
    const latest = await getLastMeal(userId);
    await replyText(replyToken, lastMealReply(latest));
    logTiming("event:profileQuestionFast", start, "type=lastMeal");
    return true;
  }

  return false;
};
