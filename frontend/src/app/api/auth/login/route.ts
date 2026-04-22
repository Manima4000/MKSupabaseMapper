import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }

  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  }).catch(() => null)

  if (!res || !res.ok) {
    const msg = res ? (await res.json().catch(() => ({}))).error : 'Serviço indisponível'
    return NextResponse.json({ error: msg ?? 'Credenciais inválidas' }, { status: res?.status ?? 503 })
  }

  const data = await res.json()
  const response = NextResponse.json({ ok: true, user: data.user })

  // Detecta se a requisição original vinda do proxy (NPM/Nginx) era HTTPS
  const xForwardedProto = request.headers.get('x-forwarded-proto')
  const isSecure = xForwardedProto === 'https' || process.env.NODE_ENV === 'production'

  const cookieOpts = {
    httpOnly: true,
    secure: isSecure, // Usa secure apenas se for HTTPS no proxy ou em produção (se HTTPS estiver configurado)
    sameSite: 'lax' as const,
    path: '/',
  }


  response.cookies.set('access_token', data.access_token, {
    ...cookieOpts,
    maxAge: data.expires_in ?? 3600,
  })
  response.cookies.set('refresh_token', data.refresh_token, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  })

  return response
}
