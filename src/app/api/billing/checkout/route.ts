// src/app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST() {
  try {
    // Auth
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Env
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!priceId || !siteUrl) {
      return NextResponse.json(
        { error: "Missing price or site URL envs" },
        { status: 500 }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?billing=success`,
      cancel_url: `${siteUrl}/pricing?billing=cancel`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { app_user_id: user.id, plan: "pro" },
      allow_promotion_codes: true,
      customer_creation: "always",
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("checkout error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
