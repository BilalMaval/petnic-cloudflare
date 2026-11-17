// Best-effort in-memory limiter. On serverless hosting each instance keeps its
// own counters, so this slows casual guessing but is not a hard guarantee.
const buckets = new Map();

export function clientIp(request) {
  // On Cloudflare, CF-Connecting-IP is set by the edge and can't be spoofed by the client.
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : request.headers.get('x-real-ip') || 'unknown').trim();
}

// Returns true if the request is allowed.
export function allowRequest(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}
