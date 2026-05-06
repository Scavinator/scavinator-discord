let cache = new Map<number, number>()

export function addToCache(id: number) {
  cache.set(id, Date.now() + 500)
}

function clearCache() {
  for (const [id, ts] of cache.entries()) {
    if (ts > Date.now()) {
      cache.delete(id);
    }
  }
}

export function shouldIgnore(id: number) {
  clearCache();
  return cache.has(id);
}
