const DEFAULT_SUMMARY_CACHE_TTL_MS = Number(process.env.RICH_MENU_SUMMARY_CACHE_TTL_MS || 60000);

const summaryCache = new Map();

const nowMs = () => Date.now();

export const getCachedRichMenuSummary = (userId) => {
  if (!userId) return null;

  const cached = summaryCache.get(userId);
  if (!cached || cached.expiresAt <= nowMs()) {
    summaryCache.delete(userId);
    return null;
  }

  return cached.summary || null;
};

export const setCachedRichMenuSummary = (userId, summary, ttlMs = DEFAULT_SUMMARY_CACHE_TTL_MS) => {
  if (!userId) return;

  summaryCache.set(userId, {
    summary: summary || {},
    expiresAt: nowMs() + ttlMs,
  });
};

export const invalidateRichMenuSummaryCache = (userId) => {
  if (!userId) return;
  summaryCache.delete(userId);
  console.log(`[PaeCalTiming] cache:GET_DAILY_SUMMARY invalidated user=${userId}`);
};

export const clearExpiredRichMenuSummaryCache = () => {
  const now = nowMs();
  for (const [key, value] of summaryCache.entries()) {
    if (!value || value.expiresAt <= now) summaryCache.delete(key);
  }
};
