const DEFAULT_TTL_MS = Number(process.env.SUMMARY_CACHE_TTL_MS || 120000);

const cache = new Map();

const now = () => Date.now();

const normalizeUserId = (userId) => String(userId || "").trim();

export const getCachedSummary = (userId) => {
  const key = normalizeUserId(userId);
  if (!key) return null;

  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }

  return entry.summary;
};

export const setCachedSummary = (userId, summary, ttlMs = DEFAULT_TTL_MS) => {
  const key = normalizeUserId(userId);
  if (!key || !summary || typeof summary !== "object") return null;

  cache.set(key, {
    summary,
    expiresAt: now() + ttlMs,
    updatedAt: now(),
  });

  return summary;
};

export const invalidateSummaryCache = (userId) => {
  const key = normalizeUserId(userId);
  if (!key) return;
  cache.delete(key);
};

export const refreshSummaryCacheFromSheetResponse = (userId, response) => {
  if (!response || typeof response !== "object") {
    invalidateSummaryCache(userId);
    return null;
  }

  // Most Apps Script write actions return formatSummaryResponse(...)
  // so the response can become the new cache immediately.
  const hasSummaryShape =
    "todayCalories" in response ||
    "totalToday" in response ||
    "calorieTarget" in response ||
    "mealCount" in response ||
    "meals" in response;

  if (!hasSummaryShape) {
    invalidateSummaryCache(userId);
    return null;
  }

  return setCachedSummary(userId, response);
};

export const getSummaryCacheStats = () => ({
  size: cache.size,
  ttlMs: DEFAULT_TTL_MS,
});
