import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const RICH_MENU_SIZE = { width: 2500, height: 1686 };
const ALIAS = {
  vibe: "paecal-vibe-menu",
  cal: "paecal-cal-menu",
};

const VIBE_IMAGE_PATH = path.join(rootDir, "assets", "richmenus", "paecal-richmenu-vibe.jpg");
const CAL_IMAGE_PATH = path.join(rootDir, "assets", "richmenus", "paecal-richmenu-cal.jpg");

const area = (x, y, width, height) => ({ bounds: { x, y, width, height } });
const postback = (label, data, extra = {}) => ({ type: "postback", label, data, ...extra });
const switchMenu = (label, richMenuAliasId, data) => ({
  type: "richmenuswitch",
  label,
  richMenuAliasId,
  data,
});

const buildLineApi = (token) => axios.create({
  baseURL: "https://api.line.me/v2/bot",
  headers: { Authorization: `Bearer ${token}` },
});

const buildLineDataApi = (token) => axios.create({
  baseURL: "https://api-data.line.me/v2/bot",
  headers: { Authorization: `Bearer ${token}` },
});

const buildVibeRichMenu = () => ({
  size: RICH_MENU_SIZE,
  selected: true,
  name: "PaeCal - แปะอ่านทรง",
  chatBarText: "แปะอ่านทรง",
  areas: [
    { ...area(0, 0, 1250, 300), action: postback("แปะอ่านทรง", "action=SWITCH_TO_VIBE_MENU") },
    { ...area(1250, 0, 1250, 300), action: switchMenu("แปะแคล", ALIAS.cal, "action=SWITCH_TO_CAL_MENU") },
    { ...area(0, 300, 2500, 500), action: postback("ส่งรูปให้แปะอ่าน", "action=SEND_PHOTO_GUIDE") },
    { ...area(0, 800, 833, 886), action: postback("วันนี้อาหารฟ้องว่า", "action=DAILY_FOOD_WRAPPED") },
    { ...area(833, 800, 834, 886), action: postback("กินอะไรดี", "action=MEAL_SUGGESTION") },
    { ...area(1667, 800, 833, 886), action: postback("ฉายาวันนี้", "action=FOOD_AURA") },
  ],
});

const buildCalRichMenu = () => ({
  size: RICH_MENU_SIZE,
  selected: true,
  name: "PaeCal - แปะแคล",
  chatBarText: "แปะแคล",
  areas: [
    { ...area(0, 0, 1250, 300), action: switchMenu("แปะอ่านทรง", ALIAS.vibe, "action=SWITCH_TO_VIBE_MENU") },
    { ...area(1250, 0, 1250, 300), action: postback("แปะแคล", "action=SWITCH_TO_CAL_MENU") },
    { ...area(0, 300, 2500, 500), action: postback("ดูแคลวันนี้", "action=TODAY_CALORIES") },
    { ...area(0, 800, 833, 886), action: postback("แก้มื้อล่าสุด", "action=EDIT_LAST_MEAL") },
    { ...area(833, 800, 834, 886), action: postback("ลบมื้อล่าสุด", "action=DELETE_LAST_MEAL") },
    { ...area(1667, 800, 833, 886), action: postback("ตั้งเป้าหมาย", "action=SET_GOAL") },
  ],
});

const ensureFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing rich menu image: ${filePath}`);
  }
};

const createRichMenu = async (lineApi, payload) => {
  const res = await lineApi.post("/richmenu", payload);
  return res.data.richMenuId;
};

const uploadRichMenuImage = async (lineDataApi, richMenuId, imagePath) => {
  const image = fs.readFileSync(imagePath);
  await lineDataApi.post(`/richmenu/${richMenuId}/content`, image, {
    headers: { "Content-Type": "image/jpeg", "Content-Length": image.length },
    maxBodyLength: Infinity,
  });
};

const getAlias = async (lineApi, aliasId) => {
  try {
    const res = await lineApi.get(`/richmenu/alias/${aliasId}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

const upsertAlias = async (lineApi, aliasId, richMenuId) => {
  const existing = await getAlias(lineApi, aliasId);
  if (existing) {
    await lineApi.post(`/richmenu/alias/${aliasId}`, { richMenuId });
    return "updated";
  }

  await lineApi.post("/richmenu/alias", { richMenuAliasId: aliasId, richMenuId });
  return "created";
};

const setDefaultRichMenu = async (lineApi, richMenuId) => {
  await lineApi.post(`/user/all/richmenu/${richMenuId}`);
};

export const setupRichMenus = async ({ token = process.env.LINE_CHANNEL_ACCESS_TOKEN, logger = console } = {}) => {
  if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN.");

  ensureFile(VIBE_IMAGE_PATH);
  ensureFile(CAL_IMAGE_PATH);

  const lineApi = buildLineApi(token);
  const lineDataApi = buildLineDataApi(token);

  logger.log("Creating rich menu: แปะอ่านทรง...");
  const vibeRichMenuId = await createRichMenu(lineApi, buildVibeRichMenu());
  await uploadRichMenuImage(lineDataApi, vibeRichMenuId, VIBE_IMAGE_PATH);
  logger.log(`Created vibe rich menu: ${vibeRichMenuId}`);

  logger.log("Creating rich menu: แปะแคล...");
  const calRichMenuId = await createRichMenu(lineApi, buildCalRichMenu());
  await uploadRichMenuImage(lineDataApi, calRichMenuId, CAL_IMAGE_PATH);
  logger.log(`Created cal rich menu: ${calRichMenuId}`);

  const vibeAliasStatus = await upsertAlias(lineApi, ALIAS.vibe, vibeRichMenuId);
  const calAliasStatus = await upsertAlias(lineApi, ALIAS.cal, calRichMenuId);
  logger.log(`${vibeAliasStatus} alias: ${ALIAS.vibe}`);
  logger.log(`${calAliasStatus} alias: ${ALIAS.cal}`);

  await setDefaultRichMenu(lineApi, vibeRichMenuId);
  logger.log("Set default rich menu to: แปะอ่านทรง");

  return { vibeRichMenuId, calRichMenuId, aliases: ALIAS, defaultRichMenuId: vibeRichMenuId };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  setupRichMenus()
    .then(() => console.log("Done. Open LINE and test the rich menu buttons."))
    .catch((err) => {
      console.error("Failed to setup rich menus:");
      console.error(err.response?.data || err.message || err);
      process.exit(1);
    });
}
