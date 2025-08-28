// src/app/api//(auth)/signout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(request: Request) {
  const cookieStore = await cookies() // ✅ Next 15
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  await supabase.auth.signOut()
  // redirect back to home
  return NextResponse.redirect(new URL('/', request.url))
}
