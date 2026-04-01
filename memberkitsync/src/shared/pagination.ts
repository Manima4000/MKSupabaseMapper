import type { MemberKitClient } from '../sync/memberkit-api.client.js'
import { logger } from './logger.js'

export interface PaginationMeta {
  current_page: number
  total_pages: number
  total_count: number
}

// Busca page 1 para descobrir total_pages, depois busca as demais páginas
// sequencialmente para não causar burst de requests e evitar 429.
export async function fetchAllPages<T>(
  fetcher: (client: MemberKitClient, page: number, perPage: number) => Promise<{ items: T[]; meta: PaginationMeta }>,
  client: MemberKitClient,
  perPage = 100,
  label = 'fetchAllPages',
): Promise<T[]> {
  const pageStart = Date.now()
  const { items: firstItems, meta } = await fetcher(client, 1, perPage)

  logger.info(
    { label, totalCount: meta.total_count, totalPages: meta.total_pages, perPage },
    `[${label}] ${meta.total_count} registros em ${meta.total_pages} página(s)`,
  )

  if (meta.total_pages <= 1) return firstItems

  // Dispara todas as páginas restantes em paralelo — o throttle do cliente
  // serializa os timestamps e garante no máximo 115 req/min automaticamente.
  const remaining = await Promise.all(
    Array.from({ length: meta.total_pages - 1 }, (_, i) =>
      fetcher(client, i + 2, perPage),
    ),
  )

  const allItems: T[] = [...firstItems]
  for (const { items } of remaining) {
    allItems.push(...items)
  }

  const elapsed = ((Date.now() - pageStart) / 1000).toFixed(1)
  logger.info({ label, total: allItems.length, elapsed: `${elapsed}s` }, `[${label}] ${allItems.length} registros carregados em ${elapsed}s`)
  return allItems
}

// Executa fn em paralelo sobre todos os items com no máximo `concurrency`
// workers simultâneos. Útil para processar grandes listas sem disparar tudo
// de uma vez (evita pressão excessiva de memória/conexões).
export async function runConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  concurrency = 20,
  label?: string,
): Promise<void> {
  let index = 0
  let done = 0
  const total = items.length
  // Log a cada ~10% do total, mínimo a cada 10 itens
  const logStep = Math.max(10, Math.floor(total / 10))

  const worker = async (): Promise<void> => {
    while (index < items.length) {
      const i = index++
      await fn(items[i]!)
      done++
      if (label && total > logStep && done % logStep === 0 && done < total) {
        const pct = Math.round((done / total) * 100)
        logger.info({ label, done, total, pct }, `[${label}] ${done}/${total} (${pct}%)`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}
