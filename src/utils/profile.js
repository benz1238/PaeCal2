import { DEFAULT_CALORIE_TARGET } from "./helpers.js";
import { getLineDisplayName } from "../services/line.js";
import { getProfile as getDbProfile, updateSession } from "../services/db.js";

const BOT_ROLE_PREFIX_PATTERN = /^(แปะ|อาแปะ|เฮีย|เจ๊|ซ้อ|อาตี๋|ตี๋|หมวย)+/i;

const cleanUserName = (value = "") => String(value || "")
  .trim()
  .replace(BOT_ROLE_PREFIX_PATTERN, "")
  .trim();

const cleanDisplayTitle = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "ลื้อ";

  const cleaned = cleanUserName(text);
  if (!cleaned) return "ลื้อ";

  return cleaned;
};

export const getTitle = (_gender, _age, name = "") => cleanDisplayTitle(name);

export const getProfile = async (userId) => getDbProfile(userId);

export const buildTitleFromProfile = ({ name, stats: _stats, fallbackTitle = "" }) => {
  const cleanedName = cleanUserName(name);
  const cleanedFallback = cleanDisplayTitle(fallbackTitle);

  if (cleanedName) return cleanedName;
  if (cleanedFallback && cleanedFallback !== "ลื้อ") return cleanedFallback;

  return "ลื้อ";
};

export const syncSessionFromProfile = async ({
  userId,
  session,
  extraData = {},
}) => {
  const sessionData = session?.data || {};
  const profile = await getProfile(userId);

  let name = cleanUserName(sessionData.name || profile.name || "");
  let stats = sessionData.stats || profile.stats || "";
  let title = cleanDisplayTitle(sessionData.title || profile.title || "");

  if (!name) {
    name = cleanUserName(await getLineDisplayName(userId));
  }

  title = buildTitleFromProfile({
    name,
    stats,
    fallbackTitle: title,
  });

  const mergedData = {
    ...sessionData,
    name,
    stats,
    title,
    goal: sessionData.goal || profile.goal || "",
    calorieTarget:
      sessionData.calorieTarget ||
      profile.calorieTarget ||
      DEFAULT_CALORIE_TARGET,
    ...extraData,
  };

  await updateSession({
    userId,
    step: session?.step || "READY",
    sessionData: mergedData,
  });

  return mergedData;
};

export const getDisplayTitle = async ({ userId, session }) => {
  const currentTitle = cleanDisplayTitle(session?.data?.title);

  if (currentTitle && currentTitle !== "ลื้อ") {
    return currentTitle;
  }

  const synced = await syncSessionFromProfile({
    userId,
    session,
  });

  return cleanDisplayTitle(synced.title || synced.name || "ลื้อ");
};
