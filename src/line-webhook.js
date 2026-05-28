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

const RICH_MENU_TEXT_ACTIONS = {
  MEAL_SUGGESTION: "กินอะไรดี",
  DAILY_SUMMARY: "สรุปวันนี้",
  DAILY_FOOD_WRAPPED: "สรุปวันนี้",
  FOOD_AURA: "สรุปวันนี้",
  TODAY_CALORIES: "แคลวันนี้",
  TODAY_NUTRITION: "สรุปวันนี้",
  SET_GOAL: "ตั้งเป้าสุขภาพ",
  EDIT_LAST_MEAL: "แก้มื้อล่าสุด",
  DELETE_LAST_MEAL: "ลบมื้อล่าสุด",
};

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

const routeTextAction = async (event, text) => {
  await handleTextMessage({
    ...event,
    type: "message",
    message: { type: "text", text },
  });
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
          await routeTextAction(event, "__FOLLOW__");
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

          if (postback.action === "SWITCH_TO_VIBE_MENU") {
            await replyText(
              event.replyToken,
              "ตอนนี้อยู่ฝั่งแปะอ่านทรงแล้วนะ 👀\nส่งรูปอาหารมา เดี๋ยวแปะอ่านให้"
            );
            continue;
          }

          if (postback.action === "SWITCH_TO_CAL_MENU") {
            await replyText(
              event.replyToken,
              "เปิดโหมดแปะแคลให้แล้วจ้า 🔥\nอยากดูแคลวันนี้ กดดูได้เลย"
            );
            continue;
          }

          const mappedText = RICH_MENU_TEXT_ACTIONS[postback.action];
          if (mappedText) {
            await routeTextAction(event, mappedText);
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
              "แปะสะดุดนิดนึง ลองส่งใหม่อีกทีนะ 😅"
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
