import express from "express";
import { Router } from "express";
import * as line from "@line/bot-sdk";

import { handleImageMessage } from "./handlers/imageHandler.js";
import { handleMealChoiceText } from "./handlers/mealChoiceHandler.js";
import { handleFastFoodText } from "./handlers/fastFoodTextHandler.js";
import {
  handleRichMenuPostback,
  logTiming,
  parsePostbackData,
  routeTextAction,
} from "./handlers/richMenuHandler.js";
import { handleTextMessage } from "./handlers/textHandler.js";
import { replyText } from "./services/line.js";
import { setupRichMenus } from "../scripts/setup-richmenus.js";

const app = express();
const router = Router();
const nowMs = () => Date.now();

const normalizeTextCommand = (value = "") => String(value || "").trim().toLowerCase().replace(/\s+/g, "");

const TEXT_ACTION_ALIASES = new Map([
  ["ลบมื้อล่าสุด", "DELETE_LAST_MEAL"],
  ["ลบมื้อ", "DELETE_LAST_MEAL"],
  ["ลบล่าสุด", "DELETE_LAST_MEAL"],
  ["แก้มื้อล่าสุด", "EDIT_LAST_MEAL"],
  ["แก้มื้อ", "EDIT_LAST_MEAL"],
  ["ตั้งเป้าหมาย", "SET_GOAL"],
  ["ตั้งเป้า", "SET_GOAL"],
  ["เปลี่ยนเป้า", "SET_GOAL"],
  ["แคลวันนี้", "TODAY_CALORIES"],
  ["ดูแคลวันนี้", "TODAY_CALORIES"],
  ["ดูแคล", "TODAY_CALORIES"],
  ["โภชนาการ", "TODAY_NUTRITION"],
  ["ดูโภชนาการ", "TODAY_NUTRITION"],
  ["วันนี้อาหารฟ้องว่า", "DAILY_FOOD_WRAPPED"],
  ["อาหารฟ้องว่า", "DAILY_FOOD_WRAPPED"],
  ["ฉายาวันนี้", "FOOD_AURA"],
  ["ฉายา", "FOOD_AURA"],
  ["กินอะไรดี", "MEAL_SUGGESTION"],
  ["กินไรดี", "MEAL_SUGGESTION"],
]);

const resolveTypedRichMenuAction = (text = "") => TEXT_ACTION_ALIASES.get(normalizeTextCommand(text)) || "";

router.post("/webhook", line.middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }), async (req, res) => {
  res.status(200).json({ ok: true });
  const events = req.body.events || [];

  for (const event of events) {
    const eventStart = nowMs();

    try {
      if (!event.source?.userId) continue;

      if (event.type === "follow") {
        await routeTextAction(event, "__FOLLOW__");
        logTiming("event:follow", eventStart);
        continue;
      }

      if (event.type === "postback") {
        const postback = parsePostbackData(event.postback?.data);
        const userId = event.source.userId;
        console.log("LINE Postback received:", { userId, data: postback.raw, action: postback.action });

        const handled = await handleRichMenuPostback({ event, postback, eventStart });
        if (!handled) {
          console.log("Unhandled LINE postback:", postback.raw);
          logTiming("richMenu:unhandled", eventStart, `action=${postback.action}`);
        }
        continue;
      }

      if (event.type !== "message") continue;

      if (event.message?.type === "text") {
        const text = String(event.message?.text || "").trim();
        const typedAction = resolveTypedRichMenuAction(text);
        if (typedAction) {
          console.log("LINE Text action routed:", { userId: event.source.userId, text, action: typedAction });
          await routeTextAction(event, typedAction);
          logTiming("event:textAction", eventStart, `action=${typedAction}`);
          continue;
        }

        const handledMealChoice = await handleMealChoiceText(event);
        if (handledMealChoice) {
          logTiming("event:textFast", eventStart);
          continue;
        }

        const handledFastFood = await handleFastFoodText(event);
        if (handledFastFood) {
          logTiming("event:textFastFood", eventStart);
          continue;
        }

        await handleTextMessage(event);
        logTiming("event:text", eventStart);
        continue;
      }

      if (event.message?.type === "image") {
        await handleImageMessage(event);
        logTiming("event:image", eventStart);
      }
    } catch (err) {
      console.error("LINE Webhook Error:", err?.response?.data || err);
      logTiming("event:error", eventStart);

      try {
        if (event.replyToken) {
          await replyText(event.replyToken, "แปะสะดุดนิดนึง ลองส่งใหม่อีกทีนะ 😅");
        }
      } catch (replyErr) {
        console.error("Reply error:", replyErr?.response?.data || replyErr);
      }
    }
  }
});

app.use("/api/line", router);

app.get("/", (req, res) => {
  res.status(200).send("Pae Cal LINE Bot is running.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "pae-cal-line-bot", time: new Date().toISOString() });
});

app.get("/admin/setup-richmenus", async (req, res) => {
  const configuredKey = process.env.PAECAL_ADMIN_SETUP_KEY;
  const requestKey = String(req.query.key || "").trim();

  if (!configuredKey) {
    return res.status(500).json({ ok: false, error: "Missing PAECAL_ADMIN_SETUP_KEY env." });
  }

  if (!requestKey || requestKey !== configuredKey) {
    return res.status(403).json({ ok: false, error: "Invalid setup key." });
  }

  try {
    const logs = [];
    const setupStart = nowMs();
    const result = await setupRichMenus({
      logger: {
        log: (message) => {
          logs.push(String(message));
          console.log(`[RichMenuSetup] ${message}`);
        },
      },
    });
    logTiming("admin:setupRichMenus", setupStart);
    return res.json({ ok: true, result, logs });
  } catch (err) {
    console.error("Rich menu setup failed:", err?.response?.data || err);
    return res.status(500).json({ ok: false, error: err?.response?.data || err.message || "Unknown setup error" });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`Server is running perfectly on port ${process.env.PORT || 10000}`);
});
