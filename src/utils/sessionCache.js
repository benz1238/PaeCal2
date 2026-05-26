const DEFAULT_SESSION_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS || 600000);

const cache = new Map();

const now = () => Date.now();

const normalizeUserId = (userId) => String(userId || "").trim();

const normalizeSession = (session = {}) => ({
  ...session,
  step: session?.step || "READY",
  data: session?.data || {},
});

export const getCachedSession = (userId) => {
  const key = normalizeUserId(userId);
  if (!key) return null;

  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }

  return normalizeSession(entry.session);
};

export const setCachedSession = (userId, session, ttlMs = DEFAULT_SESSION_TTL_MS) => {
  const key = normalizeUserId(userId);
  if (!key || !session) return null;

  const normalized = normalizeSession(session);

  cache.set(key, {
    session: normalized,
    expiresAt: now() + ttlMs,
    updatedAt: now(),
  });

  return normalized;
};

export const mergeCachedSession = (userId, baseSession = {}, extraData = {}, step) => {
  const current = getCachedSession(userId) || normalizeSession(baseSession);

  const next = normalizeSession({
    ...current,
    step: step || current.step || baseSession?.step || "READY",
    data: {
      ...(current.data || {}),
      ...(baseSession?.data || {}),
      ...(extraData || {}),
    },
  });

  return setCachedSession(userId, next);
};

export const invalidateSessionCache = (userId) => {
  const key = normalizeUserId(userId);
  if (!key) return;
  cache.delete(key);
};

export const getSessionCacheStats = () => ({
  size: cache.size,
  ttlMs: DEFAULT_SESSION_TTL_MS,
});
