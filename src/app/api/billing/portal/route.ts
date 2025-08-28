// src/app/api/billing/portal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

type PortalBody = { customerId?: string; returnUrl?: string };

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // parse body (optional)
    let body: PortalBody = {};
    try {
      if (req.headers.get("content-length") !== "0") {
        body = (await req.json()) as PortalBody;
      }
    } catch { /* ignore */ }

    // find customer id
    let customerId = body.customerId;
    if (!customerId) {
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();
      if (profErr) return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
      customerId = profile?.stripe_customer_id ?? undefined;
    }
    if (!customerId) return NextResponse.json({ error: "No Stripe customer for user" }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_SITE_URL" }, { status: 500 });
    const returnUrl = body.returnUrl ?? `${siteUrl}/account`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: portal.url }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
