import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  // Redireciona /login → /dashboard se já autenticado
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard/overview', request.url))
  }

  // Protege /dashboard/* — redireciona para /login se sem token
  if (pathname.startsWith('/dashboard') && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
