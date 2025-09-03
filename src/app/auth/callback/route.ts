import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // Validate and sanitize the 'next' parameter to prevent Open Redirect vulnerability
  const rawNext = requestUrl.searchParams.get('next') ?? '/dashboard'
  // Only allow relative paths that don't start with '//' (protocol-relative URLs)
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//'))
    ? rawNext
    : '/dashboard'

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    } else {
      console.error('Error exchanging code for session:', error)
    }
  }

  // Return to login page if there's an error or no code
  return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin))
}