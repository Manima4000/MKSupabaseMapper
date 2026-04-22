import { NextRequest, NextResponse } from 'next/server'

function resolvedUrl(request: NextRequest, pathname: string): URL {
  // When running behind a reverse proxy (e.g. Nginx Proxy Manager) that
  // terminates SSL, request.nextUrl may carry http:// internally. Reading
  // X-Forwarded-Proto ensures the redirect Location uses the correct scheme
  // (https://) and avoids a Force-SSL redirect loop at the proxy level.
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  return new URL(pathname, `${proto}://${host}`)
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  // Redireciona /login → /dashboard se já autenticado
  if (pathname === '/login' && token) {
    return NextResponse.redirect(resolvedUrl(request, '/dashboard/overview'))
  }

  // Protege /dashboard/* — redireciona para /login se sem token
  if (pathname.startsWith('/dashboard') && !token) {
    const loginUrl = resolvedUrl(request, '/login')
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
