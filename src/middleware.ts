import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default async function middleware(req: NextRequest) {
  const token = await getToken({
  req,
  secret: process.env.NEXTAUTH_SECRET!,
  salt: process.env.NODE_ENV === 'production' 
    ? '__Secure-authjs.session-token' 
    : 'authjs.session-token',
})

  if (!token?.sub) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/(app)/(.*)',
    '/api/projects/(.*)',
    '/api/collections/(.*)',
    '/api/settings/(.*)',
    '/api/ai/(.*)',
    '/api/upload',
    '/api/search',
  ],
}