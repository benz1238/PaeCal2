import { DEFAULT_CALORIE_TARGET, isFemaleText } from "./helpers.js";
import { postToSheet } from "../services/sheet.js";
import { getLineDisplayName } from "../services/line.js";

export const getTitle = (gender, age, name = "") => {
  const ageNum = parseInt(age, 10) || 0;
  const cleanName = String(name || "").trim();
  const female = isFemaleText(gender);

  if (ageNum >= 30) {
    return female ? `ซ้อ${cleanName}สุดสวย` : `เฮีย${cleanName}`;
  }

  return female ? `หมวย${cleanName}` : `ตี๋${cleanName}`;
};

export const getProfile = async (userId) => {
  return await postToSheet({
    action: "GET_PROFILE",
    userId,
  });
};

export const buildTitleFromProfile = ({ name, stats, fallbackTitle = "" }) => {
  if (fallbackTitle && fallbackTitle !== "เฮีย") {
    return fallbackTitle;
  }

  if (name && stats) {
    const parts = String(stats).trim().split(/\s+/);
    return getTitle(parts[0], parts[1], name);
  }

  if (name) {
    return `เฮีย${name}`;
  }

  return "เฮีย";
};

export const syncSessionFromProfile = async ({
  userId,
  session,
  extraData = {},
}) => {
  const sessionData = session?.data || {};
  const profile = await getProfile(userId);

  let name = sessionData.name || profile.name || "";
  let stats = sessionData.stats || profile.stats || "";
  let title = sessionData.title || profile.title || "";

  if (!name) {
    name = await getLineDisplayName(userId);
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

  await postToSheet({
    action: "UPDATE_SESSION",
    userId,
    step: session?.step || "READY",
    sessionData: mergedData,
  });

  return mergedData;
};

export const getDisplayTitle = async ({ userId, session }) => {
  const currentTitle = session?.data?.title;

  if (currentTitle && currentTitle !== "เฮีย") {
    return currentTitle;
  }

  const synced = await syncSessionFromProfile({
    userId,
    session,
  });

  return synced.title || "เฮีย";
};
