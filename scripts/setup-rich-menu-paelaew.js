import fs from "fs";
import path from "path";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const imagePath = process.env.RICH_MENU_IMAGE_PATH || process.argv[2] || "assets/richmenu.png";
const layoutPath = process.env.RICH_MENU_LAYOUT_PATH || process.argv[3] || "scripts/rich-menu-layout.paecal.json";
const deleteOld = String(process.env.DELETE_OLD || "false").toLowerCase() === "true";
const setDefault = String(process.env.SET_DEFAULT || "true").toLowerCase() === "true";

const API_BASE = "https://api.line.me";
const BLOB_API_BASE = "https://api-data.line.me";

if (!token) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

if (!fs.existsSync(layoutPath)) {
  console.error(`Layout JSON not found: ${layoutPath}`);
  process.exit(1);
}

const absoluteImagePath = path.resolve(imagePath);
const absoluteLayoutPath = path.resolve(layoutPath);
const layout = JSON.parse(fs.readFileSync(absoluteLayoutPath, "utf8"));

validateLayout(layout);

const imageExt = path.extname(absoluteImagePath).toLowerCase();
const contentType = getContentType(imageExt);
const imageBuffer = fs.readFileSync(absoluteImagePath);

const api = async (pathname, options = {}) => {
  return request(API_BASE, pathname, options);
};

const blobApi = async (pathname, options = {}) => {
  return request(BLOB_API_BASE, pathname, options);
};

async function request(baseUrl, pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${options.method || "GET"} ${baseUrl}${pathname} failed: ${res.status} ${text}`);
  }

  const responseContentType = res.headers.get("content-type") || "";
  if (responseContentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
}

async function main() {
  console.log("Starting Rich Menu setup...");
  console.log(`Image: ${absoluteImagePath}`);
  console.log(`Layout: ${absoluteLayoutPath}`);
  console.log(`deleteOld: ${deleteOld}`);
  console.log(`setDefault: ${setDefault}`);

  if (deleteOld) {
    console.log("Unlinking default rich menu (if any)...");
    await safeDeleteDefault(api);

    console.log("Deleting old rich menus...");
    const oldMenus = await listRichMenus(api);
    for (const item of oldMenus) {
      console.log(`Deleting rich menu: ${item.richMenuId} (${item.name || "no-name"})`);
      await api(`/v2/bot/richmenu/${item.richMenuId}`, { method: "DELETE" });
    }
  }

  console.log("Creating new rich menu...");
  const createPayload = {
    size: layout.size,
    selected: false,
    name: layout.name || "PaeCal Rich Menu",
    chatBarText: layout.chatBarText || "เมนู",
    areas: layout.areas,
  };

  const created = await api("/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createPayload),
  });

  const richMenuId = created.richMenuId;
  console.log(`Created rich menu: ${richMenuId}`);

  console.log("Uploading rich menu image...");
  await blobApi(`/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: imageBuffer,
  });
  console.log("Uploaded image successfully.");

  if (setDefault) {
    console.log("Setting as default rich menu...");
    await api(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
    console.log("Set as default rich menu.");
  }

  console.log("Done ✅");
}

function validateLayout(layout) {
  if (!layout || typeof layout !== "object") {
    throw new Error("Invalid layout JSON");
  }

  if (!layout.size || !layout.size.width || !layout.size.height) {
    throw new Error("layout.size.width and layout.size.height are required");
  }

  if (!Array.isArray(layout.areas) || layout.areas.length === 0) {
    throw new Error("layout.areas must be a non-empty array");
  }

  for (const [index, area] of layout.areas.entries()) {
    if (!area.bounds || !area.action) {
      throw new Error(`Area ${index} must have bounds and action`);
    }
    if (!["message", "uri", "postback"].includes(area.action.type)) {
      throw new Error(`Area ${index} has unsupported action type: ${area.action.type}`);
    }
  }
}

function getContentType(ext) {
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  throw new Error("Only .png, .jpg, and .jpeg are supported for rich menu images");
}

async function listRichMenus(apiClient) {
  const data = await apiClient("/v2/bot/richmenu/list");
  return Array.isArray(data.richmenus) ? data.richmenus : [];
}

async function safeDeleteDefault(apiClient) {
  try {
    await apiClient("/v2/bot/user/all/richmenu", { method: "DELETE" });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (!msg.includes("404") && !msg.includes("400")) {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
