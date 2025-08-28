// src/app/api/billing/checkout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import Stripe from 'stripe'

export async function POST() {
  try {
    // 1) Auth (must be signed in)
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2) Env & Stripe init
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    })

    if (!priceId || !siteUrl) {
      return NextResponse.json(
        { error: 'Missing price or site URL envs' },
        { status: 500 }
      )
    }

    // 3) Create Checkout Session (subscription to Pro)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // where to go after payment/cancel:
      success_url: `${siteUrl}/dashboard?billing=success`,
      cancel_url: `${siteUrl}/pricing?billing=cancel`,

      // optional but nice: preload email + attach metadata
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        app_user_id: user.id,
        plan: 'pro',
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    // 4) Return the URL (your client redirects)
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('checkout error:', err)
    const msg =
      err?.message ||
      err?.raw?.message ||
      'Server error creating checkout session'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
