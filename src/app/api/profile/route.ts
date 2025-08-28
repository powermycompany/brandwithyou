// src/app/api/profile/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const display_name: string | undefined = body?.display_name
    const company: string | undefined = body?.company
    const timezone: string | undefined = body?.timezone

    // Basic validation
    const payload: Record<string, any> = {}
    if (typeof display_name === 'string') payload.display_name = display_name.slice(0, 80)
    if (typeof company === 'string') payload.company = company.slice(0, 120)
    if (typeof timezone === 'string') payload.timezone = timezone

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: true }) // nothing to update
    }

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)

    if (error) {
      console.error('profile update error:', error)
      return NextResponse.json({ error: 'update_failed' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
