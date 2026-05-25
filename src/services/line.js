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
  altText: "แปะเลย กินอะไรมา?",
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
          text: "🍚 แปะเลย กินอะไรมา?",
          weight: "bold",
          size: "xl",
          wrap: true,
          color: "#1F2937",
        },
        {
          type: "text",
          text: "ส่งรูปอาหารก็ได้\nหรือพิมพ์บอกแปะสั้น ๆ ก็ได้",
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
          text: "พิมพ์แบบนี้ได้เลย:",
          weight: "bold",
          size: "sm",
          color: "#111827",
          margin: "md",
        },
        {
          type: "text",
          text: "- ข้าวมันไก่ 1 จาน\n- ชาไทยหวานน้อย\n- ขนมเลย์ 1 ห่อ\n- มื้อเที่ยงกินสุกี้น้ำกับไข่ต้ม",
          size: "sm",
          wrap: true,
          color: "#4B5563",
        },
        {
          type: "text",
          text: "หลายอย่างก็พิมพ์แยกบรรทัดมาได้เลย\nแปะจะแยกแคลคร่าว ๆ แล้วรวมของวันนี้ให้เอง 😄",
          size: "sm",
          wrap: true,
          color: "#374151",
          margin: "md",
        },
        {
          type: "text",
          text: "ไม่รู้เรียกเมนูว่าอะไร ก็ส่งรูปมาได้\nเดี๋ยวแปะดูให้เอง 👀",
          size: "sm",
          wrap: true,
          color: "#6B7280",
          margin: "sm",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          action: {
            type: "postback",
            label: "พิมพ์มื้ออาหาร",
            data: "action=TYPE_FOOD_PROMPT",
          },
          color: "#E53935",
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "ส่งรูปอาหาร",
                data: "action=SEND_PHOTO_GUIDE",
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "กินอะไรดี",
                data: "action=MEAL_SUGGESTION",
              },
            },
          ],
        },
      ],
      flex: 0,
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
