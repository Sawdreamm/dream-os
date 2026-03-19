// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

  const response = NextResponse.redirect(new URL('/dashboard', request.url))

  if (code) {
        const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
                    cookies: {
                                getAll() { return request.cookies.getAll() },
                                setAll(cookiesToSet) {
                                              cookiesToSet.forEach(({ name, value, options }) => {
                                                              response.cookies.set(name, value, options as any)
                                              })
                                },
                    },
          }
              )
        await supabase.auth.exchangeCodeForSession(code)
  }

  return response
}
