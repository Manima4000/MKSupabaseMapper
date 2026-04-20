const store = new Map<string, { data: unknown; expiresAt: number }>()

export function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T)
  return fn().then(data => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}
