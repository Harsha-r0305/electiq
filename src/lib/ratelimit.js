const hits = globalThis.__rl ?? (globalThis.__rl = new Map());
// Simple in-memory limiter (fine for a single-process demo).
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  return true;
}
