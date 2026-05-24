{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 HelveticaNeue;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab560
\pard\pardeftab560\slleading20\partightenfactor0

\f0\fs26 \cf0 import \{ GoogleGenAI \} from "@google/genai";\
import \{ logger \} from "./logger.js";\
\
// \uc0\u9472 \u9472 \u9472  Key Pool \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
// Reads GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, \'85 at startup.\
// Adding more keys later requires only a new secret \'97 no code changes needed.\
\
function buildKeyPool(): string[] \{\
  const pool: string[] = [];\
  const primary = process.env["GEMINI_API_KEY"];\
  if (primary) pool.push(primary);\
  let n = 2;\
  while (true) \{\
    const extra = process.env[`GEMINI_API_KEY_$\{n\}`];\
    if (!extra) break;\
    pool.push(extra);\
    n++;\
  \}\
  return pool;\
\}\
\
const KEY_POOL = buildKeyPool();\
\
// Round-robin cursor \'97 advances on every call so load is spread evenly.\
let rrIndex = 0;\
\
/** Pick the next pool key in round-robin order. */\
function nextPoolKey(): string | null \{\
  if (KEY_POOL.length === 0) return null;\
  const key = KEY_POOL[rrIndex % KEY_POOL.length] ?? null;\
  rrIndex = (rrIndex + 1) % KEY_POOL.length;\
  return key;\
\}\
\
/** Rotate past the current key when it has a quota / auth problem. */\
function advancePastKey(): void \{\
  // rrIndex already moved forward in nextPoolKey(); nothing extra needed.\
  // Called for logging purposes only.\
  logger.warn(\{ rrIndex, total: KEY_POOL.length \}, "Gemini key quota/auth hit \'97 rotated");\
\}\
\
// \uc0\u9472 \u9472 \u9472  Helpers \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
export interface FoodAnalysis \{\
  foodDescription: string;\
  estimatedCalories: number;\
  protein: number;\
  carbs: number;\
  fat: number;\
  motivatingComment: string;\
  isFood: boolean;\
  error?: string;\
\}\
\
function fallbackError(reason: string): FoodAnalysis \{\
  return \{\
    isFood: true,\
    foodDescription: "\uc0\u3629 \u3634 \u3627 \u3634 \u3619  (\u3652 \u3617 \u3656 \u3626 \u3634 \u3617 \u3634 \u3619 \u3606 \u3623 \u3636 \u3648 \u3588 \u3619 \u3634 \u3632 \u3627 \u3660 \u3652 \u3604 \u3657 )",\
    estimatedCalories: 0,\
    protein: 0,\
    carbs: 0,\
    fat: 0,\
    motivatingComment: "",\
    error: reason,\
  \};\
\}\
\
function isQuotaOrAuth(err: unknown): boolean \{\
  if (!err || typeof err !== "object") return false;\
  const status = (err as Record<string, unknown>)["status"];\
  const msg = String((err as Record<string, unknown>)["message"] ?? "");\
  return (\
    status === 429 || status === 401 || status === 403 ||\
    msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ||\
    msg.includes("API_KEY") || msg.includes("PERMISSION_DENIED")\
  );\
\}\
\
function isSafetyBlock(err: unknown): boolean \{\
  if (!err || typeof err !== "object") return false;\
  const msg = String((err as Record<string, unknown>)["message"] ?? "");\
  return msg.includes("SAFETY");\
\}\
\
// \uc0\u9472 \u9472 \u9472  Core request helper with retry \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
/**\
 * Calls `fn(apiKey)` using round-robin pool keys.\
 * On quota/auth error, immediately retries with the next key.\
 * Tries every key at most once before giving up.\
 * `overrideKey` bypasses the pool entirely (used for GEMINI_PRO_KEY).\
 */\
async function withKeyRetry<T>(\
  fn: (apiKey: string) => Promise<T>,\
  onAllFailed: () => T,\
  overrideKey?: string,\
): Promise<T> \{\
  if (overrideKey) \{\
    try \{\
      return await fn(overrideKey);\
    \} catch \{\
      return onAllFailed();\
    \}\
  \}\
\
  if (KEY_POOL.length === 0) return onAllFailed();\
\
  // Try each key in the pool (round-robin start, then sequential fallback)\
  const tried = new Set<string>();\
  for (let attempt = 0; attempt < KEY_POOL.length; attempt++) \{\
    const key = nextPoolKey();\
    if (!key || tried.has(key)) continue;\
    tried.add(key);\
    try \{\
      return await fn(key);\
    \} catch (err) \{\
      if (isQuotaOrAuth(err)) \{\
        advancePastKey();\
        logger.warn(\{ attempt, keysLeft: KEY_POOL.length - tried.size \}, "Retrying with next Gemini key");\
        continue; // try next key immediately\
      \}\
      throw err; // non-quota errors bubble up to caller\
    \}\
  \}\
  return onAllFailed();\
\}\
\
// \uc0\u9472 \u9472 \u9472  Image Analysis \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
const FOOD_PROMPT = `\uc0\u3623 \u3636 \u3648 \u3588 \u3619 \u3634 \u3632 \u3627 \u3660 \u3619 \u3641 \u3611 \u3629 \u3634 \u3627 \u3634 \u3619 \u3609 \u3637 \u3657 \u3649 \u3621 \u3657 \u3623 \u3605 \u3629 \u3610 \u3648 \u3611 \u3655 \u3609  JSON \u3648 \u3607 \u3656 \u3634 \u3609 \u3633 \u3657 \u3609  \u3627 \u3657 \u3634 \u3617 \u3617 \u3637 \u3586 \u3657 \u3629 \u3588 \u3623 \u3634 \u3617 \u3629 \u3639 \u3656 \u3609 \
\
\uc0\u3606 \u3657 \u3634 \u3648 \u3611 \u3655 \u3609 \u3629 \u3634 \u3627 \u3634 \u3619  \u3651 \u3627 \u3657 \u3605 \u3629 \u3610 \u3651 \u3609 \u3619 \u3641 \u3611 \u3649 \u3610 \u3610 \u3609 \u3637 \u3657 :\
\{\
  "isFood": true,\
  "foodDescription": "\uc0\u3594 \u3639 \u3656 \u3629 \u3629 \u3634 \u3627 \u3634 \u3619 \u3616 \u3634 \u3625 \u3634 \u3652 \u3607 \u3618  (\u3648 \u3594 \u3656 \u3609  \u3586 \u3657 \u3634 \u3623 \u3612 \u3633 \u3604 \u3585 \u3640 \u3657 \u3591 , \u3612 \u3633 \u3604 \u3652 \u3607 \u3618 \u3652 \u3586 \u3656 \u3604 \u3634 \u3623 )",\
  "estimatedCalories": <\uc0\u3605 \u3633 \u3623 \u3648 \u3621 \u3586  kcal>,\
  "protein": <\uc0\u3650 \u3611 \u3619 \u3605 \u3637 \u3609  \u3585 \u3619 \u3633 \u3617 >,\
  "carbs": <\uc0\u3588 \u3634 \u3619 \u3660 \u3610  \u3585 \u3619 \u3633 \u3617 >,\
  "fat": <\uc0\u3652 \u3586 \u3617 \u3633 \u3609  \u3585 \u3619 \u3633 \u3617 >,\
  "motivatingComment": "\uc0\u3588 \u3629 \u3617 \u3648 \u3617 \u3609 \u3605 \u3660 \u3626 \u3633 \u3657 \u3609 \u3654  \u3649 \u3610 \u3610 \u3648 \u3611 \u3655 \u3609 \u3585 \u3633 \u3609 \u3648 \u3629 \u3591 \u3649 \u3621 \u3632 \u3651 \u3627 \u3657 \u3585 \u3635 \u3621 \u3633 \u3591 \u3651 \u3592  1-2 \u3611 \u3619 \u3632 \u3650 \u3618 \u3588 "\
\}\
\
\uc0\u3606 \u3657 \u3634 \u3652 \u3617 \u3656 \u3651 \u3594 \u3656 \u3629 \u3634 \u3627 \u3634 \u3619  \u3651 \u3627 \u3657 \u3605 \u3629 \u3610 :\
\{"isFood": false, "foodDescription": "", "estimatedCalories": 0, "protein": 0, "carbs": 0, "fat": 0, "motivatingComment": ""\}\
\
\uc0\u3611 \u3619 \u3632 \u3617 \u3634 \u3603 \u3649 \u3588 \u3621 \u3629 \u3619 \u3637 \u3649 \u3621 \u3632 \u3649 \u3617 \u3588 \u3650 \u3588 \u3619 \u3651 \u3627 \u3657 \u3626 \u3617 \u3592 \u3619 \u3636 \u3591 \u3605 \u3634 \u3617 \u3611 \u3619 \u3636 \u3617 \u3634 \u3603 \u3607 \u3637 \u3656 \u3648 \u3627 \u3655 \u3609 \u3651 \u3609 \u3619 \u3641 \u3611 `;\
\
/**\
 * Analyse a food image. Never throws \'97 returns a typed error field on failure.\
 * Uses round-robin key pool with automatic retry on quota/auth errors.\
 * Pass `overrideKey` to bypass the pool (e.g. GEMINI_PRO_KEY for owner).\
 */\
export async function analyzeFoodImage(\
  imageBase64: string,\
  mimeType: string,\
  overrideKey?: string,\
): Promise<FoodAnalysis> \{\
  if (KEY_POOL.length === 0 && !overrideKey) return fallbackError("no_api_key");\
\
  let rawText: string;\
  try \{\
    rawText = await withKeyRetry(\
      async (key) => \{\
        const ai = new GoogleGenAI(\{ apiKey: key \});\
        const response = await ai.models.generateContent(\{\
          model: "gemini-2.0-flash",\
          contents: [\
            \{\
              role: "user",\
              parts: [\
                \{ inlineData: \{ mimeType, data: imageBase64 \} \},\
                \{ text: FOOD_PROMPT \},\
              ],\
            \},\
          ],\
        \});\
        return response.text ?? "";\
      \},\
      () => "",\
      overrideKey,\
    );\
  \} catch (err) \{\
    if (isSafetyBlock(err)) return fallbackError("safety_block");\
    return fallbackError("unknown");\
  \}\
\
  if (!rawText) return fallbackError("rate_limit");\
\
  const jsonMatch = rawText.match(/\\\{[\\s\\S]*\\\}/);\
  if (!jsonMatch) return fallbackError("bad_response");\
\
  try \{\
    const parsed = JSON.parse(jsonMatch[0]) as \{\
      isFood: boolean;\
      foodDescription: string;\
      estimatedCalories: number;\
      protein: number;\
      carbs: number;\
      fat: number;\
      motivatingComment: string;\
    \};\
    return \{\
      isFood: Boolean(parsed.isFood),\
      foodDescription: parsed.foodDescription ?? "",\
      estimatedCalories: Number(parsed.estimatedCalories) || 0,\
      protein: Number(parsed.protein) || 0,\
      carbs: Number(parsed.carbs) || 0,\
      fat: Number(parsed.fat) || 0,\
      motivatingComment: parsed.motivatingComment ?? "",\
    \};\
  \} catch \{\
    return fallbackError("parse_error");\
  \}\
\}\
\
// \uc0\u9472 \u9472 \u9472  Chat \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
\
/**\
 * Free-text chat. Never throws \'97 returns empty string on total failure.\
 * Uses round-robin pool with automatic retry on quota/auth errors.\
 */\
export async function chatGenerate(\
  prompt: string,\
  systemInstruction: string,\
  overrideKey?: string,\
): Promise<string> \{\
  if (KEY_POOL.length === 0 && !overrideKey) return "";\
\
  try \{\
    return await withKeyRetry(\
      async (key) => \{\
        const ai = new GoogleGenAI(\{ apiKey: key \});\
        const response = await ai.models.generateContent(\{\
          model: "gemini-2.5-flash",\
          contents: prompt,\
          config: \{ systemInstruction \},\
        \});\
        return response.text ?? "";\
      \},\
      () => "",\
      overrideKey,\
    );\
  \} catch (err) \{\
    logger.warn(\{ err \}, "chatGenerate failed after all retries");\
    return "";\
  \}\
\}\
\
/** How many keys are loaded in the pool (for diagnostics). */\
export function getKeyPoolSize(): number \{\
  return KEY_POOL.length;\
\}\
}