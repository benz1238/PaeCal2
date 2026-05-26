import axios from "axios";
import * as line from "@line/bot-sdk";

export const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const toTextMessages = (texts) => {
  const list = Array.isArray(texts) ? texts : [texts];

  return list
    .map((text) => String(text || "").trim())
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
  altText: "แปะเลย ลื้อกินอะไรมา?",
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "🍚 แปะเลย ลื้อกินอะไรมา?",
          weight: "bold",
          size: "xl",
          wrap: true,
          color: "#1F2937",
        },
        {
          type: "text",
          text: "ส่งรูปอาหารก็ได้ หรือพิมพ์สั้น ๆ ก็ได้ เดี๋ยวแปะดูให้ 😄",
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
          backgroundColor: "#FFF7ED",
          contents: [
            {
              type: "text",
              text: "ตัวอย่าง",
              size: "xs",
              weight: "bold",
              color: "#B45309",
            },
            {
              type: "text",
              text: ["ข้าวมันไก่ 1 จาน", "ชาไทยหวานน้อย", "ขนมเลย์ห่อนึง"].join("\n"),
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
              text: "ถ้ากินหลายอย่าง",
              size: "xs",
              weight: "bold",
              color: "#166534",
            },
            {
              type: "text",
              text: "พิมพ์เว้นด้วย , / และ\nหรือแยกบรรทัดได้เลย\nแปะจะแยกแคลให้ 👌",
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
          color: "#E11D1D",
          action: {
            type: "postback",
            label: "แปะเลย",
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
  await replyText(
    replyToken,
    ["ส่งรูปอาหารเข้ามาในแชตได้เลยนะ 👀", "กดรูป/อัลบั้มใน LINE แล้วส่งมาให้แปะดูได้เลย"].join("\n")
  );
};

const normalizeFlexText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const recapRow = (label, value, options = {}) => ({
  type: "box",
  layout: "horizontal",
  spacing: "sm",
  contents: [
    {
      type: "text",
      text: label,
      size: "sm",
      color: "#6B7280",
      flex: 4,
      wrap: true,
    },
    {
      type: "text",
      text: normalizeFlexText(value),
      size: "sm",
      color: options.color || "#111827",
      weight: options.weight || "regular",
      align: "end",
      flex: 6,
      wrap: true,
    },
  ],
});

const dailyRecapFlex = ({ title, card }) => ({
  type: "flex",
  altText: "สรุปวันนี้จากแปะแคล",
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `📊 สรุปวันนี้ของ ${normalizeFlexText(title, "ลื้อ")}`,
          weight: "bold",
          size: "lg",
          wrap: true,
          color: "#1F2937",
        },
        {
          type: "text",
          text: normalizeFlexText(card?.statusText, "วันนี้แปะรวมให้แล้วจ้า"),
          size: "sm",
          wrap: true,
          color: card?.statusColor || "#374151",
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          margin: "md",
          contents: [
            recapRow("🔥 กินไป", card?.kcalText, { weight: "bold", color: card?.kcalColor || "#111827" }),
            recapRow("🍚 คาร์บ", card?.carbText, { color: card?.carbColor || "#111827" }),
            recapRow("💪 โปรตีน", card?.proteinText, { color: card?.proteinColor || "#047857" }),
            recapRow("💧 ไขมัน", card?.fatText, { color: card?.fatColor || "#111827" }),
            recapRow("🍽️ จำนวนมื้อ", card?.mealCountText),
          ],
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          margin: "md",
          contents: [
            recapRow("🎯 เป้า", card?.goalText || "ยังไม่ได้ตั้งเป้าสุขภาพ"),
            recapRow("👀 มื้อเด่น", card?.topMealText || "ยังไม่มีมื้อเด่น"),
          ],
        },
      ],
    },
  },
});

export const replyDailyRecapCardWithBubbles = async (replyToken, { title, card, bubbles = [] }) => {
  const bubbleMessages = (Array.isArray(bubbles) ? bubbles : [bubbles])
    .map((text) => String(text || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text) => ({ type: "text", text }));

  await client.replyMessage({
    replyToken,
    messages: [dailyRecapFlex({ title, card }), ...bubbleMessages].slice(0, 5),
  });
};

export const pushFlex = async (to, messages) => {
  const list = Array.isArray(messages) ? messages : [messages];

  await client.pushMessage({
    to,
    messages: list.filter(Boolean).slice(0, 5),
  });
};

export const pushDailyRecapCardWithBubbles = async (to, { title, card, bubbles = [] }) => {
  const bubbleMessages = (Array.isArray(bubbles) ? bubbles : [bubbles])
    .map((text) => String(text || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text) => ({ type: "text", text }));

  await client.pushMessage({
    to,
    messages: [dailyRecapFlex({ title, card }), ...bubbleMessages].slice(0, 5),
  });
};

