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
import { setupRichMenus } from "../scripts/setup-richmenus.js";

const app = express();
const router = Router();

const RICH_MENU_TEXT_ACTIONS = {
  MEAL_SUGGESTION: "กินอะไรดี",
  DAILY_SUMMARY: "แคลวันนี้",
  DAILY_FOOD_WRAPPED: "แคลวันนี้",
  FOOD_AURA: "วันนี้อาหารฟ้องว่า",
  TODAY_CALORIES: "แคลวันนี้",
  TODAY_NUTRITION: "แคลวันนี้",
  SET_GOAL: "ตั้งเป้าสุขภาพ",
  EDIT_LAST_MEAL: "แก้มื้อล่าสุด",
  DELETE_LAST_MEAL: "ลบมื้อล่าสุด",
};

const SILENT_RICH_MENU_ACTIONS = new Set([
  "SWITCH_TO_VIBE_MENU",
  "SWITCH_TO_CAL_MENU",
  "open_keyboard",
]);

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

          if (SILENT_RICH_MENU_ACTIONS.has(postback.action)) {
            continue;
          }

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

          const mappedText = RICH_MENU_TEXT_ACTIONS[postback.action];
          if (mappedText) {
            await routeTextAction(event, mappedText);
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

app.get("/admin/setup-richmenus", async (req, res) => {
  const configuredKey = process.env.PAECAL_ADMIN_SETUP_KEY;
  const requestKey = String(req.query.key || "").trim();

  if (!configuredKey) {
    return res.status(500).json({
      ok: false,
      error: "Missing PAECAL_ADMIN_SETUP_KEY env.",
    });
  }

  if (!requestKey || requestKey !== configuredKey) {
    return res.status(403).json({
      ok: false,
      error: "Invalid setup key.",
    });
  }

  try {
    const logs = [];
    const result = await setupRichMenus({
      logger: {
        log: (message) => {
          logs.push(String(message));
          console.log(`[RichMenuSetup] ${message}`);
        },
      },
    });

    return res.json({
      ok: true,
      result,
      logs,
    });
  } catch (err) {
    console.error("Rich menu setup failed:", err?.response?.data || err);
    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err.message || "Unknown setup error",
    });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`Server is running perfectly on port ${process.env.PORT || 10000}`);
});
