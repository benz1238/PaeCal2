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
          text: "ส่งรูปอาหารหรือจะพิมพ์บอกแปะสั้น ๆ ก็ได้",
          size: "md",
          wrap: true,
          color: "#374151",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "text",
          text: "เช่น:",
          weight: "bold",
          size: "sm",
          color: "#111827",
          margin: "md",
        },
        {
          type: "text",
          text: "ข้าวมันไก่ 1 จาน\nชาไทยหวาน 25\nขนมเลย์ 1 ห่อ",
          size: "sm",
          wrap: true,
          color: "#4B5563",
        },
        {
          type: "text",
          text: "หลายอย่างพิมพ์แยกบรรทัดได้เลย\nเดี๋ยวแปะแยกแคลให้ 😄",
          size: "sm",
          wrap: true,
          color: "#374151",
          margin: "md",
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
    "ส่งรูปอาหารเข้ามาในแชตได้เลยนะ 👀\nกดรูป/อัลบั้มใน LINE แล้วส่งมาให้แปะดูได้เลย"
  );
};
