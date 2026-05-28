import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!token) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN.");
  console.error("Run: LINE_CHANNEL_ACCESS_TOKEN=xxx node scripts/setup-richmenus.js");
  process.exit(1);
}

const lineApi = axios.create({
  baseURL: "https://api.line.me/v2/bot",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const RICH_MENU_SIZE = { width: 2500, height: 1686 };
const ALIAS = {
  vibe: "paecal-vibe-menu",
  cal: "paecal-cal-menu",
};

const VIBE_IMAGE_PATH = path.join(rootDir, "assets", "richmenus", "paecal-richmenu-vibe.png");
const CAL_IMAGE_PATH = path.join(rootDir, "assets", "richmenus", "paecal-richmenu-cal.png");

const area = (x, y, width, height) => ({ bounds: { x, y, width, height } });
const postback = (label, data, extra = {}) => ({ type: "postback", label, data, ...extra });
const switchMenu = (label, richMenuAliasId, data) => ({
  type: "richmenuswitch",
  label,
  richMenuAliasId,
  data,
});

const buildVibeRichMenu = () => ({
  size: RICH_MENU_SIZE,
  selected: true,
  name: "PaeCal - แปะอ่านทรง",
  chatBarText: "แปะอ่านทรง",
  areas: [
    {
      ...area(0, 0, 1250, 300),
      action: postback("แปะอ่านทรง", "action=SWITCH_TO_VIBE_MENU"),
    },
    {
      ...area(1250, 0, 1250, 300),
      action: switchMenu("แปะแคล", ALIAS.cal, "action=SWITCH_TO_CAL_MENU"),
    },
    {
      ...area(0, 300, 2500, 500),
      action: postback("ส่งรูปให้แปะอ่าน", "action=SEND_PHOTO_GUIDE"),
    },
    {
      ...area(0, 800, 625, 886),
      action: postback("วันนี้อาหารฟ้องว่า", "action=DAILY_FOOD_WRAPPED"),
    },
    {
      ...area(625, 800, 625, 886),
      action: postback("สรุปวันนี้", "action=DAILY_SUMMARY"),
    },
    {
      ...area(1250, 800, 625, 886),
      action: postback("กินอะไรดี", "action=MEAL_SUGGESTION"),
    },
    {
      ...area(1875, 800, 625, 886),
      action: postback("ฉายาวันนี้", "action=FOOD_AURA"),
    },
  ],
});

const buildCalRichMenu = () => ({
  size: RICH_MENU_SIZE,
  selected: true,
  name: "PaeCal - แปะแคล",
  chatBarText: "แปะแคล",
  areas: [
    {
      ...area(0, 0, 1250, 300),
      action: switchMenu("แปะอ่านทรง", ALIAS.vibe, "action=SWITCH_TO_VIBE_MENU"),
    },
    {
      ...area(1250, 0, 1250, 300),
      action: postback("แปะแคล", "action=SWITCH_TO_CAL_MENU"),
    },
    {
      ...area(0, 300, 2500, 500),
      action: postback("ดูแคลวันนี้", "action=TODAY_CALORIES"),
    },
    {
      ...area(0, 800, 1250, 443),
      action: postback("โภชนาการ", "action=TODAY_NUTRITION"),
    },
    {
      ...area(1250, 800, 1250, 443),
      action: postback("ตั้งเป้าหมาย", "action=SET_GOAL"),
    },
    {
      ...area(0, 1243, 1250, 443),
      action: postback("แก้มื้อล่าสุด", "action=EDIT_LAST_MEAL"),
    },
    {
      ...area(1250, 1243, 1250, 443),
      action: postback("ลบมื้อล่าสุด", "action=DELETE_LAST_MEAL"),
    },
  ],
});

const ensureFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing rich menu image: ${filePath}`);
  }
};

const createRichMenu = async (payload) => {
  const res = await lineApi.post("/richmenu", payload);
  return res.data.richMenuId;
};

const uploadRichMenuImage = async (richMenuId, imagePath) => {
  const image = fs.readFileSync(imagePath);

  await lineApi.post(`/richmenu/${richMenuId}/content`, image, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": image.length,
    },
    maxBodyLength: Infinity,
  });
};

const getAlias = async (aliasId) => {
  try {
    const res = await lineApi.get(`/richmenu/alias/${aliasId}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

const upsertAlias = async (aliasId, richMenuId) => {
  const existing = await getAlias(aliasId);

  if (existing) {
    await lineApi.post(`/richmenu/alias/${aliasId}`, { richMenuId });
    return "updated";
  }

  await lineApi.post("/richmenu/alias", {
    richMenuAliasId: aliasId,
    richMenuId,
  });
  return "created";
};

const setDefaultRichMenu = async (richMenuId) => {
  await lineApi.post(`/user/all/richmenu/${richMenuId}`);
};

const main = async () => {
  ensureFile(VIBE_IMAGE_PATH);
  ensureFile(CAL_IMAGE_PATH);

  console.log("Creating rich menu: แปะอ่านทรง...");
  const vibeRichMenuId = await createRichMenu(buildVibeRichMenu());
  await uploadRichMenuImage(vibeRichMenuId, VIBE_IMAGE_PATH);
  console.log(`Created vibe rich menu: ${vibeRichMenuId}`);

  console.log("Creating rich menu: แปะแคล...");
  const calRichMenuId = await createRichMenu(buildCalRichMenu());
  await uploadRichMenuImage(calRichMenuId, CAL_IMAGE_PATH);
  console.log(`Created cal rich menu: ${calRichMenuId}`);

  const vibeAliasStatus = await upsertAlias(ALIAS.vibe, vibeRichMenuId);
  const calAliasStatus = await upsertAlias(ALIAS.cal, calRichMenuId);
  console.log(`${vibeAliasStatus} alias: ${ALIAS.vibe}`);
  console.log(`${calAliasStatus} alias: ${ALIAS.cal}`);

  await setDefaultRichMenu(vibeRichMenuId);
  console.log("Set default rich menu to: แปะอ่านทรง");

  console.log("Done. Open LINE and test the rich menu buttons.");
};

main().catch((err) => {
  console.error("Failed to setup rich menus:");
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});
