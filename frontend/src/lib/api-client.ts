import type { OverviewResponse, SubscriptionPageResponse } from '@/lib/types'

const BACKEND_URL = process.env.BACKEND_URL
const BACKEND_API_KEY = process.env.BACKEND_API_KEY

async function apiFetch<T>(path: string): Promise<T> {
  const headers: HeadersInit = {}
  if (BACKEND_API_KEY) headers['Authorization'] = `Bearer ${BACKEND_API_KEY}`

  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Backend respondeu ${res.status} em ${path}`)
  }
  return res.json() as Promise<T>
}

export function fetchOverview(from: string, to: string): Promise<OverviewResponse> {
  return apiFetch<OverviewResponse>(`/api/analytics/overview?from=${from}&to=${to}`)
}

export function fetchSubscriptions(from: string, to: string, membershipLevelId?: number): Promise<SubscriptionPageResponse> {
  let url = `/api/analytics/subscriptions?from=${from}&to=${to}`
  if (membershipLevelId) url += `&membershipLevelId=${membershipLevelId}`
  return apiFetch<SubscriptionPageResponse>(url)
}

export function fetchRiskScores(membershipLevelId?: number): Promise<any[]> {
  let url = '/api/analytics/risk'
  if (membershipLevelId) url += `?membershipLevelId=${membershipLevelId}`
  return apiFetch<any[]>(url)
}
