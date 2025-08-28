// src/app/api/designs/[id]/share/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // Next 15: params is a Promise
  const { id } = await ctx.params

  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Require an authenticated user (more secure than getSession)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Optional ?rotate=1 to force a new share token
    const url = new URL(req.url)
    const rotate = url.searchParams.get('rotate') === '1'

    // Call the RPC that creates (or reuses) a share record
    // Make sure you have this RPC: create_or_get_design_share(p_design_id uuid, p_ttl_minutes int, p_rotate boolean)
    const { data, error } = await supabase.rpc('create_or_get_design_share', {
      p_design_id: id,
      p_ttl_minutes: 60 * 24 * 7, // 7 days 
      p_rotate: new URL(req.url).searchParams.get('rotate') === '1',
    })

    if (error || !data) {
      console.error('create_or_get_design_share error:', error)
      return NextResponse.json(
        { error: error?.message || 'Could not create share' },
        { status: 400 }
      )
    }

    // Respond with the token (client builds the public URL)
    return NextResponse.json({
      token: data.token as string,
      expires_at: data.expires_at,
    })
  } catch (e: any) {
    console.error('share route fatal error:', e)
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
