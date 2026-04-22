import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value

  // Invalida a sessão no servidor em background (best-effort)
  if (token) {
    fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('access_token')
  response.cookies.delete('refresh_token')
  return response
}
