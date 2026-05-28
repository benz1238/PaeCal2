import axios from "axios";
import * as line from "@line/bot-sdk";
import { buildDailyRecapFlexMessageNew } from "../utils/dailyRecapFlexNew.js";
import { sanitizePaeCalTone } from "../utils/toneSanitizer.js";

export const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const toTextMessages = (texts) => {
  const list = Array.isArray(texts) ? texts : [texts];

  return list
    .map((text) => sanitizePaeCalTone(text))
    .filter(Boolean)
    .slice(0, 5)
    .map((text) => ({ type: "text", text }));
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
    messages: toTextMessages(texts),
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
    messages: toTextMessages(texts),
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
        {
          type: "text",
          text: "📸 ส่งรูปให้แปะอ่าน",
          weight: "bold",
          size: "xl",
          wrap: true,
          color: "#1F2937",
        },
        {
          type: "text",
          text: "ถ่ายอาหารให้เห็นชัด ๆ แล้วส่งมาได้เลย เดี๋ยวแปะดูให้ว่าเมนูนี้ประมาณไหน 👀",
          size: "sm",
          wrap: true,
          color: "#374151",
          margin: "sm",
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          paddingAll: "md",
          cornerRadius: "lg",
          backgroundColor: "#FFFFFF",
          contents: [
            {
              type: "text",
              text: "แปะจะช่วยดูให้",
              size: "xs",
              weight: "bold",
              color: "#B45309",
            },
            {
              type: "text",
              text: ["🔥 แคลคร่าว ๆ", "🍚 คาร์บ / โปรตีน / ไขมัน", "👀 ทรงมื้อนี้หนักหรือเบา"].join("\n"),
              size: "sm",
              wrap: true,
              color: "#374151",
              margin: "xs",
            },
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
            {
              type: "text",
              text: "ทริคให้แปะอ่านแม่นขึ้น",
              size: "xs",
              weight: "bold",
              color: "#166534",
            },
            {
              type: "text",
              text: "ถ้ามีหลายอย่างในจาน พิมพ์เพิ่มได้ เช่น “ข้าวมันไก่ + ชาไทยหวานน้อย”",
              size: "sm",
              wrap: true,
              color: "#374151",
              margin: "xs",
            },
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
          action: {
            type: "postback",
            label: "เปิดกล้อง/อัลบั้มเลย",
            data: "action=open_keyboard",
            inputOption: "openKeyboard",
          },
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
