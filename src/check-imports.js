const openai = await import("./services/openai.js");
const sheet = await import("./services/sheet.js");
const memorySheet = await import("./services/memorySheet.js");
const line = await import("./services/line.js");
const helpers = await import("./utils/helpers.js");
const profile = await import("./utils/profile.js");
const advice = await import("./utils/advice.js");
const memory = await import("./utils/memory.js");
const decision = await import("./utils/decision.js");
const personality = await import("./utils/personality.js");
const reactions = await import("./utils/reactions.js");
const textHandler = await import("./handlers/textHandler.js");
const imageHandler = await import("./handlers/imageHandler.js");

const requiredExports = [
  [openai, "parseUserIntent", "./services/openai.js"],
  [openai, "estimateFoodFromText", "./services/openai.js"],
  [openai, "estimateFoodFromImage", "./services/openai.js"],
  [openai, "generateNutritionAdvice", "./services/openai.js"],
  [openai, "generateSmartDailySummary", "./services/openai.js"],

  [sheet, "postToSheet", "./services/sheet.js"],

  [memorySheet, "getTodayDateString", "./services/memorySheet.js"],
  [memorySheet, "upsertDailyMemorySnapshot", "./services/memorySheet.js"],
  [memorySheet, "getMemorySnapshotsLast7Days", "./services/memorySheet.js"],
  [memorySheet, "get7DayMemorySummary", "./services/memorySheet.js"],
  [memorySheet, "refreshDailyMemorySnapshot", "./services/memorySheet.js"],

  [line, "client", "./services/line.js"],
  [line, "replyText", "./services/line.js"],
  [line, "replyTexts", "./services/line.js"],
  [line, "pushText", "./services/line.js"],
  [line, "pushTexts", "./services/line.js"],
  [line, "getLineDisplayName", "./services/line.js"],
  [line, "getLineImageBase64", "./services/line.js"],

  [helpers, "DEFAULT_CALORIE_TARGET", "./utils/helpers.js"],
  [helpers, "safeNumber", "./utils/helpers.js"],
  [helpers, "calculateTDEE", "./utils/helpers.js"],

  [profile, "getTitle", "./utils/profile.js"],
  [profile, "getProfile", "./utils/profile.js"],
  [profile, "buildTitleFromProfile", "./utils/profile.js"],
  [profile, "syncSessionFromProfile", "./utils/profile.js"],
  [profile, "getDisplayTitle", "./utils/profile.js"],

  [advice, "buildProgressBar", "./utils/advice.js"],
  [advice, "getSmartMealAdvice", "./utils/advice.js"],
  [advice, "getFoodLogText", "./utils/advice.js"],
  [advice, "getSummaryText", "./utils/advice.js"],
  [advice, "getMealSuggestionText", "./utils/advice.js"],

  [memory, "getMealMemoryTags", "./utils/memory.js"],
  [memory, "summarizeMealMemory", "./utils/memory.js"],
  [memory, "getContextMemoryLine", "./utils/memory.js"],
  [memory, "buildDailyMemorySnapshot", "./utils/memory.js"],
  [memory, "build7DayMemorySummary", "./utils/memory.js"],
  [memory, "shouldMention7DayMemory", "./utils/memory.js"],
  [memory, "get7DayMemoryLine", "./utils/memory.js"],
  [memory, "format7DayMemoryForPrompt", "./utils/memory.js"],

  [decision, "getDayContext", "./utils/decision.js"],
  [decision, "getMealSignals", "./utils/decision.js"],
  [decision, "decideFoodLog", "./utils/decision.js"],
  [decision, "decideMealSuggestion", "./utils/decision.js"],
  [decision, "decideDailyRecap", "./utils/decision.js"],

  [personality, "renderFoodLogReply", "./utils/personality.js"],
  [personality, "renderFoodLogMessages", "./utils/personality.js"],
  [personality, "renderMealSuggestionReply", "./utils/personality.js"],
  [personality, "renderDailyRecapReply", "./utils/personality.js"],
  [personality, "renderFallbackReply", "./utils/personality.js"],
  [personality, "renderNoFoodDetectedReply", "./utils/personality.js"],

  [reactions, "chooseReaction", "./utils/reactions.js"],
  [reactions, "getReactionBank", "./utils/reactions.js"],

  [textHandler, "handleTextMessage", "./handlers/textHandler.js"],
  [imageHandler, "handleImageMessage", "./handlers/imageHandler.js"],
];

for (const [moduleObject, exportName, filePath] of requiredExports) {
  if (!(exportName in moduleObject)) {
    throw new Error(`${filePath} does not export "${exportName}"`);
  }
}

console.log("All imports and named exports are OK");
