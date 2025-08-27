'use client'

/**
 * Utility function to clear all Supabase authentication cookies
 * Use this when encountering 431 errors or authentication issues
 */
export function clearSupabaseCookies() {
  // Common Supabase cookie names
  const supabaseCookieNames = [
    'sb-access-token',
    'sb-refresh-token', 
    'supabase-auth-token',
    'sb-auth-token'
  ]

  // Clear each cookie by setting it to expire in the past
  supabaseCookieNames.forEach(cookieName => {
    // Try different path combinations
    const paths = ['/', '/auth', '/dashboard', '/convert']
    
    paths.forEach(path => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=.localhost;`
    })
  })

  // Also clear any cookies that start with 'sb-' (Supabase prefix)
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=')
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  })

  console.log('Supabase cookies cleared')
}

/**
 * Clear all cookies for the current domain
 * Use this as a last resort for persistent cookie issues
 */
export function clearAllCookies() {
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=')
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
    
    // Clear for different path combinations
    const paths = ['/', '/auth', '/dashboard', '/convert']
    paths.forEach(path => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`
    })
  })

  console.log('All cookies cleared')
}