{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 HelveticaNeue;\f1\fnil\fcharset222 Thonburi;\f2\fnil\fcharset0 AppleColorEmoji;
\f3\fnil\fcharset0 LucidaGrande;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab560
\pard\pardeftab560\slleading20\partightenfactor0

\f0\fs26 \cf0 import \{ Router \} from "express";\
import type \{ Request, Response \} from "express";\
import * as line from "@line/bot-sdk";\
import \{ analyzeFoodImage, chatGenerate \} from "../lib/gemini.js";\
import \{\
  appendEntry,\
  deleteLastEntry,\
  getDailyCalories,\
  getRemainingCalories,\
  getBangkokTrackingDay,\
  getWeeklySummary,\
  getUserProfile,\
  saveUserProfile,\
\} from "../lib/sheets.js";\
import \{ logger \} from "../lib/logger.js";\
\
const LINE_CHANNEL_SECRET = process.env["LINE_CHANNEL_SECRET"] ?? "";\
const LINE_CHANNEL_ACCESS_TOKEN = process.env["LINE_CHANNEL_ACCESS_TOKEN"] ?? "";\
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] ?? "";\
const GEMINI_PRO_KEY = process.env["GEMINI_PRO_KEY"] ?? "";\
const OWNER_LINE_USER_ID = process.env["OWNER_LINE_USER_ID"] ?? "";\
\
/** Returns true if this user is the bot owner (
\f1 \'e0\'ce\'d5\'c2\'e0\'ba\'e7\'b9\'ab\'ec
\f0 ) */\
function isOwner(userId: string): boolean \{\
  return !!OWNER_LINE_USER_ID && userId === OWNER_LINE_USER_ID;\
\}\
\
/** Returns the appropriate Gemini API key for this user */\
function getGeminiKey(userId: string): string \{\
  return isOwner(userId) && GEMINI_PRO_KEY ? GEMINI_PRO_KEY : GEMINI_API_KEY;\
\}\
\
function getMessagingClient(): line.messagingApi.MessagingApiClient \{\
  return new line.messagingApi.MessagingApiClient(\{ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN \});\
\}\
\
function getBlobClient(): line.messagingApi.MessagingApiBlobClient \{\
  return new line.messagingApi.MessagingApiBlobClient(\{ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN \});\
\}\
\
// \uc0\u9472 \u9472 \u9472  Registration session state (in-memory) \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
type RegStep = "name" | "details" | "goals";\
\
interface RegSession \{\
  step: RegStep;\
  name?: string;\
  gender?: string;\
  age?: number;\
  height?: number;\
  weight?: number;\
  tdee?: number;\
\}\
\
const regSessions = new Map<string, RegSession>();\
\
// \uc0\u9472 \u9472 \u9472  Helpers \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
function honorific(name: string, gender: string, age: number): string \{\
  if (age > 30 && gender === "
\f1 \'aa\'d2\'c2
\f0 ") return `
\f1 \'e0\'ce\'d5\'c2
\f0 $\{name\}`;\
  if (age > 30 && gender === "
\f1 \'cb\'ad\'d4\'a7
\f0 ") return `
\f1 \'ab\'e9\'cd
\f0 $\{name\}`;\
  if (age <= 30 && gender === "
\f1 \'aa\'d2\'c2
\f0 ") return `
\f1 \'cd\'d2\'b5\'d5\'eb
\f0 $\{name\}`;\
  return `
\f1 \'cd\'d2\'cb\'c1\'c7\'c2
\f0 $\{name\}`;\
\}\
\
function calcTDEE(gender: string, age: number, weight: number, height: number): number \{\
  const bmr =\
    gender === "
\f1 \'aa\'d2\'c2
\f0 "\
      ? 10 * weight + 6.25 * height - 5 * age + 5\
      : 10 * weight + 6.25 * height - 5 * age - 161;\
  return Math.round(bmr * 1.55);\
\}\
\
function buildBar(calories: number, goal: number): string \{\
  if (calories === 0) return "
\f2 \uc0\u11036 \u11036 \u11036 \u11036 \u11036 \u11036 \u11036 \u11036 \u11036 \u11036 
\f0 ";\
  const filled = Math.min(10, Math.round((calories / goal) * 10));\
  const over = calories > goal;\
  const block = over ? "
\f2 \uc0\u55357 \u57317 
\f0 " : "
\f2 \uc0\u55357 \u57321 
\f0 ";\
  return block.repeat(filled) + "
\f2 \uc0\u11036 
\f0 ".repeat(10 - filled);\
\}\
\
function getChineseGreeting(): string \{\
  const now = new Date();\
  const bangkokHour = (now.getUTCHours() + 7) % 24;\
  if (bangkokHour >= 5 && bangkokHour < 12) \{\
    return "
\f2 \uc0\u9728 \u65039 
\f0  
\f1 \'a8\'e8\'d2\'c7\'cd\'d1\'b9
\f0  (
\f1 \'ca\'c7\'d1\'ca\'b4\'d5\'b5\'cd\'b9\'e0\'aa\'e9\'d2
\f0 ) 
\f1 \'a8\'e9\'d2
\f0 !";\
  \}\
  return "
\f2 \uc0\u55357 \u56395 
\f0  
\f1 \'cb\'b9\'d5\'cb\'e8\'d2\'c7\'a8\'e9\'d2
\f0 !";\
\}\
\
function buildChatSystemInstruction(title: string, remainingKcal: number, userGoal: string): string \{\
  return `
\f1 \'c5\'d7\'e9\'cd\'a4\'d7\'cd
\f0  "
\f1 \'cd\'d2\'e1\'bb\'d0\'e1\'a4\'c5
\f0 " 
\f1 \'aa\'d2\'c2\'e1\'a1\'e8\'aa\'d2\'c7\'a8\'d5\'b9\'cd\'d2\'c3\'c1\'b3\'ec\'b4\'d5
\f0  
\f1 \'e0\'bf\'c3\'b9\'c5\'d5\'e8
\f0  
\f1 \'a1\'c7\'b9\'e6
\f0  
\f1 \'a4\'cd\'c2\'e1\'b9\'d0\'b9\'d3\'e0\'c3\'d7\'e8\'cd\'a7\'cd\'d2\'cb\'d2\'c3\'e1\'c5\'d0\'e1\'a4\'c5\'cd\'c3\'d5
\f0  
\f1 \'ca\'c3\'c3\'be\'b9\'d2\'c1\'e1\'b7\'b9\'b5\'d1\'c7\'c7\'e8\'d2
\f0  "
\f1 \'cd\'d1\'ea\'c7
\f0 " 
\f1 \'e1\'c5\'d0\'e0\'c3\'d5\'c2\'a1\'bc\'d9\'e9\'e3\'aa\'e9\'c7\'e8\'d2
\f0  "$\{title\}" 
\f1 \'c5\'a7\'b7\'e9\'d2\'c2\'b4\'e9\'c7\'c2
\f0  "
\f1 \'b9\'d0\'c5\'d7\'e9\'cd
\f0 ", "
\f1 \'e0\'b9\'e9\'cd
\f0 ", "
\f1 \'a8\'e9\'d2
\f0 " 
\f1 \'e0\'ca\'c1\'cd
\f0  
\f1 \'a2\'e9\'cd\'a1\'d3\'cb\'b9\'b4\'ca\'d3\'a4\'d1\'ad
\f0 : 
\f1 \'b5\'cd\'ba\'e1\'ba\'ba\'ca\'d1\'e9\'b9
\f0  
\f1 \'a1\'c3\'d0\'aa\'d1\'ba
\f0  
\f1 \'e0\'b9\'d7\'e9\'cd\'e6
\f0  
\f1 \'e0\'b9\'e9\'b9\'e6
\f0  
\f1 \'e4\'c1\'e8\'be\'c3\'e8\'d3\'e0\'be\'e9\'cd\'c2\'d2\'c7\'e0\'b4\'e7\'b4\'a2\'d2\'b4
\f0  
\f1 \'b5\'cd\'b9\'b9\'d5\'e9\'bc\'d9\'e9\'e3\'aa\'e9\'e0\'cb\'c5\'d7\'cd\'be\'c5\'d1\'a7\'a7\'d2\'b9\'c7\'d1\'b9\'b9\'d5\'e9
\f0  $\{remainingKcal\} kcal 
\f1 \'e1\'c5\'d0\'e0\'a2\'d2\'c1\'d5\'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2
\f0 /
\f1 \'ca\'e4\'b5\'c5\'ec\'a1\'d2\'c3\'a1\'d4\'b9\'a4\'d7\'cd
\f0 : "$\{userGoal || "
\f1 \'e4\'c1\'e8\'c1\'d5\'c3\'d0\'ba\'d8
\f0 "\}" 
\f1 \'e3\'cb\'e9\'c5\'d7\'e9\'cd\'e1\'b9\'d0\'b9\'d3\'e0\'c1\'b9\'d9\'cd\'d2\'cb\'d2\'c3\'ca\'d1\'e9\'b9\'e6
\f0  
\f1 \'b7\'d5\'e8\'ca\'cd\'b4\'a4\'c5\'e9\'cd\'a7\'a1\'d1\'ba\'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2\'e1\'c5\'d0\'e1\'a4\'c5\'b7\'d5\'e8\'e0\'cb\'c5\'d7\'cd\'a2\'cd\'a7\'e0\'a2\'d2
\f0  
\f1 \'e3\'ca\'e8\'cd\'d5\'e2\'c1\'a8\'d4\'e3\'cb\'e9\'e0\'bf\'c3\'b9\'c5\'d5\'e8\'be\'cd\'b4\'d5\'a4\'d3
\f0 `;\
\}\
\
// \uc0\u9472 \u9472 \u9472  Router \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
const router = Router();\
\
router.post("/webhook", async (req: Request, res: Response) => \{\
  const secret = LINE_CHANNEL_SECRET;\
  if (!secret) \{\
    res.status(500).json(\{ error: "LINE_CHANNEL_SECRET not configured" \});\
    return;\
  \}\
\
  const middleware = line.middleware(\{ channelSecret: secret \});\
  await new Promise<void>((resolve, reject) => \{\
    middleware(req, res, (err?: unknown) => \{ if (err) reject(err); else resolve(); \});\
  \});\
\
  const body = req.body as line.webhook.CallbackRequest;\
  res.status(200).json(\{ status: "ok" \});\
  await Promise.allSettled(body.events.map((event) => handleEvent(event)));\
\});\
\
async function handleEvent(event: line.webhook.Event): Promise<void> \{\
  if (event.type !== "message") return;\
\
  const messageEvent = event as line.webhook.MessageEvent;\
  const userId = messageEvent.source?.userId;\
  if (!userId) return;\
\
  const \{ message, replyToken \} = messageEvent;\
  if (!message) return;\
\
  try \{\
    if (message.type === "image") \{\
      await handleImageMessage(userId, message.id, replyToken);\
    \} else if (message.type === "text") \{\
      const textMessage = message as line.webhook.TextMessageContent;\
      await handleTextMessage(userId, textMessage.text.trim(), replyToken);\
    \}\
  \} catch (err) \{\
    logger.error(\{ err, userId \}, "Error handling LINE event");\
    if (replyToken) \{\
      await safeReply(replyToken, "
\f1 \'cd\'d1\'ea\'c7\'a2\'cd\'e2\'b7\'c9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0  
\f1 \'c1\'d5\'ba\'d2\'a7\'cd\'c2\'e8\'d2\'a7\'e0\'cd\'eb\'cd\'cb\'c5\'d1\'a7\'ba\'e9\'d2\'b9
\f0  
\f1 \'c5\'cd\'a7\'ca\'e8\'a7\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'e0\'b9\'e9\'cd
\f0 ~");\
    \}\
  \}\
\}\
\
// \uc0\u9472 \u9472 \u9472  Registration Flow \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
async function startRegistration(userId: string, replyToken?: string): Promise<void> \{\
  regSessions.set(userId, \{ step: "name" \});\
  const greeting = getChineseGreeting();\
  const msg = [\
    `$\{greeting\}`,\
    `
\f1 \'cd\'d1\'ea\'c7
\f0  
\f1 \'cd\'d2\'e1\'bb\'d0\'e1\'a4\'c5
\f0  
\f1 \'b9\'d0\'c5\'d7\'e9\'cd
\f0 ! 
\f2 \uc0\u55357 \u56436 \u10024 
\f0 `,\
    `
\f1 \'a8\'d0\'c1\'d2\'aa\'e8\'c7\'c2\'c5\'d7\'e9\'cd\'b5\'d4\'b4\'b5\'d2\'c1\'e1\'a4\'c5\'cd\'c3\'d5\'e8\'b7\'d8\'a1\'c7\'d1\'b9\'e0\'b9\'e9\'cd
\f0 ! 
\f2 \uc0\u55358 \u56663 \u55356 \u57203 
\f0 `,\
    ``,\
    `
\f1 \'a1\'e8\'cd\'b9\'cd\'d7\'e8\'b9
\f0  
\f1 \'cd\'d1\'ea\'c7\'a2\'cd\'c3\'d9\'e9\'a8\'d1\'a1\'c5\'d7\'e9\'cd\'b9\'d4\'b4\'b9\'d6\'a7\'b9\'d0
\f0 `,\
    `
\f1 \'c5\'d7\'e9\'cd\'aa\'d7\'e8\'cd\'cd\'d0\'e4\'c3\'e0\'b9\'e9\'cd
\f0 ? 
\f1 \'be\'d4\'c1\'be\'ec\'ba\'cd\'a1\'cd\'d1\'ea\'c7\'c1\'d2\'e0\'c5\'c2\'a8\'e9\'d2
\f0 ! 
\f2 \uc0\u55357 \u56391 
\f0 `,\
  ].join("\\n");\
  if (replyToken) await safeReply(replyToken, msg);\
  else await pushMessage(userId, msg);\
\}\
\
async function handleRegistrationStep(\
  userId: string,\
  text: string,\
  session: RegSession,\
  replyToken?: string,\
): Promise<void> \{\
  const reply = async (msg: string) => \{\
    if (replyToken) await safeReply(replyToken, msg);\
    else await pushMessage(userId, msg);\
  \};\
\
  switch (session.step) \{\
    case "name": \{\
      const name = text.replace(/\\s+/g, "");\
      if (!name || name.length > 30) \{\
        await reply("
\f1 \'c5\'d7\'e9\'cd\'aa\'d7\'e8\'cd\'cd\'d0\'e4\'c3\'e0\'b9\'e9\'cd
\f0 ? 
\f1 \'be\'d4\'c1\'be\'ec\'e0\'a9\'be\'d2\'d0\'aa\'d7\'e8\'cd\'e0\'c5\'e8\'b9\'cb\'c3\'d7\'cd\'aa\'d7\'e8\'cd\'a8\'c3\'d4\'a7\'c1\'d2\'e0\'c5\'c2\'a8\'e9\'d2
\f0  
\f2 \uc0\u55357 \u56842 
\f0 ");\
        return;\
      \}\
      session.name = name;\
      session.step = "details";\
      regSessions.set(userId, session);\
\
      const msg = [\
        `
\f1 \'c2\'d4\'b9\'b4\'d5\'b7\'d5\'e8\'c3\'d9\'e9\'a8\'d1\'a1\'c5\'d7\'e9\'cd
\f0  $\{name\}! 
\f2 \uc0\u55357 \u56842 \u55356 \u57225 
\f0 `,\
        ``,\
        `
\f1 \'a2\'cd\'a2\'e9\'cd\'c1\'d9\'c5\'c3\'c7\'b4\'e0\'b4\'d5\'c2\'c7\'e0\'c5\'c2\'e0\'b9\'e9\'cd
\f0 ! 
\f1 \'be\'d4\'c1\'be\'ec\'b5\'cd\'ba\'a1\'c5\'d1\'ba\'c1\'d2\'b5\'d2\'c1\'c5\'d3\'b4\'d1\'ba\'b4\'d1\'a7\'b9\'d5\'e9\'a8\'e9\'d2
\f0 :`,\
        `
\f2 \uc0\u55357 \u56393 
\f0  [
\f1 \'e0\'be\'c8
\f0 ] [
\f1 \'cd\'d2\'c2\'d8
\f0 ] [
\f1 \'ca\'e8\'c7\'b9\'ca\'d9\'a7
\f0 ] [
\f1 \'b9\'e9\'d3\'cb\'b9\'d1\'a1
\f0 ]`,\
        `
\f2 \uc0\u55357 \u56481 
\f0  
\f1 \'b5\'d1\'c7\'cd\'c2\'e8\'d2\'a7
\f0 : 
\f1 \'aa\'d2\'c2
\f0  31 165 61`,\
      ].join("\\n");\
      await reply(msg);\
      break;\
    \}\
\
    case "details": \{\
      const parts = text.split(/\\s+/);\
      if (parts.length < 4) \{\
        await reply(`
\f1 \'be\'d4\'c1\'be\'ec\'a2\'e9\'cd\'c1\'d9\'c5\'e4\'c1\'e8\'a4\'c3\'ba\'b6\'e9\'c7\'b9\'b9\'d0\'e0\'b9\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0 \\n
\f1 \'aa\'e8\'c7\'c2\'be\'d4\'c1\'be\'ec\'e0\'c3\'d5\'c2\'a7\'a1\'d1\'b9\'e1\'ba\'ba\'b9\'d5\'e9\'e3\'cb\'e9\'e1\'bb\'d0\'b7\'d5\'a8\'e9\'d2
\f0 :\\n[
\f1 \'e0\'be\'c8
\f0 ] [
\f1 \'cd\'d2\'c2\'d8
\f0 ] [
\f1 \'ca\'e8\'c7\'b9\'ca\'d9\'a7
\f0 ] [
\f1 \'b9\'e9\'d3\'cb\'b9\'d1\'a1
\f0 ]\\n
\f1 \'e0\'aa\'e8\'b9
\f0 : 
\f1 \'aa\'d2\'c2
\f0  31 165 61`);\
        return;\
      \}\
\
      const gender = parts[0];\
      const age = parseInt(parts[1]);\
      const height = parseFloat(parts[2]);\
      const weight = parseFloat(parts[3]);\
\
      if (gender !== "
\f1 \'aa\'d2\'c2
\f0 " && gender !== "
\f1 \'cb\'ad\'d4\'a7
\f0 ") \{\
        await reply(`
\f1 \'b5\'d1\'c7\'e1\'c3\'a1\'b5\'e9\'cd\'a7\'e3\'ca\'e8
\f0  "
\f1 \'aa\'d2\'c2
\f0 " 
\f1 \'cb\'c3\'d7\'cd
\f0  "
\f1 \'cb\'ad\'d4\'a7
\f0 " 
\f1 \'b9\'d0\'c5\'d7\'e9\'cd
\f0  (
\f1 \'e0\'aa\'e8\'b9
\f0  
\f1 \'aa\'d2\'c2
\f0  31 165 61) 
\f2 \uc0\u55357 \u56842 
\f0 `);\
        return;\
      \}\
\
      if (isNaN(age) || age < 10 || age > 120 || \
          isNaN(height) || height < 100 || height > 250 || \
          isNaN(weight) || weight < 20 || weight > 300) \{\
        await reply(`
\f1 \'b5\'d1\'c7\'e0\'c5\'a2\'b4\'d9\'e1\'bb\'c5\'a1\'e6
\f0  
\f1 \'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0  
\f1 \'c5\'cd\'a7\'e0\'aa\'e7\'a1\'e1\'c5\'d0\'be\'d4\'c1\'be\'ec\'e3\'cb\'c1\'e8\'b5\'d2\'c1\'bf\'cd\'c3\'ec\'e1\'c1\'b5\'b9\'d5\'e9\'e0\'b9\'e9\'cd
\f0 :\\n
\f1 \'aa\'d2\'c2
\f0  [
\f1 \'cd\'d2\'c2\'d8
\f0 ] [
\f1 \'ca\'e8\'c7\'b9\'ca\'d9\'a7
\f0 ] [
\f1 \'b9\'e9\'d3\'cb\'b9\'d1\'a1
\f0 ]`);\
        return;\
      \}\
\
      session.gender = gender;\
      session.age = age;\
      session.height = height;\
      session.weight = weight;\
      session.tdee = calcTDEE(gender, age, weight, height);\
      session.step = "goals";\
      regSessions.set(userId, session);\
\
      const msg = [\
        `
\f1 \'c3\'d1\'ba\'b7\'c3\'d2\'ba\'a8\'e9\'d2
\f0 ! 
\f1 \'b4\'e8\'d2\'b9\'ca\'d8\'b4\'b7\'e9\'d2\'c2\'e1\'c5\'e9\'c7\'b9\'d0\'c5\'d7\'e9\'cd
\f0 ~ 
\f2 \uc0\u55356 \u57263 
\f0 `,\
        ``,\
        `
\f1 \'c5\'d7\'e9\'cd\'c1\'d5\'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2
\f0  
\f1 \'cb\'c3\'d7\'cd
\f0  
\f1 \'ca\'e4\'b5\'c5\'ec\'a1\'d2\'c3\'a1\'d4\'b9\'e1\'ba\'ba\'e4\'cb\'b9
\f0  
\f1 \'cd\'c2\'d2\'a1\'ba\'cd\'a1\'e1\'bb\'d0\'c1\'d1\'e9\'c2\'a8\'e9\'d2
\f0 ?`,\
        `
\f1 \'e0\'aa\'e8\'b9
\f0  
\f1 \'b7\'d3
\f0  IF, 
\f1 \'e0\'b9\'e9\'b9\'e2\'bb\'c3\'b5\'d5\'b9
\f0 , 
\f1 \'cd\'cd\'a1\'a1\'d3\'c5\'d1\'a7\'a1\'d2\'c2\'ba\'e8\'cd\'c2
\f0 , 
\f1 \'c5\'b4\'e4\'a2\'c1\'d1\'b9\'e3\'b9\'e0\'c5\'d7\'cd\'b4
\f0  
\f1 \'cb\'c3\'d7\'cd\'a1\'d4\'b9\'a4\'c5\'d5\'b9
\f0 `,\
        ``,\
        `
\f2 \uc0\u55357 \u56393 
\f0  
\f1 \'be\'d4\'c1\'be\'ec\'ba\'cd\'a1\'bb\'c3\'d0\'e2\'c2\'a4\'ca\'d1\'e9\'b9\'e6
\f0  
\f1 \'c1\'d2\'e0\'c5\'c2\'e0\'b9\'e9\'cd
\f0 ! (
\f1 \'b6\'e9\'d2\'e4\'c1\'e8\'c1\'d5\'be\'d4\'c1\'be\'ec
\f0  "
\f1 \'e4\'c1\'e8\'c1\'d5
\f0 " 
\f1 \'a8\'e9\'d2
\f0 )`,\
      ].join("\\n");\
      await reply(msg);\
      break;\
    \}\
\
    case "goals": \{\
      const goals = text.trim();\
      const \{ name, gender, age, weight, height, tdee \} = session;\
      const title = honorific(name!, gender!, age!);\
      const timestamp = new Date().toISOString();\
\
      await saveUserProfile(\{ \
        userId, \
        name: name!, \
        gender: gender!, \
        age: age!, \
        weight: weight!, \
        height: height!, \
        tdee: tdee!, \
        registeredAt: timestamp,\
        goals: goals === "
\f1 \'e4\'c1\'e8\'c1\'d5
\f0 " ? "" : goals\
      \});\
\
      regSessions.delete(userId);\
\
      const msg = [\
        `
\f2 \uc0\u55356 \u57225 
\f0  
\f1 \'ba\'d1\'b9\'b7\'d6\'a1\'a2\'e9\'cd\'c1\'d9\'c5\'e1\'c5\'d0\'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2\'e0\'c3\'d5\'c2\'ba\'c3\'e9\'cd\'c2\'e1\'c5\'e9\'c7\'a8\'e9\'d2
\f0  $\{title\}! 
\f2 \uc0\u55356 \u57286 
\f0 `,\
        ``,\
        `
\f2 \uc0\u55357 \u56523 
\f0  
\f1 \'e3\'ba\'e2\'bb\'c3\'e4\'bf\'c5\'ec\'a2\'cd\'a7\'c5\'d7\'e9\'cd
\f0 :`,\
        `
\f2 \uc0\u55357 \u56420 
\f0  
\f1 \'aa\'d7\'e8\'cd
\f0 : $\{name\}  |  
\f1 \'e0\'be\'c8
\f0 : $\{gender\}`,\
        `
\f2 \uc0\u55356 \u57218 
\f0  
\f1 \'cd\'d2\'c2\'d8
\f0 : $\{age\} 
\f1 \'bb\'d5
\f0  | 
\f2 \uc0\u9878 \u65039 
\f0  
\f1 \'b9\'e9\'d3\'cb\'b9\'d1\'a1
\f0 : $\{weight\} 
\f1 \'a1\'a1
\f0 .`,\
        `
\f2 \uc0\u55357 \u56613 
\f0  
\f1 \'e2\'a4\'c7\'b5\'d2
\f0  TDEE: ~$\{tdee\} kcal/
\f1 \'c7\'d1\'b9
\f0  
\f1 \'b9\'d0\'c5\'d7\'e9\'cd
\f0 !`,\
        `
\f2 \uc0\u55356 \u57263 
\f0  
\f1 \'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2
\f0 /
\f1 \'ca\'e4\'b5\'c5\'ec
\f0 : $\{goals === "
\f1 \'e4\'c1\'e8\'c1\'d5
\f0 " ? "
\f1 \'b7\'d1\'e8\'c7\'e4\'bb
\f0 " : goals\}`,\
        ``,\
        `
\f1 \'ca\'e8\'a7\'c3\'d9\'bb\'cd\'d2\'cb\'d2\'c3\'c1\'d2\'e3\'cb\'e9\'cd\'d1\'ea\'c7\'e1\'bb\'d0\'e1\'a4\'c5\'a4\'cd\'c2\'ca\'e8\'cd\'a7\'b4\'d9\'e1\'c5\'e4\'b4\'e9\'e0\'c5\'c2\'e0\'b9\'e9\'cd
\f0 ! 
\f2 \uc0\u55357 \u56568 \u55356 \u57203 
\f0 `,\
      ].join("\\n");\
      await reply(msg);\
      break;\
    \}\
  \}\
\}\
\
// \uc0\u9472 \u9472 \u9472  Image Handler \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
async function handleImageMessage(userId: string, messageId: string, replyToken?: string): Promise<void> \{\
  if (regSessions.has(userId)) \{\
    if (replyToken) await safeReply(replyToken, "
\f1 \'c5\'d7\'e9\'cd\'b5\'cd\'ba\'a4\'d3\'b6\'d2\'c1\'a2\'cd\'a7\'cd\'d1\'ea\'c7\'e3\'cb\'e9\'a8\'ba\'a1\'e8\'cd\'b9\'e0\'b9\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56842 
\f0  
\f1 \'e1\'bb\'d0\'c3\'cd\'c5\'d9\'e9\'cd\'c2\'d9\'e8\'a8\'e9\'d2
\f0 ~");\
    return;\
  \}\
\
  const profile = await getUserProfile(userId);\
  if (!profile) \{\
    await startRegistration(userId, replyToken);\
    return;\
  \}\
\
  // Reply token is spent here \'97 all further messages MUST use pushMessage\
  if (replyToken) \{\
    await safeReply(replyToken, `
\f1 \'e1\'bb\'ea\'ba\'b9\'d6\'a7\'b9\'d0\'c5\'d7\'e9\'cd
\f0 ~ 
\f1 \'cd\'d1\'ea\'c7\'a2\'cd\'a1\'d2\'a7\'e1\'c7\'e8\'b9\'ca\'e8\'cd\'a7\'c3\'d9\'bb\'cd\'d2\'cb\'d2\'c3\'e3\'cb\'e9\'e0\'b4\'d5\'eb\'c2\'c7\'b9\'d5\'e9\'e0\'c5\'c2\'e0\'b9\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56589 \u10024 
\f0 `);\
  \}\
\
  // Download image from LINE\
  let imageBase64: string;\
  try \{\
    const imageStream = await getBlobClient().getMessageContent(messageId);\
    const chunks: Uint8Array[] = [];\
    for await (const chunk of imageStream as AsyncIterable<Uint8Array>) chunks.push(chunk);\
    imageBase64 = Buffer.concat(chunks).toString("base64");\
  \} catch (err) \{\
    logger.error(\{ err, userId \}, "Failed to download image from LINE");\
    await pushMessage(userId, `
\f1 \'cd\'d1\'ea\'c7\'e2\'cb\'c5\'b4\'c3\'d9\'bb\'e4\'c1\'e8\'e4\'b4\'e9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0  
\f1 \'c5\'cd\'a7\'ca\'e8\'a7\'c3\'d9\'bb\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~`);\
    return;\
  \}\
\
  // Analyse with Gemini \'97 never throws, returns fallback on any error\
  const analysis = await analyzeFoodImage(imageBase64, "image/jpeg", getGeminiKey(userId));\
\
  // Handle Gemini API errors with friendly messages per error type\
  if (analysis.error) \{\
    const errMsgs: Record<string, string> = \{\
      rate_limit:   `
\f1 \'cd\'d1\'ea\'c7\'a2\'cd\'e2\'b7\'c9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56851 
\f0  Gemini API 
\f1 \'b5\'d4\'b4
\f0  quota 
\f1 \'e1\'c5\'e9\'c7\'b5\'cd\'b9\'b9\'d5\'e9
\f0 \\n
\f1 \'c3\'cd\'e1\'bb\'ea\'ba\'e1\'c5\'e9\'c7\'c5\'cd\'a7\'ca\'e8\'a7\'c3\'d9\'bb\'e3\'cb\'c1\'e8\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~ 
\f2 \uc0\u9203 
\f0 `,\
      auth_error:   `
\f1 \'cd\'d1\'ea\'c7\'e0\'a2\'e9\'d2
\f0  Gemini 
\f1 \'e4\'c1\'e8\'e4\'b4\'e9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56863 
\f0  API Key 
\f1 \'c1\'d5\'bb\'d1\'ad\'cb\'d2
\f0  
\f1 \'e0\'a8\'e9\'d2\'a2\'cd\'a7\'ba\'cd\'b7\'b5\'e9\'cd\'a7\'e0\'aa\'e7\'a1\'b4\'e8\'c7\'b9\'e0\'b9\'e9\'cd
\f0 !`,\
      safety_block: `
\f1 \'c3\'d9\'bb\'b9\'d5\'e9\'e2\'b4\'b9
\f0  safety filter 
\f1 \'ba\'c5\'e7\'cd\'a1\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f1 \'c5\'cd\'a7\'ca\'e8\'a7\'c3\'d9\'bb\'cd\'d2\'cb\'d2\'c3\'cd\'d7\'e8\'b9\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~ 
\f2 \uc0\u55357 \u56842 
\f0 `,\
      no_api_key:   `
\f1 \'cd\'d1\'ea\'c7\'c2\'d1\'a7\'e4\'c1\'e8\'e4\'b4\'e9\'b5\'d1\'e9\'a7
\f0  GEMINI_API_KEY 
\f1 \'e0\'c5\'c2\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56863 
\f0  
\f1 \'e0\'a8\'e9\'d2\'a2\'cd\'a7\'ba\'cd\'b7\'b5\'e9\'cd\'a7\'b5\'d1\'e9\'a7\'a1\'e8\'cd\'b9\'e0\'b9\'e9\'cd
\f0 !`,\
    \};\
    await pushMessage(\
      userId,\
      errMsgs[analysis.error] ?? `
\f1 \'cd\'d1\'ea\'c7\'c7\'d4\'e0\'a4\'c3\'d2\'d0\'cb\'ec\'c3\'d9\'bb\'e4\'c1\'e8\'e4\'b4\'e9\'b5\'cd\'b9\'b9\'d5\'e9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0  
\f1 \'c5\'cd\'a7\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~`,\
    );\
    return;\
  \}\
\
  if (!analysis.isFood) \{\
    await pushMessage(userId, `
\f1 \'e4\'cd\'c2\'eb\'d2
\f0  
\f1 \'cd\'d1\'ea\'c7\'b4\'d9\'e1\'c5\'e9\'c7\'ca\'d4\'e8\'a7\'b9\'d5\'e9\'e4\'c1\'e8\'e3\'aa\'e8\'cd\'d2\'cb\'d2\'c3\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55358 \u56596 
\f0 \\n
\f1 \'c5\'cd\'a7\'ca\'e8\'a7\'c3\'d9\'bb\'a2\'cd\'a7\'a1\'d4\'b9\'c1\'d2\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'ab\'d4\'ea
\f0 ! 
\f2 \uc0\u55356 \u57213 \u65039 
\f0 `);\
    return;\
  \}\
\
  const trackingDay = getBangkokTrackingDay();\
  const timestamp = new Date().toISOString();\
\
  // Log to Sheets \'97 catch separately so Gemini result isn't lost\
  try \{\
    await appendEntry(\{ timestamp, userId, foodDescription: analysis.foodDescription, calories: analysis.estimatedCalories, trackingDay \});\
  \} catch (err) \{\
    logger.error(\{ err, userId \}, "Failed to append entry to Sheets");\
    await pushMessage(userId, `
\f1 \'cd\'d1\'ea\'c7\'c7\'d4\'e0\'a4\'c3\'d2\'d0\'cb\'ec\'e0\'ca\'c3\'e7\'a8\'e1\'c5\'e9\'c7\'e1\'b5\'e8\'ba\'d1\'b9\'b7\'d6\'a1\'c5\'a7
\f0  Sheet 
\f1 \'e4\'c1\'e8\'e4\'b4\'e9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56851 
\f0 \\n
\f1 \'c5\'cd\'a7\'ca\'e8\'a7\'c3\'d9\'bb\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~`);\
    return;\
  \}\
\
  const consumed = await getDailyCalories(userId, trackingDay);\
  const goal = profile.tdee;\
  const remaining = getRemainingCalories(consumed, goal);\
  const title = honorific(profile.name, profile.gender, profile.age);\
\
  let statusLine: string;\
  let encouragement: string;\
  if (remaining > 500) \{\
    statusLine = `
\f1 \'e0\'cb\'c5\'d7\'cd\'cd\'d5\'a1
\f0  $\{remaining\} kcal 
\f2 \uc0\u9989 
\f0 `;\
    encouragement = `
\f1 \'a1\'c3\'d0\'e0\'be\'d2\'d0\'c2\'d1\'a7\'e0\'cb\'c5\'d7\'cd\'e2\'a4\'c7\'b5\'d2\'e0\'c2\'cd\'d0\'b9\'d0\'c5\'d7\'e9\'cd
\f0  $\{title\}! 
\f1 \'e4\'bb\'b5\'e8\'cd\'e4\'b4\'e9\'e0\'c5\'c2\'a8\'e9\'d2\'a8\'e9\'d2
\f0  
\f2 \uc0\u55357 \u56490 
\f0 `;\
  \} else if (remaining > 0) \{\
    statusLine = `
\f1 \'e0\'cb\'c5\'d7\'cd\'cd\'d5\'a1
\f0  $\{remaining\} kcal 
\f2 \uc0\u9888 \u65039 
\f0 `;\
    encouragement = `
\f1 \'e3\'a1\'c5\'e9\'a8\'d0\'bb\'c3\'d4\'e8\'c1\'e2\'a4\'c7\'b5\'d2\'e1\'c5\'e9\'c7\'b9\'d0\'c5\'d7\'e9\'cd
\f0  $\{title\} 
\f1 \'c1\'d7\'e9\'cd\'b5\'e8\'cd\'e4\'bb\'e0\'be\'c5\'d2\'e6
\f0  
\f1 \'cb\'b9\'e8\'cd\'c2\'e0\'b9\'e9\'cd
\f0 ~ 
\f2 \uc0\u55357 \u56842 
\f0 `;\
  \} else \{\
    statusLine = `
\f1 \'e0\'a1\'d4\'b9\'e0\'bb\'e9\'d2\'c1\'d2\'e1\'c5\'e9\'c7
\f0  $\{Math.abs(remaining)\} kcal 
\f2 \uc0\u55357 \u57000 
\f0 `;\
    encouragement = `
\f1 \'e4\'cd\'c2\'eb\'d2
\f0  
\f1 \'c7\'d1\'b9\'b9\'d5\'e9\'a1\'d4\'b9\'e0\'a1\'d4\'b9\'e2\'a4\'c7\'b5\'d2\'e1\'c5\'e9\'c7\'b9\'d0\'c5\'d7\'e9\'cd
\f0  $\{title\} 
\f1 \'c1\'d7\'e9\'cd\'b4\'d6\'a1\'b5\'e9\'cd\'a7\'be\'d1\'ba\'e0\'ca\'d7\'e8\'cd
\f0  
\f1 \'be\'c3\'d8\'e8\'a7\'b9\'d5\'e9\'a4\'e8\'cd\'c2\'e0\'cd\'d2\'e3\'cb\'c1\'e8\'e0\'b9\'e9\'cd
\f0 ! 
\f2 \uc0\u55356 \u57119 
\f0 `;\
  \}\
\
  const reply = [\
    `
\f2 \uc0\u55356 \u57213 \u65039 
\f0  
\f1 \'e0\'c1\'b9\'d9\'b9\'d5\'e9
\f0 : $\{analysis.foodDescription\}`,\
    ``,\
    `
\f2 \uc0\u55357 \u56522 
\f0  
\f1 \'e1\'bb\'d0\'ca\'e1\'a1\'b9\'ca\'d2\'c3\'cd\'d2\'cb\'d2\'c3\'e3\'cb\'e9
\f0  (
\f1 \'e2\'b4\'c2\'bb\'c3\'d0\'c1\'d2\'b3
\f0 ):`,\
    `
\f2 \uc0\u9889 
\f0  
\f1 \'e1\'a4\'c5\'cd\'c3\'d5
\f0   ~$\{analysis.estimatedCalories\} kcal`,\
    `
\f2 \uc0\u55358 \u56681 
\f0  
\f1 \'e2\'bb\'c3\'b5\'d5\'b9
\f0   ~$\{analysis.protein\} g | 
\f2 \uc0\u55356 \u57182 
\f0  
\f1 \'a4\'d2\'c3\'ec\'ba
\f0  ~$\{analysis.carbs\} g`,\
    ``,\
    `
\f2 \uc0\u55357 \u56492 
\f0  
\f1 \'cd\'d2\'e1\'bb\'d0\'a4\'cd\'c1\'e0\'c1\'b9\'b5\'ec
\f0 : $\{analysis.motivatingComment\}`,\
    ``,\
    `\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 `,\
    `
\f2 \uc0\u55357 \u56517 
\f0  
\f1 \'ca\'c3\'d8\'bb\'ca\'c1\'d8\'b4\'ba\'d1\'ad\'aa\'d5\'c7\'d1\'b9\'b9\'d5\'e9
\f0  ($\{title\})`,\
    `\'95 
\f1 \'c1\'d7\'e9\'cd\'b9\'d5\'e9\'a1\'d4\'b9\'e4\'bb
\f0 :   $\{analysis.estimatedCalories\} kcal`,\
    `\'95 
\f1 \'c3\'c7\'c1\'c7\'d1\'b9\'b9\'d5\'e9
\f0 :    $\{consumed\} / $\{goal\} kcal`,\
    `\'95 Status:     $\{statusLine\}`,\
    ``,\
    buildBar(consumed, goal),\
    ``,\
    encouragement,\
  ].join("\\n");\
\
  await pushMessage(userId, reply);\
\}\
\
// \uc0\u9472 \u9472 \u9472  Text Handler \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
async function handleTextMessage(userId: string, text: string, replyToken?: string): Promise<void> \{\
  const session = regSessions.get(userId);\
  if (session) \{\
    await handleRegistrationStep(userId, text, session, replyToken);\
    return;\
  \}\
\
  const cmd = text.toLowerCase();\
\
  if (["
\f1 \'c5\'ba
\f0 ", "undo", "
\f1 \'c5\'ba\'c5\'e8\'d2\'ca\'d8\'b4
\f0 ", "
\f1 \'c2\'a1\'e0\'c5\'d4\'a1
\f0 "].includes(cmd)) \{\
    const trackingDay = getBangkokTrackingDay();\
    try \{\
      const deleted = await deleteLastEntry(userId, trackingDay);\
      if (!deleted) \{\
        if (replyToken) await safeReply(replyToken, `
\f1 \'cd\'d1\'ea\'c7\'cb\'d2\'a2\'e9\'cd\'c1\'d9\'c5\'c1\'d7\'e9\'cd\'c5\'e8\'d2\'ca\'d8\'b4\'a2\'cd\'a7\'c5\'d7\'e9\'cd\'c7\'d1\'b9\'b9\'d5\'e9\'e4\'c1\'e8\'e0\'a8\'cd\'e0\'c5\'c2\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55358 \u56596 
\f0 \\n
\f1 \'c7\'d1\'b9\'b9\'d5\'e9\'c2\'d1\'a7\'e4\'c1\'e8\'c1\'d5\'c3\'d2\'c2\'a1\'d2\'c3\'b7\'d5\'e8\'a8\'d0\'c5\'ba\'e0\'b9\'e9\'cd
\f0 ~`);\
      \} else \{\
        const consumed = await getDailyCalories(userId, trackingDay);\
        const profile = await getUserProfile(userId);\
        const goal = profile?.tdee ?? 2000;\
        const remaining = getRemainingCalories(consumed, goal);\
        const title = profile ? honorific(profile.name, profile.gender, profile.age) : "
\f1 \'c5\'d7\'e9\'cd
\f0 ";\
        const msg = [\
          `
\f2 \uc0\u55357 \u56785 \u65039 
\f0  
\f1 \'c5\'ba\'c3\'d2\'c2\'a1\'d2\'c3\'c5\'e8\'d2\'ca\'d8\'b4\'e0\'c3\'d5\'c2\'ba\'c3\'e9\'cd\'c2\'e1\'c5\'e9\'c7\'a8\'e9\'d2
\f0 !`,\
          ``,\
          `
\f2 \uc0\u10060 
\f0  
\f1 \'b7\'d5\'e8\'c5\'ba
\f0 : $\{deleted.foodDescription\} (~$\{deleted.calories\} kcal)`,\
          ``,\
          `\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 `,\
          `
\f2 \uc0\u55357 \u56517 
\f0  
\f1 \'c2\'cd\'b4\'c3\'c7\'c1\'c7\'d1\'b9\'b9\'d5\'e9
\f0  ($\{title\})`,\
          `\'95 
\f1 \'a1\'d4\'b9\'e4\'bb\'e1\'c5\'e9\'c7
\f0 : $\{consumed\} / $\{goal\} kcal`,\
          `\'95 $\{remaining >= 0 ? `
\f1 \'e0\'cb\'c5\'d7\'cd\'cd\'d5\'a1
\f0  $\{remaining\} kcal 
\f2 \uc0\u9989 
\f0 ` : `
\f1 \'e0\'a1\'d4\'b9\'c1\'d2
\f0  $\{Math.abs(remaining)\} kcal 
\f2 \uc0\u55357 \u57000 
\f0 `\}`,\
          ``,\
          buildBar(consumed, goal),\
        ].join("\\n");\
        if (replyToken) await safeReply(replyToken, msg);\
      \}\
    \} catch (err) \{\
      logger.error(\{ err, userId \}, "Failed to delete last entry");\
      if (replyToken) await safeReply(replyToken, `
\f1 \'cd\'d1\'ea\'c7\'c5\'ba\'c3\'d2\'c2\'a1\'d2\'c3\'e4\'c1\'e8\'e4\'b4\'e9\'b9\'d0\'c5\'d7\'e9\'cd
\f0  
\f2 \uc0\u55357 \u56837 
\f0  
\f1 \'c5\'cd\'a7\'e3\'cb\'c1\'e8\'cd\'d5\'a1\'b7\'d5\'e4\'b4\'e9\'e0\'b9\'e9\'cd
\f0 ~`);\
    \}\
    return;\
  \}\
\
  if (["
\f1 \'c5\'a7\'b7\'d0\'e0\'ba\'d5\'c2\'b9
\f0 ", "register", "
\f1 \'ca\'c1\'d1\'a4\'c3
\f0 ", "
\f1 \'e1\'a1\'e9\'e4\'a2\'a2\'e9\'cd\'c1\'d9\'c5
\f0 ", "
\f1 \'c5\'a7\'b7\'d0\'e0\'ba\'d5\'c2\'b9\'e3\'cb\'c1\'e8
\f0 "].includes(cmd)) \{\
    await startRegistration(userId, replyToken);\
    return;\
  \}\
\
  const profile = await getUserProfile(userId);\
  if (!profile) \{\
    await startRegistration(userId, replyToken);\
    return;\
  \}\
\
  const title = honorific(profile.name, profile.gender, profile.age);\
  const goal = profile.tdee;\
  const trackingDay = getBangkokTrackingDay();\
  const consumed = await getDailyCalories(userId, trackingDay);\
  const remaining = getRemainingCalories(consumed, goal);\
\
  if (["status", "today", "calories", "
\f1 \'c7\'d1\'b9\'b9\'d5\'e9
\f0 ", "
\f1 \'ca\'c3\'d8\'bb
\f0 "].includes(cmd)) \{\
    const bar = buildBar(consumed, goal);\
    let statusMsg: string;\
    if (remaining > 500) statusMsg = `
\f1 \'e0\'cb\'c5\'d7\'cd\'e2\'a4\'c7\'b5\'d2
\f0  $\{remaining\} kcal 
\f2 \uc0\u9989 
\f0 `;\
    else if (remaining > 0) statusMsg = `
\f1 \'e0\'cb\'c5\'d7\'cd\'e2\'a4\'c7\'b5\'d2
\f0  $\{remaining\} kcal 
\f2 \uc0\u9888 \u65039 
\f0 `;\
    else statusMsg = `
\f1 \'a1\'d4\'b9\'e0\'a1\'d4\'b9\'c1\'d2
\f0  $\{Math.abs(remaining)\} kcal 
\f2 \uc0\u55357 \u57000 
\f0 `;\
\
    const reply = [\
      `
\f2 \uc0\u55357 \u56517 
\f0  
\f1 \'e3\'ba\'ba\'d1\'ad\'aa\'d5\'e1\'a4\'c5\'cd\'c3\'d5\'c7\'d1\'b9\'b9\'d5\'e9
\f0  ($\{title\})`,\
      `\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 `,\
      `
\f2 \uc0\u55357 \u56613 
\f0  
\f1 \'e2\'a4\'c7\'b5\'d2\'b7\'d1\'e9\'a7\'c7\'d1\'b9
\f0  (TDEE): $\{goal\} kcal`,\
      `
\f2 \uc0\u55356 \u57213 \u65039 
\f0  
\f1 \'ca\'cd\'c2\'e4\'bb\'e1\'c5\'e9\'c7\'c3\'c7\'c1
\f0 :      $\{consumed\} kcal`,\
      `
\f2 \uc0\u10024 
\f0  Status 
\f1 \'bb\'d1\'a8\'a8\'d8\'ba\'d1\'b9
\f0 :    $\{statusMsg\}`,\
      ``,\
      bar,\
    ].join("\\n");\
\
    if (replyToken) await safeReply(replyToken, reply);\
\
  \} else if (["weekly", "week", "
\f1 \'ca\'d1\'bb\'b4\'d2\'cb\'ec
\f0 ", "
\f1 \'cd\'d2\'b7\'d4\'b5\'c2\'ec
\f0 "].includes(cmd)) \{\
    const summary = await getWeeklySummary(userId);\
    const rows = summary.map((d) => \{\
      const bar = buildBar(d.calories, goal);\
      const overTag = d.calories > goal ? " 
\f2 \uc0\u55357 \u57000 
\f0 " : d.calories === 0 ? "" : " 
\f2 \uc0\u9989 
\f0 ";\
      return `$\{d.label\}\\n$\{d.calories > 0 ? `$\{d.calories\} kcal$\{overTag\}` : "
\f1 \'e4\'c1\'e8\'c1\'d5\'a2\'e9\'cd\'c1\'d9\'c5
\f0 "\}\\n$\{bar\}`;\
    \});\
\
    const reply = [\
      `
\f2 \uc0\u55357 \u56522 
\f0  
\f1 \'ca\'c3\'d8\'bb\'c2\'cd\'b4\'ba\'d1\'ad\'aa\'d5
\f0  7 
\f1 \'c7\'d1\'b9
\f0  ($\{title\})`,\
      `\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 `,\
      rows.join("\\n\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \\n"),\
    ].join("\\n");\
\
    if (replyToken) await safeReply(replyToken, reply);\
\
  \} else if (["
\f1 \'a2\'e9\'cd\'c1\'d9\'c5
\f0 ", "
\f1 \'e2\'bb\'c3\'e4\'bf\'c5\'ec
\f0 ", "profile", "info"].includes(cmd)) \{\
    const msg = [\
      `
\f2 \uc0\u55357 \u56420 
\f0  
\f1 \'e0\'cd\'a1\'ca\'d2\'c3\'e2\'bb\'c3\'e4\'bf\'c5\'ec\'a2\'cd\'a7
\f0 $\{title\}`,\
      `\uc0\u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 `,\
      `
\f1 \'aa\'d7\'e8\'cd
\f0 : $\{profile.name\}  |  
\f1 \'e0\'be\'c8
\f0 : $\{profile.gender\}`,\
      `
\f2 \uc0\u55357 \u56613 
\f0  
\f1 \'e2\'a4\'c7\'b5\'d2\'be\'c5\'d1\'a7\'a7\'d2\'b9
\f0  TDEE: ~$\{profile.tdee\} kcal/
\f1 \'c7\'d1\'b9\'e0\'b9\'e9\'cd
\f0 `,\
      `
\f2 \uc0\u55356 \u57263 
\f0  
\f1 \'e0\'bb\'e9\'d2\'cb\'c1\'d2\'c2
\f0 /
\f1 \'ca\'e4\'b5\'c5\'ec
\f0 : $\{profile.goals || "
\f1 \'b7\'d1\'e8\'c7\'e4\'bb\'e0\'b9\'e9\'cd
\f0 "\}`,\
    ].join("\\n");\
    if (replyToken) await safeReply(replyToken, msg);\
\
  \} else if (cmd === "help" || cmd === "
\f1 \'aa\'e8\'c7\'c2\'e0\'cb\'c5\'d7\'cd
\f0 ") \{\
    const helpText = [\
      `
\f2 \uc0\u55357 \u56436 
\f0  
\f1 \'e0\'c1\'b9\'d9\'aa\'e8\'c7\'c2\'e0\'cb\'c5\'d7\'cd\'a2\'cd\'a7\'cd\'d2\'e1\'bb\'d0\'e1\'a4\'c5
\f0  
\f2 \uc0\u55358 \u56663 
\f0 `,\
      ``,\
      `
\f2 \uc0\u55357 \u56523 
\f0  
\f1 \'a4\'d3\'ca\'d1\'e8\'a7\'be\'d4\'c1\'be\'ec\'ca\'d1\'e8\'a7\'a7\'d2\'b9
\f0 :`,\
      `  
\f1 \'c7\'d1\'b9\'b9\'d5\'e9
\f0  / 
\f1 \'ca\'c3\'d8\'bb
\f0  
\f3 \uc0\u8594 
\f0  
\f1 \'b4\'d9\'ca\'c1\'d8\'b4\'ba\'d1\'ad\'aa\'d5\'e1\'a4\'c5\'c7\'d1\'b9\'b9\'d5\'e9
\f0 `,\
      `  
\f1 \'ca\'d1\'bb\'b4\'d2\'cb\'ec
\f0  / 
\f1 \'cd\'d2\'b7\'d4\'b5\'c2\'ec
\f0  
\f3 \uc0\u8594 
\f0  
\f1 \'ca\'c3\'d8\'bb\'c2\'cd\'b4
\f0  7 
\f1 \'c7\'d1\'b9
\f0 `,\
      `  
\f1 \'a2\'e9\'cd\'c1\'d9\'c5
\f0  / 
\f1 \'e2\'bb\'c3\'e4\'bf\'c5\'ec
\f0  
\f3 \uc0\u8594 
\f0  
\f1 \'b4\'d9\'e3\'ba\'ca\'e0\'bb\'e7\'a1\'b5\'d1\'c7\'c5\'d7\'e9\'cd
\f0 `,\
      `  
\f1 \'c5\'ba
\f0  / undo 
\f3 \uc0\u8594 
\f0  
\f1 \'c5\'ba\'c1\'d7\'e9\'cd\'c5\'e8\'d2\'ca\'d8\'b4\'a2\'cd\'a7\'c7\'d1\'b9\'b9\'d5\'e9
\f0 `,\
      `  
\f1 \'c5\'a7\'b7\'d0\'e0\'ba\'d5\'c2\'b9\'e3\'cb\'c1\'e8
\f0  
\f3 \uc0\u8594 
\f0  
\f1 \'c3\'d7\'e9\'cd\'a1\'c3\'cd\'a1\'e2\'bb\'c3\'e4\'bf\'c5\'ec\'e3\'cb\'c1\'e8
\f0 `,\
    ].join("\\n");\
    if (replyToken) await safeReply(replyToken, helpText);\
\
  \} else \{\
    if (replyToken) \{\
      const sysInstr = buildChatSystemInstruction(title, remaining, profile.goals || "");\
      const aiResponse = await chatGenerate(text, sysInstr, getGeminiKey(userId));\
      await safeReply(replyToken, aiResponse || `
\f1 \'e0\'cb\'c5\'d7\'cd\'e2\'a4\'c7\'b5\'d2\'cd\'d5\'a1
\f0  $\{remaining\} kcal 
\f1 \'cb\'d2\'cd\'d0\'e4\'c3\'e0\'ba\'d2\'e6
\f0  
\f1 \'b7\'d2\'b9\'b4\'d9\'b9\'d0\'c5\'d7\'e9\'cd
\f0 !`);\
    \}\
  \}\
\}\
\
// \uc0\u9472 \u9472 \u9472  Messaging helpers \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
async function safeReply(replyToken: string, text: string): Promise<void> \{\
  try \{\
    await getMessagingClient().replyMessage(\{ replyToken, messages: [\{ type: "text", text \}] \});\
  \} catch (err) \{\
    logger.error(\{ err \}, "Failed to send LINE reply");\
  \}\
\}\
\
async function pushMessage(userId: string, text: string): Promise<void> \{\
  try \{\
    await getMessagingClient().pushMessage(\{ to: userId, messages: [\{ type: "text", text \}] \});\
  \} catch (err) \{\
    logger.error(\{ err \}, "Failed to push LINE message");\
  \}\
\}\
\
export default router;}