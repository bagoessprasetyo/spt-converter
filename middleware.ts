import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              request.cookies.set({
                name,
                value,
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value,
                ...options,
              })
            } catch (error) {
              console.error('Cookie set error:', error)
            }
          },
          remove(name: string, options: any) {
            try {
              request.cookies.set({
                name,
                value: '',
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value: '',
                ...options,
              })
            } catch (error) {
              console.error('Cookie remove error:', error)
            }
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/convert', '/settings', '/api/convert', '/api/status', '/api/download']
    const authRoutes = ['/auth/login', '/auth/register']
    
    const isProtectedRoute = protectedRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )
    const isAuthRoute = authRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )

    // Redirect authenticated users away from auth pages
    if (user && isAuthRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect unauthenticated users to login for protected routes
    if (!user && isProtectedRoute) {
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    
    // If there's an error (like cookie size issues), clear auth and redirect to login
    const protectedRoutes = ['/dashboard', '/convert', '/settings']
    const isProtectedRoute = protectedRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )
    
    if (isProtectedRoute) {
      // Create a new response that clears cookies and redirects
      const redirectResponse = NextResponse.redirect(new URL('/auth/login', request.url))
      
      // Clear potentially problematic Supabase cookies
      const supabaseCookies = ['sb-auth-token', 'supabase-auth-token', 'sb-access-token', 'sb-refresh-token']
      supabaseCookies.forEach(cookieName => {
        redirectResponse.cookies.set(cookieName, '', {
          expires: new Date(0),
          path: '/',
        })
      })
      
      return redirectResponse
    }
    
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}