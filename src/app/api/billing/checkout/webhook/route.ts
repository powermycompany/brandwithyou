// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";          // webhooks need Node runtime
export const dynamic = "force-dynamic";

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Supabase (server-only key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,     // if you have a server-only SUPABASE_URL, prefer that
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Get the raw body exactly as received
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

        // Identify user: prefer metadata, then client_reference_id, then email
        const md = (session.metadata ?? {}) as Record<string, string>;
        const userId =
          md.app_user_id || md.supabase_user_id || (session.client_reference_id ?? undefined);
        const email = session.customer_details?.email ?? undefined;

        const stripeCustomerId = (session.customer as string | null) ?? undefined;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (session.mode === "subscription") {
          if (userId) {
            await supabaseAdmin
              .from("profiles")
              .update({
                plan: "pro",
                stripe_customer_id: stripeCustomerId ?? null,
                stripe_subscription_id: stripeSubscriptionId ?? null,
                subscription_status: "active",
              })
              .eq("id", userId);
          } else if (email) {
            await supabaseAdmin
              .from("profiles")
              .update({
                plan: "pro",
                stripe_customer_id: stripeCustomerId ?? null,
                stripe_subscription_id: stripeSubscriptionId ?? null,
                subscription_status: "active",
              })
              .eq("email", email);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status; // 'active' | 'canceled' | 'past_due' | etc.
        const customerId = sub.customer as string;

        const plan = status === "active" || status === "trialing" ? "pro" : "starter";

        await supabaseAdmin
          .from("profiles")
          .update({
            plan,
            stripe_subscription_id: sub.id,
            subscription_status: status,
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await supabaseAdmin
          .from("profiles")
          .update({
            plan: "starter",
            stripe_subscription_id: null,
            subscription_status: "canceled",
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      // add more cases as needed (invoice.paid, invoice.payment_failed, etc.)
      default:
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: `Webhook handler failed: ${msg}` }, { status: 500 });
  }

  // Acknowledge receipt
  return NextResponse.json({ received: true });
}
