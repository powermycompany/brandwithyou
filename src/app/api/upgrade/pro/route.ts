import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  // Example policy: Pro gets 100 credits
  const { error } = await supabase
    .from('profiles')
    .update({ plan: 'pro', credits: 100, upgraded_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ ok: false, error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
