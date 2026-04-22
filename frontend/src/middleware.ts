import { NextRequest, NextResponse } from 'next/server'

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

  // Debug redirects only in development if needed, but in production we want to be safe
  // console.log(`[Middleware] ${pathname} - validToken: ${validToken}`)

  // Redireciona /login → /dashboard se já autenticado com token válido
  if (pathname === '/login' && validToken) {
    const dashboardUrl = new URL('/dashboard/overview', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  // Protege /dashboard/* — redireciona para /login se sem token válido
  if (pathname.startsWith('/dashboard') && !validToken) {
    const loginUrl = new URL('/login', request.url)
    // Evita loop se já estivermos tentando ir para login, mas o pathname aqui já garante isso com startsWith('/dashboard')
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
