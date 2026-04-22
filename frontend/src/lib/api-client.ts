import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { OverviewResponse, SubscriptionPageResponse, ExpiringResponse } from '@/lib/types'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

async function apiFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })

  if (res.status === 401) {
    redirect('/api/auth/logout')
  }

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

export function fetchExpiringSoon(membershipLevelId?: number): Promise<ExpiringResponse> {
  const qs = membershipLevelId ? `?membershipLevelId=${membershipLevelId}` : ''
  return apiFetch<ExpiringResponse>(`/api/analytics/expiring${qs}`)
}
