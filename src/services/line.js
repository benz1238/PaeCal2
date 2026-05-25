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
