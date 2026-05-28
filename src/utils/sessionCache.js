const DEFAULT_SESSION_TTL_MS = Number(process.env.SESSION_CACHE_TTL_MS || 600000);
const NON_READY_SESSION_TTL_MS = Number(process.env.NON_READY_SESSION_CACHE_TTL_MS || 15000);

const cache = new Map();

const now = () => Date.now();

const normalizeUserId = (userId) => String(userId || "").trim();

const normalizeSession = (session = {}) => ({
  ...session,
  step: session?.step || "READY",
  data: session?.data || {},
});

const isNonReadyOnboardingStep = (step = "") => /ASK_NAME|ASK_PROFILE|ASK_GENDER|ASK_AGE|ASK_WEIGHT|ASK_HEIGHT|ONBOARD/i.test(String(step || ""));

const shouldBypassCachedSession = (session = {}) => {
  const normalized = normalizeSession(session);
  if (normalized.step === "READY") return false;

  // Old onboarding/session states were a frequent source of false blocks after migrating to Supabase.
  // Do not trust them for long-lived cache; let handlers re-read the current DB session instead.
  return isNonReadyOnboardingStep(normalized.step);
};

export const getCachedSession = (userId) => {
  const key = normalizeUserId(userId);
  if (!key) return null;

  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }

  const normalized = normalizeSession(entry.session);
  if (shouldBypassCachedSession(normalized)) {
    cache.delete(key);
    return null;
  }

  return normalized;
};

export const setCachedSession = (userId, session, ttlMs = DEFAULT_SESSION_TTL_MS) => {
  const key = normalizeUserId(userId);
  if (!key || !session) return null;

  const normalized = normalizeSession(session);
  const ttl = normalized.step === "READY" ? ttlMs : Math.min(ttlMs, NON_READY_SESSION_TTL_MS);

  cache.set(key, {
    session: normalized,
    expiresAt: now() + ttl,
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
  nonReadyTtlMs: NON_READY_SESSION_TTL_MS,
});
