const normalizeTextCommand = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[\sๆ~!！?？.。…。、,，:：;；\-_=+*()[\]{}"'“”‘’`]+/g, "");

const TEXT_ACTION_ALIASES = new Map([
  ["ลบมื้อล่าสุด", "DELETE_LAST_MEAL"],
  ["ลบมื้อ", "DELETE_LAST_MEAL"],
  ["ลบล่าสุด", "DELETE_LAST_MEAL"],
  ["ลบมื้อเมื่อกี้", "DELETE_LAST_MEAL"],
  ["ลบมื้อก่อนหน้า", "DELETE_LAST_MEAL"],
  ["ลบมื้อก่อน", "DELETE_LAST_MEAL"],
  ["ลบอันก่อนหน้า", "DELETE_LAST_MEAL"],
  ["ลบอันก่อน", "DELETE_LAST_MEAL"],
  ["ลบรายการก่อนหน้า", "DELETE_LAST_MEAL"],

  ["แก้มื้อล่าสุด", "EDIT_LAST_MEAL"],
  ["แก้มื้อ", "EDIT_LAST_MEAL"],
  ["แก้มื้อเมื่อกี้", "EDIT_LAST_MEAL"],
  ["แก้ไขมื้อล่าสุด", "EDIT_LAST_MEAL"],

  ["ตั้งเป้าหมาย", "SET_GOAL"],
  ["ตั้งเป้าสุขภาพ", "SET_GOAL"],
  ["ตั้งเป้า", "SET_GOAL"],
  ["เปลี่ยนเป้า", "SET_GOAL"],
  ["เปลี่ยนเป้าหมาย", "SET_GOAL"],
  ["ตั้งเป้าใหม่", "SET_GOAL"],

  ["แคลวันนี้", "TODAY_CALORIES"],
  ["ดูแคลวันนี้", "TODAY_CALORIES"],
  ["ดูแคล", "TODAY_CALORIES"],

  ["โภชนาการ", "TODAY_NUTRITION"],
  ["ดูโภชนาการ", "TODAY_NUTRITION"],
  ["สารอาหารวันนี้", "TODAY_NUTRITION"],

  ["สรุปวันนี้", "TODAY_CALORIES"],
  ["todayrecap", "TODAY_CALORIES"],

  ["วันนี้อาหารฟ้องว่า", "DAILY_FOOD_WRAPPED"],
  ["อาหารฟ้องว่า", "DAILY_FOOD_WRAPPED"],
  ["อ่านทรงวันนี้", "DAILY_FOOD_WRAPPED"],

  ["ฉายาวันนี้", "FOOD_AURA"],
  ["ฉายา", "FOOD_AURA"],
  ["foodaura", "FOOD_AURA"],

  ["กินอะไรดี", "MEAL_SUGGESTION"],
  ["กินไรดี", "MEAL_SUGGESTION"],

  ["แปะรูปอาหาร", "SEND_PHOTO_GUIDE"],
  ["ส่งรูปอาหาร", "SEND_PHOTO_GUIDE"],
  ["ส่งรูปให้แปะอ่าน", "SEND_PHOTO_GUIDE"],
  ["ถ่ายรูปอาหาร", "SEND_PHOTO_GUIDE"],

  ["ถามแปะ", "TYPE_FOOD_PROMPT"],
  ["พิมพ์อาหาร", "TYPE_FOOD_PROMPT"],
]);

export const resolveTypedRichMenuAction = (text = "") => TEXT_ACTION_ALIASES.get(normalizeTextCommand(text)) || "";

export const buildSyntheticPostback = (action) => ({
  raw: `typed:${action}`,
  action,
  params: new URLSearchParams(`action=${encodeURIComponent(action)}`),
});
