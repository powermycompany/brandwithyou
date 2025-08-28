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
    if (!user) return NextResponse.redirect(new URL(`/signin?redirect=/admin/support/${id}`, req.url))

    // Only admins should reach this route (your admin checks are on the page and via RLS)
    const form = await req.formData()
    const body = (form.get('body') ?? '').toString().trim()
    if (!body) return NextResponse.json({ error: 'Empty reply' }, { status: 400 })

    // 1) Insert reply
    const { error: insertErr } = await supabase
      .from('support_replies')
      .insert({ ticket_id: id, author_id: user.id, body })
    if (insertErr) {
      console.error(insertErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // 2) Flip user-unread flag on the ticket
    const { error: flagErr } = await supabase
      .from('support_tickets')
      .update({ has_unread_user: true })
      .eq('id', id)
    if (flagErr) {
      console.error(flagErr)
      // don’t fail the whole op for the badge, still redirect back
    }

    return NextResponse.redirect(new URL(`/admin/support/${id}`, req.url))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
