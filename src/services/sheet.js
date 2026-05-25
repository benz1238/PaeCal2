import axios from "axios";

const SHEET_TIMEOUT_MS = Number(process.env.GOOGLE_SHEET_TIMEOUT_MS || 12000);
const SHEET_RETRY_DELAY_MS = Number(process.env.GOOGLE_SHEET_RETRY_DELAY_MS || 650);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getActionName = (payload) => String(payload?.action || "UNKNOWN_ACTION");

const compactPreview = (value) => {
  if (value === undefined || value === null) return "";

  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
};

const looksLikeHtml = (value) => {
  if (typeof value !== "string") return false;
  const text = value.trim().toLowerCase();
  return text.startsWith("<!doctype html") || text.startsWith("<html") || text.includes("<title>error</title>");
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const shouldRetrySheetError = (error) => {
  if (error?.isNonJsonSheetResponse) return true;
  if (error?.code === "ECONNABORTED") return true;
  if (error?.code === "ETIMEDOUT") return true;
  if (error?.code === "ECONNRESET") return true;

  const status = Number(error?.response?.status || 0);
  if (status === 429) return true;
  if (status >= 500) return true;

  return false;
};

const normalizeSheetError = (error, payload) => {
  const action = getActionName(payload);
  const status = error?.response?.status || null;
  const data = error?.response?.data;
  const preview = compactPreview(data || error?.message || error);

  const normalized = new Error(
    `[sheet] ${action} failed${status ? ` (${status})` : ""}: ${preview || "unknown error"}`
  );

  normalized.name = "SheetServiceError";
  normalized.action = action;
  normalized.status = status;
  normalized.preview = preview;
  normalized.originalError = error;
  normalized.isSheetError = true;
  normalized.isRetryable = shouldRetrySheetError(error);

  return normalized;
};

const requestSheetOnce = async (url, payload) => {
  const res = await axios.post(url, payload, {
    timeout: SHEET_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    transformResponse: [
      (data) => {
        if (typeof data !== "string") return data;
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      },
    ],
  });

  if (looksLikeHtml(res.data) || typeof res.data === "string") {
    const err = new Error("Google Sheet returned non-JSON response");
    err.isNonJsonSheetResponse = true;
    err.response = { status: res.status, data: res.data };
    throw err;
  }

  if (!isPlainObject(res.data) && !Array.isArray(res.data)) {
    const err = new Error("Google Sheet returned unsupported response");
    err.isNonJsonSheetResponse = true;
    err.response = { status: res.status, data: res.data };
    throw err;
  }

  return res.data || {};
};

export const postToSheet = async (payload) => {
  const url = process.env.GOOGLE_SHEET_WEBAPP_URL;

  if (!url) {
    throw new Error("Missing GOOGLE_SHEET_WEBAPP_URL");
  }

  try {
    return await requestSheetOnce(url, payload);
  } catch (firstError) {
    if (!shouldRetrySheetError(firstError)) {
      throw normalizeSheetError(firstError, payload);
    }

    await wait(SHEET_RETRY_DELAY_MS);

    try {
      return await requestSheetOnce(url, payload);
    } catch (secondError) {
      throw normalizeSheetError(secondError, payload);
    }
  }
};
