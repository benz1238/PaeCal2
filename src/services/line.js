import axios from "axios";
import * as line from "@line/bot-sdk";
import { buildDailyRecapFlexMessageNew } from "../utils/dailyRecapFlexNew.js";
import { sanitizePaeCalTone } from "../utils/toneSanitizer.js";

export const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const sanitizeTextList = (texts) => {
  const list = Array.isArray(texts) ? texts : [texts];
  return list.map((text) => sanitizePaeCalTone(text)).filter(Boolean).slice(0, 5);
};

const toTextMessages = (texts) => sanitizeTextList(texts).map((text) => ({ type: "text", text }));

const getLineAfter = (text = "", label = "") => {
  const lines = String(text || "").split("\n").map((line) => line.trim());
  const index = lines.findIndex((line) => line.includes(label));
  if (index < 0) return "";
  return lines[index + 1] || "";
};

const splitMacroLine = (line = "") => {
  const carb = line.match(/คาร์บ\s*([0-9]+)g?/i)?.[1] || "-";
  const protein = line.match(/โปรตีน\s*([0-9]+)g?/i)?.[1] || "-";
  const fat = line.match(/ไขมัน\s*([0-9]+)g?/i)?.[1] || "-";
  return { carb, protein, fat };
};

const extractKcalValue = (text = "") => {
  const match = String(text || "").match(/~?\s*([0-9,]+)\s*kcal/i);
  return match?.[1]?.replace(/,/g, "") || "-";
};

const extractMacroLine = (text = "") => String(text || "").split("\n").find((line) => /คาร์บ|โปรตีน|ไขมัน/.test(line)) || "";
const extractPortionLine = (text = "") => String(text || "").split("\n").find((line) => /ปริมาณ/.test(line)) || "";

const buildProgressTextBubble = (progressText = "") => {
  const lines = String(progressText || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const kcalLine = lines.find((line) => /\/|kcal/i.test(line)) || "";
  const statusLine = lines.find((line) => /เกินเป้า|เหลือประมาณ|กินไปแล้ว/i.test(line) && line !== kcalLine) || "";

  return [
    "📊 วันนี้รวมแล้ว",
    kcalLine || lines.find((line) => /[0-9]/.test(line)) || "ยังไม่มีตัวเลขชัด",
    statusLine || "แปะจดรวมให้แล้ว",
    "เดี๋ยวมื้อต่อไปค่อยคุมต่อได้ 👀",
  ].filter(Boolean).join("\n");
};

const buildInsightTextBubble = (insightText = "") => {
  const text = String(insightText || "").trim();
  if (!text) return "ไอหยา แปะอ่านทรงให้แล้ว\nมื้อต่อไปค่อยบาลานซ์ต่อได้ 😄";

  const normalized = text
    .replace(/^💡\s*/, "")
    .replace(/😮‍💨/g, "😅")
    .trim();

  if (/ของทอด|มัน|ไขมัน|หวาน|น้ำตาล|คาร์บ|เกิน|เต็ม/.test(normalized)) {
    return `ไอหยา ${normalized}`;
  }

  if (/โปรตีน|โอเค|คุมได้|เบา/.test(normalized)) {
    return `โอเค ${normalized}`;
  }

  return normalized;
};

const buildImageFoodResultFlex = (texts = []) => {
  const first = texts[0] || "";
  const menuName = getLineAfter(first, "เมนู") || "มื้อที่ส่งมา";
  const kcalValue = extractKcalValue(first);
  const macro = splitMacroLine(extractMacroLine(first));
  const portionLine = extractPortionLine(first).replace(/^📏\s*/, "") || "ปริมาณ: พอดี";

  return {
    type: "flex",
    altText: "แปะอ่านทรงอาหารให้แล้ว",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFF7ED",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          { type: "text", text: "👀 แปะอ่านทรงให้แล้ว", size: "sm", weight: "bold", color: "#D97706", wrap: true },
          { type: "text", text: menuName, size: "xl", weight: "bold", color: "#1F2937", wrap: true },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFFFFF",
            cornerRadius: "16px",
            paddingAll: "14px",
            spacing: "md",
            contents: [
              { type: "text", text: `🔥 ~${kcalValue} kcal`, size: "xl", weight: "bold", color: "#B91C1C", wrap: true },
              { type: "separator", margin: "sm" },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "🍚 คาร์บ", size: "xs", color: "#6B7280", flex: 2 },
                  { type: "text", text: `${macro.carb} g`, size: "sm", weight: "bold", color: "#1F2937", align: "end", flex: 1 },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "💪 โปรตีน", size: "xs", color: "#6B7280", flex: 2 },
                  { type: "text", text: `${macro.protein} g`, size: "sm", weight: "bold", color: "#1F2937", align: "end", flex: 1 },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "🥑 ไขมัน", size: "xs", color: "#6B7280", flex: 2 },
                  { type: "text", text: `${macro.fat} g`, size: "sm", weight: "bold", color: "#1F2937", align: "end", flex: 1 },
                ],
              },
              { type: "separator", margin: "sm" },
              { type: "text", text: `📏 ${portionLine}`, size: "sm", color: "#374151", wrap: true },
            ],
          },
          { type: "text", text: "แปะจดมื้อนี้ไว้ให้แล้ว 👀", size: "sm", color: "#003C88", weight: "bold", align: "center", wrap: true },
        ],
      },
    },
  };
};

const isImageFoodTextBatch = (texts = []) => {
  const first = texts[0] || "";
  const second = texts[1] || "";
  return /🍽️\s*เมนู|เมนู\n/.test(first) && /kcal/i.test(first) && /วันนี้กินไปแล้ว|วันนี้รวมแล้ว|kcal/i.test(second);
};

const toOutboundMessages = (texts) => {
  const sanitized = sanitizeTextList(texts);
  if (sanitized.length >= 2 && isImageFoodTextBatch(sanitized)) {
    return [
      buildImageFoodResultFlex(sanitized),
      { type: "text", text: buildProgressTextBubble(sanitized[1] || "") },
      { type: "text", text: buildInsightTextBubble(sanitized[2] || "") },
    ].slice(0, 5);
  }
  return sanitized.map((text) => ({ type: "text", text }));
};

export const replyText = async (replyToken, text) => {
  await client.replyMessage({
    replyToken,
    messages: toTextMessages(text),
  });
};

export const replyTexts = async (replyToken, texts) => {
  await client.replyMessage({
    replyToken,
    messages: toOutboundMessages(texts),
  });
};

export const pushText = async (to, text) => {
  await client.pushMessage({
    to,
    messages: toTextMessages(text),
  });
};

export const pushTexts = async (to, texts) => {
  await client.pushMessage({
    to,
    messages: toOutboundMessages(texts),
  });
};

export const getLineDisplayName = async (userId) => {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    return res.data?.displayName || "";
  } catch (err) {
    return "";
  }
};

export const getLineImageBase64 = async (messageId) => {
  const res = await axios.get(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      responseType: "arraybuffer",
    }
  );

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
        { type: "text", text: "ถ่ายอาหารให้เห็นชัด ๆ แล้วส่งมาได้เลย เดี๋ยวแปะดูให้ว่าเมนูนี้ประมาณไหน 👀", size: "sm", wrap: true, color: "#374151", margin: "sm" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          paddingAll: "md",
          cornerRadius: "lg",
          backgroundColor: "#FFFFFF",
          contents: [
            { type: "text", text: "แปะจะช่วยดูให้", size: "xs", weight: "bold", color: "#B45309" },
            { type: "text", text: ["🔥 แคลคร่าว ๆ", "🍚 คาร์บ / โปรตีน / ไขมัน", "👀 ทรงมื้อนี้หนักหรือเบา"].join("\n"), size: "sm", wrap: true, color: "#374151", margin: "xs" },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "sm",
          paddingAll: "md",
          cornerRadius: "lg",
          backgroundColor: "#F0FDF4",
          contents: [
            { type: "text", text: "ทริคให้แปะอ่านแม่นขึ้น", size: "xs", weight: "bold", color: "#166534" },
            { type: "text", text: "ถ้ามีหลายอย่างในจาน พิมพ์เพิ่มได้ เช่น “ข้าวมันไก่ + ชาไทยหวานน้อย”", size: "sm", wrap: true, color: "#374151", margin: "xs" },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#D97706",
          action: { type: "postback", label: "เปิดกล้อง/อัลบั้มเลย", data: "action=open_keyboard", inputOption: "openKeyboard" },
        },
      ],
    },
  },
});

export const replyFlex = async (replyToken, messages) => {
  const list = Array.isArray(messages) ? messages : [messages];

  await client.replyMessage({
    replyToken,
    messages: list.filter(Boolean).slice(0, 5),
  });
};

export const replyPaeLaewGuideCard = async (replyToken) => {
  await replyFlex(replyToken, paeLaewGuideFlex());
};

export const replyTypeFoodPrompt = async (replyToken) => {
  await replyText(
    replyToken,
    "พิมพ์มื้อที่กินมาได้เลย\nสั้น ๆ ก็ได้ เดี๋ยวแปะดูให้ 😄"
  );
};

export const replySendPhotoGuide = async (replyToken) => {
  await replyPaeLaewGuideCard(replyToken);
};

export const replyDailyRecapCardWithBubbles = async (replyToken, { title, card, bubbles = [], summary = {}, decision = null }) => {
  const bubbleMessages = toTextMessages(Array.isArray(bubbles) ? bubbles : [bubbles]).slice(0, 2);

  const mascotUrl = process.env.PAECAL_RECAP_MASCOT_URL || "";
  const flexMessage = buildDailyRecapFlexMessageNew({ title, summary, decision: decision || {}, characterUrl: mascotUrl });

  await client.replyMessage({
    replyToken,
    messages: [flexMessage, ...bubbleMessages].slice(0, 5),
  });
};

export const pushFlex = async (to, messages) => {
  const list = Array.isArray(messages) ? messages : [messages];

  await client.pushMessage({
    to,
    messages: list.filter(Boolean).slice(0, 5),
  });
};

export const pushDailyRecapCardWithBubbles = async (to, { title, card, bubbles = [], summary = {}, decision = null }) => {
  const bubbleMessages = toTextMessages(Array.isArray(bubbles) ? bubbles : [bubbles]).slice(0, 2);

  const mascotUrl = process.env.PAECAL_RECAP_MASCOT_URL || "";
  const flexMessage = buildDailyRecapFlexMessageNew({ title, summary, decision: decision || {}, characterUrl: mascotUrl });

  await client.pushMessage({
    to,
    messages: [flexMessage, ...bubbleMessages].slice(0, 5),
  });
};
