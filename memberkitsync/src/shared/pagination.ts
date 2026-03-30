import type { MemberKitClient } from '../sync/memberkit-api.client.js'

export interface PaginationMeta {
  current_page: number
  total_pages: number
  total_count: number
}

// Itera sobre todas as páginas de um endpoint paginado da MemberKit
// e acumula os resultados em um array.
export async function fetchAllPages<T>(
  fetcher: (client: MemberKitClient, page: number, perPage: number) => Promise<{ items: T[]; meta: PaginationMeta }>,
  client: MemberKitClient,
  perPage = 100,
): Promise<T[]> {
  const all: T[] = []
  let page = 1

  do {
    const { items, meta } = await fetcher(client, page, perPage)
    all.push(...items)

    if (page >= meta.total_pages) break
    page++
  } while (true)

  return all
}
