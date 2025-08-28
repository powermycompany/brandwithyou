// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const md = (session.metadata ?? {}) as Record<string, string>;
        const userId = md.app_user_id || md.supabase_user_id || (session.client_reference_id ?? undefined);
        const email = session.customer_details?.email ?? undefined;

        const stripeCustomerId = (session.customer as string | null) ?? undefined;
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        if (session.mode === "subscription") {
          const update = {
            plan: "pro",
            stripe_customer_id: stripeCustomerId ?? null,
            stripe_subscription_id: stripeSubscriptionId ?? null,
            subscription_status: "active",
          };

          if (userId) {
            await supabaseAdmin.from("profiles").update(update).eq("id", userId);
          } else if (email) {
            await supabaseAdmin.from("profiles").update(update).eq("email", email);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        const customerId = sub.customer as string;

        const plan = status === "active" || status === "trialing" ? "pro" : "starter";

        await supabaseAdmin
          .from("profiles")
          .update({ plan, stripe_subscription_id: sub.id, subscription_status: status })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({ plan: "starter", stripe_subscription_id: null, subscription_status: "canceled" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: `Webhook handler failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
