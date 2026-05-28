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
  buildCalorieSummaryFlexMessage,
  buildFoodAuraFlexMessage,
  buildFoodWrappedFlexMessage,
  buildNutritionFlexMessage,
} from "./utils/richMenuFlex.js";
import { setupRichMenus } from "../scripts/setup-richmenus.js";

const app = express();
const router = Router();

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

const sheetAction = async (payload, label) => {
  const start = nowMs();
  const result = await postToSheet(payload);
  logTiming(`sheet:${label || payload.action}`, start);
  return result || {};
};

const getDailySummaryForRichMenu = async (userId, action) => {
  const summary = await sheetAction({ action: "GET_DAILY_SUMMARY", userId }, `GET_DAILY_SUMMARY action=${action}`);
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

const replyCalorieSummary = async ({ replyToken, userId }) => {
  const start = nowMs();
  const summary = await getDailySummaryForRichMenu(userId, "TODAY_CALORIES");
  await replyFlex(replyToken, buildCalorieSummaryFlexMessage({ summary }));
  logTiming("richMenu:replyCalorieSummaryFlex", start);
};

const replySetGoalFast = async ({ replyToken, userId }) => {
  const start = nowMs();
  await sheetAction({ action: "UPDATE_SESSION", userId, step: "ASK_GOAL_UPDATE", sessionData: {} }, "UPDATE_SESSION:setGoal");
  await replyText(
    replyToken,
    [
      "ได้เลย แปะเปิดโหมดตั้งเป้าให้แล้ว 🎯",
      "พิมพ์เป้าหมายมาได้เลย เช่น",
      "• อยากลดไขมัน",
      "• อยากคุมน้ำหนัก",
      "• อยากกินสุขภาพดีขึ้น",
    ].join("\n")
  );
  logTiming("richMenu:setGoalFast", start);
};

const replyEditMealFast = async ({ replyToken }) => {
  const start = nowMs();
  await replyText(
    replyToken,
    [
      "อยากแก้มื้อล่าสุดใช่ไหม 🧾",
      "พิมพ์แบบนี้ได้เลย:",
      "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว",
      "• แก้เป็น 650 kcal",
      "• ลบมื้อล่าสุด",
    ].join("\n")
  );
  logTiming("richMenu:editMealFast", start);
};

const replyDeleteLastMealFast = async ({ replyToken, userId }) => {
  const start = nowMs();
  const deleted = await sheetAction({ action: "DELETE_LAST_MEAL", userId }, "DELETE_LAST_MEAL:richMenu");

  if (deleted.status === "not_found") {
    await replyText(replyToken, "แปะยังไม่เจอมื้อล่าสุดให้ลบน้า 😅\nส่งรูปอาหารมาก่อน แล้วค่อยลบได้จ้า");
    logTiming("richMenu:deleteLastMealFast", start, "status=not_found");
    return;
  }

  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;
  await replyText(
    replyToken,
    [
      "โอเค แปะลบมื้อล่าสุดให้แล้ว 🗑️",
      `ลบ: ${deleted.deletedMeal?.menuName || "มื้อล่าสุด"}`,
      "",
      `วันนี้เหลือในระบบ: ${Math.round(total)} / ${Math.round(target)} kcal`,
    ].join("\n")
  );
  logTiming("richMenu:deleteLastMealFast", start);
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
          const userId = event.source.userId;

          console.log("LINE Postback received:", {
            userId,
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
            await replyFoodWrapped({ replyToken: event.replyToken, userId, action: postback.action });
            logTiming("richMenu:vibeAction", eventStart, `action=${postback.action}`);
            continue;
          }

          if (postback.action === "TODAY_CALORIES") {
            await replyCalorieSummary({ replyToken: event.replyToken, userId });
            logTiming("richMenu:calorieAction", eventStart);
            continue;
          }

          if (postback.action === "TODAY_NUTRITION") {
            await replyNutrition({ replyToken: event.replyToken, userId });
            logTiming("richMenu:nutritionAction", eventStart);
            continue;
          }

          if (postback.action === "SET_GOAL") {
            await replySetGoalFast({ replyToken: event.replyToken, userId });
            logTiming("richMenu:setGoalAction", eventStart);
            continue;
          }

          if (postback.action === "EDIT_LAST_MEAL") {
            await replyEditMealFast({ replyToken: event.replyToken });
            logTiming("richMenu:editMealAction", eventStart);
            continue;
          }

          if (postback.action === "DELETE_LAST_MEAL") {
            await replyDeleteLastMealFast({ replyToken: event.replyToken, userId });
            logTiming("richMenu:deleteMealAction", eventStart);
            continue;
          }

          if (postback.action === "MEAL_SUGGESTION") {
            await routeTextAction(event, "กินอะไรดี");
            logTiming("richMenu:mealSuggestionAction", eventStart);
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
            await replyText(replyToken, "แปะสะดุดนิดนึง ลองส่งใหม่อีกทีนะ 😅");
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
    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err.message || "Unknown setup error",
    });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`Server is running perfectly on port ${process.env.PORT || 10000}`);
});
