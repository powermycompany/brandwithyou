import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // 1) Require auth
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2) Env + Stripe
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SITE_URL' }, { status: 500 })
    }

    // 3) Get (or discover) the Stripe customer id from your profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = profile?.stripe_customer_id ?? null

    // If we don't have it yet, try to find by email in Stripe (handy if the webhook
    // hasn’t written it yet). Then store it for next time.
    if (!customerId && user.email) {
      try {
        const found = await stripe.customers.search({
          // exact-match email search
          query: `email:'${user.email.replace(/'/g, "\\'")}'`,
          limit: 1,
        })
        const c = found.data?.[0]
        if (c?.id) {
          customerId = c.id
          await supabase.from('profiles')
            .update({ stripe_customer_id: c.id })
            .eq('id', user.id)
        }
      } catch {
        // ignore search errors; we'll just return a helpful message below
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user yet.' },
        { status: 400 }
      )
    }

    // 4) Create the Billing Portal session
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/dashboard?billing=managed`,
    })

    return NextResponse.json({ url: portal.url })
  } catch (err: any) {
    console.error('billing portal error:', err)
    const msg = err?.message || 'Failed to create billing portal session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
