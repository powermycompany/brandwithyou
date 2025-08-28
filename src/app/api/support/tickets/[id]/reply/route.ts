import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL(`/signin?redirect=/support/tickets/${id}`, req.url))

    const form = await req.formData()
    const body = (form.get('body') ?? '').toString().trim()
    if (!body) return NextResponse.json({ error: 'Empty reply' }, { status: 400 })

    // Insert reply (RLS ensures: must own the ticket and author_id must be you)
    const { error } = await supabase.from('support_replies').insert({
      ticket_id: id,
      author_id: user.id,
      body,
    })
    if (error) {
      console.error('insert reply error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    return NextResponse.redirect(new URL(`/support/tickets/${id}`, req.url))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
