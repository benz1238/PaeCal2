import express from "express";
import { Router } from "express";
import * as line from "@line/bot-sdk";

import { handleTextMessage } from "./handlers/textHandler.js";
import { handleImageMessage } from "./handlers/imageHandler.js";
import { replyText } from "./services/line.js";

const app = express();
const router = Router();

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
        console.error("LINE Webhook Error:", {
          name: err?.name,
          action: err?.action,
          status: err?.status,
          message: err?.message || String(err),
          preview: err?.preview,
        });

        try {
          if (event.replyToken) {
            await replyText(
              event.replyToken,
              "เมื่อกี้แปะวูบไปแป๊บนึง 😵‍💫\nลองส่งใหม่อีกทีนะ"
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
