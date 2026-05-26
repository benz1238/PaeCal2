import express from "express";
import { Router } from "express";
import * as line from "@line/bot-sdk";

import { handleTextMessage } from "./handlers/textHandler.js";
import { handleImageMessage } from "./handlers/imageHandler.js";
import {
  replyPaeLaewGuideCard,
  replySendPhotoGuide,
  replyText,
  replyTypeFoodPrompt,
} from "./services/line.js";

const app = express();
const router = Router();

const parsePostbackData = (data) => {
  const raw = String(data || "").trim();

  try {
    const params = new URLSearchParams(raw);
    return {
      raw,
      action: params.get("action") || "",
      params,
    };
  } catch (err) {
    return {
      raw,
      action: "",
      params: new URLSearchParams(),
    };
  }
};

router.post(
  "/webhook",
  line.middleware({
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  }),
  async (req, res) => {
    res.status(200).json({ ok: true });

    const events = req.body.events || [];

    for (const event of events) {
      try {
        if (!event.source?.userId) continue;

        if (event.type === "follow") {
          await handleTextMessage({
            ...event,
            type: "message",
            message: { type: "text", text: "__FOLLOW__" },
          });
          continue;
        }

        if (event.type === "postback") {
          const postback = parsePostbackData(event.postback?.data);

          console.log("LINE Postback received:", {
            userId: event.source.userId,
            data: postback.raw,
            action: postback.action,
          });

          if (postback.action === "OPEN_PAELAEW_GUIDE") {
            await replyPaeLaewGuideCard(event.replyToken);
            continue;
          }

          if (postback.action === "TYPE_FOOD_PROMPT") {
            await replyTypeFoodPrompt(event.replyToken);
            continue;
          }

          if (postback.action === "SEND_PHOTO_GUIDE") {
            await replySendPhotoGuide(event.replyToken);
            continue;
          }

          if (postback.action === "MEAL_SUGGESTION") {
            await handleTextMessage({
              ...event,
              type: "message",
              message: { type: "text", text: "กินอะไรดี" },
            });
            continue;
          }

          if (postback.action === "DAILY_SUMMARY") {
            await handleTextMessage({
              ...event,
              type: "message",
              message: { type: "text", text: "สรุปวันนี้" },
            });
            continue;
          }

          if (postback.action === "open_keyboard") {
            continue;
          }

          console.log("Unhandled LINE postback:", postback.raw);
          continue;
        }

        if (event.type !== "message") continue;

        if (event.message?.type === "text") {
          await handleTextMessage(event);
          continue;
        }

        if (event.message?.type === "image") {
          await handleImageMessage(event);
          continue;
        }
      } catch (err) {
        console.error("LINE Webhook Error:", err?.response?.data || err);

        try {
          if (event.replyToken) {
            await replyText(
              event.replyToken,
              "แปะขออภัย ระบบสะดุดนิดนึง ลองส่งใหม่อีกทีนะจ๊ะ 🙏"
            );
          }
        } catch (replyErr) {
          console.error("Reply error:", replyErr?.response?.data || replyErr);
        }
      }
    }
  }
);

app.use("/api/line", router);

app.get("/", (req, res) => {
  res.status(200).send("Pae Cal LINE Bot is running.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "pae-cal-line-bot",
    time: new Date().toISOString(),
  });
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`Server is running perfectly on port ${process.env.PORT || 10000}`);
});
