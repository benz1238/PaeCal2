import axios from "axios";
import * as line from "@line/bot-sdk";
import { buildDailyRecapFlexMessageNew } from "../utils/dailyRecapFlexNew.js";
import { buildFoodLogFlexMessage } from "../utils/foodLogFlex.js";
import { sanitizePaeCalTone } from "../utils/toneSanitizer.js";

export const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const sanitizeTextList = (texts) => {
  const list = Array.isArray(texts) ? texts : [texts];
  return list.map((text) => sanitizePaeCalTone(text)).filter(Boolean).slice(0, 5);
};

const toTextMessages = (texts) => sanitizeTextList(texts).map((text) => ({ type: "text", text }));
const numberFrom = (value = "", fallback = 0) => {
  const match = String(value || "").match(/([0-9,]+)/);
  const num = Number(match?.[1]?.replace(/,/g, ""));
  return Number.isFinite(num) ? num : fallback;
};

const getLineAfter = (text = "", label = "") => {
  const lines = String(text || "").split("\n").map((line) => line.trim());
  const index = lines.findIndex((line) => line.includes(label));
  return index >= 0 ? lines[index + 1] || "" : "";
};

const macroFrom = (text = "") => ({
  carb: numberFrom(String(text).match(/คาร์บ\s*([0-9,]+)/i)?.[1], 0),
  protein: numberFrom(String(text).match(/โปรตีน\s*([0-9,]+)/i)?.[1], 0),
  fat: numberFrom(String(text).match(/ไขมัน\s*([0-9,]+)/i)?.[1], 0),
});

const isFoodTextBatch = (texts = []) => {
  const first = texts[0] || "";
  return /เมนู|🍽️/.test(first) && /kcal/i.test(first) && /คาร์บ|โปรตีน|ไขมัน/.test(first);
};

const parseFoodBatchCard = (texts = []) => {
  const first = texts[0] || "";
  const second = texts[1] || "";
  const macro = macroFrom(first);
  const ratio = second.match(/([0-9,]+)\s*\/\s*([0-9,]+)\s*kcal/i);
  const total = ratio ? numberFrom(ratio[1], 0) : numberFrom(second, numberFrom(first, 0));
  const target = ratio ? numberFrom(ratio[2], 2050) : 2050;
  const portion = (first.split("\n").find((line) => line.includes("ปริมาณ")) || "").replace(/^.*ปริมาณ:\s*/, "") || "พอดี";
  const meal = {
    menuName: getLineAfter(first, "เมนู") || "มื้อที่ส่งมา",
    kcal: numberFrom(first, 0),
    carb: macro.carb,
    protein: macro.protein,
    fat: macro.fat,
    sugar: 0,
    portionLabel: portion,
  };
  return buildFoodLogFlexMessage({ meal, total, target, estimateMode: "image" });
};

const toOutboundMessages = (texts) => {
  const sanitized = sanitizeTextList(texts);
  if (sanitized.length >= 1 && isFoodTextBatch(sanitized)) return [parseFoodBatchCard(sanitized)].slice(0, 5);
  return sanitized.map((text) => ({ type: "text", text }));
};

export const replyText = async (replyToken, text) => client.replyMessage({ replyToken, messages: toTextMessages(text) });
export const replyTexts = async (replyToken, texts) => client.replyMessage({ replyToken, messages: toOutboundMessages(texts) });
export const pushText = async (to, text) => client.pushMessage({ to, messages: toTextMessages(text) });
export const pushTexts = async (to, texts) => client.pushMessage({ to, messages: toOutboundMessages(texts) });

export const getLineDisplayName = async (userId) => {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    return res.data?.displayName || "";
  } catch {
    return "";
  }
};

export const getLineImageBase64 = async (messageId) => {
  const res = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data, "binary").toString("base64");
};

const paeLaewGuideFlex = () => ({
  type: "flex",
  altText: "ส่งรูปอาหารให้แปะอ่าน",
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      backgroundColor: "#FFF7ED",
      contents: [
        { type: "text", text: "📸 ส่งรูปให้แปะอ่าน", weight: "bold", size: "xl", wrap: true, color: "#1F2937" },
        { type: "text", text: "กดปุ่มด้านล่างเพื่อถ่ายรูปหรือเลือกรูปอาหารได้เลย\nเดี๋ยวแปะดูให้ว่าเมนูนี้ประมาณไหน 👀", size: "sm", wrap: true, color: "#374151" },
      ],
    },
  },
});

const withPhotoQuickReply = (message) => ({
  ...message,
  quickReply: {
    items: [
      { type: "action", action: { type: "camera", label: "ถ่ายรูป" } },
      { type: "action", action: { type: "cameraRoll", label: "เลือกรูป" } },
    ],
  },
});

export const replyFlex = async (replyToken, messages) => {
  const list = Array.isArray(messages) ? messages : [messages];
  await client.replyMessage({ replyToken, messages: list.filter(Boolean).slice(0, 5) });
};

export const pushFlex = async (to, messages) => {
  const list = Array.isArray(messages) ? messages : [messages];
  await client.pushMessage({ to, messages: list.filter(Boolean).slice(0, 5) });
};

export const replyPaeLaewGuideCard = async (replyToken) => replyFlex(replyToken, paeLaewGuideFlex());
export const replySendPhotoGuide = async (replyToken) => client.replyMessage({ replyToken, messages: [withPhotoQuickReply(paeLaewGuideFlex())] });
export const replyTypeFoodPrompt = async (replyToken) => replyText(replyToken, "พิมพ์มื้อที่กินมาได้เลย\nสั้น ๆ ก็ได้ เดี๋ยวแปะดูให้ 😄");

export const replyDailyRecapCardWithBubbles = async (replyToken, { title = "ลื้อ", bubbles = [], summary = {}, decision = null }) => {
  const bubbleMessages = toTextMessages(Array.isArray(bubbles) ? bubbles : [bubbles]).slice(0, 2);
  const mascotUrl = process.env.PAECAL_RECAP_MASCOT_URL || "";
  const flexMessage = buildDailyRecapFlexMessageNew({ title, summary, decision: decision || {}, characterUrl: mascotUrl });
  await client.replyMessage({ replyToken, messages: [flexMessage, ...bubbleMessages].slice(0, 5) });
};

export const pushDailyRecapCardWithBubbles = async (to, { title = "ลื้อ", bubbles = [], summary = {}, decision = null }) => {
  const bubbleMessages = toTextMessages(Array.isArray(bubbles) ? bubbles : [bubbles]).slice(0, 2);
  const mascotUrl = process.env.PAECAL_RECAP_MASCOT_URL || "";
  const flexMessage = buildDailyRecapFlexMessageNew({ title, summary, decision: decision || {}, characterUrl: mascotUrl });
  await client.pushMessage({ to, messages: [flexMessage, ...bubbleMessages].slice(0, 5) });
};
