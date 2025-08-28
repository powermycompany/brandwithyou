import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the ticket belongs to the user
  const { data: owns } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const body = (form.get('body') ?? '').toString().trim()
  if (!body) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const { error } = await supabase
    .from('support_replies')
    .insert({ ticket_id: id, author_id: user.id, body })

  if (error) {
    console.error('insert user reply error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.redirect(new URL(`/support/tickets/${id}`, req.url))
}
