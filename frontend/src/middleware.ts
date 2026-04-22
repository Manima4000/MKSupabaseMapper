import { NextRequest, NextResponse } from 'next/server'

function resolvedUrl(request: NextRequest, pathname: string): URL {
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  return new URL(pathname, `${proto}://${host}`)
}

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const validToken = !!token && isTokenValid(token)
  const { pathname } = request.nextUrl

  // Redireciona /login → /dashboard se já autenticado com token válido
  if (pathname === '/login' && validToken) {
    return NextResponse.redirect(resolvedUrl(request, '/dashboard/overview'))
  }

  // Protege /dashboard/* — redireciona para /login se sem token válido
  if (pathname.startsWith('/dashboard') && !validToken) {
    const loginUrl = resolvedUrl(request, '/login')
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
