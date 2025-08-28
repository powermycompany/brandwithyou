// src/app/api/billing/checkout/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';

export async function POST() {
  try {
    // Auth
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Env
    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!secret) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
    }
    if (!priceId || !siteUrl) {
      return NextResponse.json({ error: 'Missing price or site URL envs' }, { status: 500 });
    }

    // Stripe client (create it inside the handler)
    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

    // Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?billing=success`,
      cancel_url: `${siteUrl}/pricing?billing=cancel`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { app_user_id: user.id, plan: 'pro' },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error creating checkout session';
    console.error('checkout error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
