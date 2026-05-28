import express from "express";
import { Router } from "express";
import * as line from "@line/bot-sdk";

import { handleTextMessage } from "./handlers/textHandler.js";
import { handleImageMessage } from "./handlers/imageHandler.js";
import {
  replyFlex,
  replyPaeLaewGuideCard,
  replySendPhotoGuide,
  replyText,
  replyTypeFoodPrompt,
} from "./services/line.js";
import { postToSheet } from "./services/sheet.js";
import {
  buildFoodAuraFlexMessage,
  buildFoodWrappedFlexMessage,
  buildNutritionFlexMessage,
} from "./utils/richMenuFlex.js";
import { setupRichMenus } from "../scripts/setup-richmenus.js";

const app = express();
const router = Router();

const RICH_MENU_TEXT_ACTIONS = {
  MEAL_SUGGESTION: "กินอะไรดี",
  TODAY_CALORIES: "แคลวันนี้",
  SET_GOAL: "ตั้งเป้าสุขภาพ",
  EDIT_LAST_MEAL: "แก้มื้อล่าสุด",
  DELETE_LAST_MEAL: "ลบมื้อล่าสุด",
};

const SILENT_RICH_MENU_ACTIONS = new Set([
  "SWITCH_TO_VIBE_MENU",
  "SWITCH_TO_CAL_MENU",
  "open_keyboard",
]);

const nowMs = () => Date.now();
const logTiming = (label, start, extra = "") => {
  console.log(`[PaeCalTiming] ${label} ${Date.now() - start}ms${extra ? ` ${extra}` : ""}`);
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
  const start = nowMs();
  await handleTextMessage({
    ...event,
    type: "message",
    message: { type: "text", text },
  });
  logTiming("richMenu:routeTextAction", start, `text=${text}`);
};

const getDailySummaryForRichMenu = async (userId, action) => {
  const start = nowMs();
  const summary = await postToSheet({ action: "GET_DAILY_SUMMARY", userId });
  logTiming("richMenu:getDailySummary", start, `action=${action}`);
  return summary || {};
};

const replyFoodWrapped = async ({ replyToken, userId, action }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, action);
  const flex = action === "FOOD_AURA"
    ? buildFoodAuraFlexMessage({ summary })
    : buildFoodWrappedFlexMessage({ summary });

  await replyFlex(replyToken, flex);
  logTiming("richMenu:replyVibeFlex", start, `action=${action}`);
};

const replyNutrition = async ({ replyToken, userId }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, "TODAY_NUTRITION");
  await replyFlex(replyToken, buildNutritionFlexMessage({ summary }));
  logTiming("richMenu:replyNutritionFlex", start);
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

          console.log("LINE Postback received:", {
            userId: event.source.userId,
            data: postback.raw,
            action: postback.action,
          });

          if (SILENT_RICH_MENU_ACTIONS.has(postback.action)) {
            logTiming("richMenu:silent", eventStart, `action=${postback.action}`);
            continue;
          }

          if (postback.action === "OPEN_PAELAEW_GUIDE") {
            await replyPaeLaewGuideCard(event.replyToken);
            logTiming("richMenu:guideCard", eventStart, `action=${postback.action}`);
            continue;
          }

          if (postback.action === "TYPE_FOOD_PROMPT") {
            await replyTypeFoodPrompt(event.replyToken);
            logTiming("richMenu:typeFoodPrompt", eventStart);
            continue;
          }

          if (postback.action === "SEND_PHOTO_GUIDE") {
            await replySendPhotoGuide(event.replyToken);
            logTiming("richMenu:sendPhotoGuide", eventStart);
            continue;
          }

          if (postback.action === "DAILY_FOOD_WRAPPED" || postback.action === "FOOD_AURA" || postback.action === "DAILY_SUMMARY") {
            await replyFoodWrapped({
              replyToken: event.replyToken,
              userId: event.source.userId,
              action: postback.action,
            });
            logTiming("richMenu:vibeAction", eventStart, `action=${postback.action}`);
            continue;
          }

          if (postback.action === "TODAY_NUTRITION") {
            await replyNutrition({ replyToken: event.replyToken, userId: event.source.userId });
            logTiming("richMenu:nutritionAction", eventStart);
            continue;
          }

          const mappedText = RICH_MENU_TEXT_ACTIONS[postback.action];
          if (mappedText) {
            await routeTextAction(event, mappedText);
            logTiming("richMenu:textAction", eventStart, `action=${postback.action}`);
            continue;
          }

          console.log("Unhandled LINE postback:", postback.raw);
          logTiming("richMenu:unhandled", eventStart, `action=${postback.action}`);
          continue;
        }

        if (event.type !== "message") continue;

        if (event.message?.type === "text") {
          await handleTextMessage(event);
          logTiming("event:text", eventStart);
          continue;
        }

        if (event.message?.type === "image") {
          await handleImageMessage(event);
          logTiming("event:image", eventStart);
          continue;
        }
      } catch (err) {
        console.error("LINE Webhook Error:", err?.response?.data || err);
        logTiming("event:error", eventStart);

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
