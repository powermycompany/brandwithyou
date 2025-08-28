import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Use the **service role** key on the server for webhooks.
// DO NOT expose this key to the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only env var
)

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  const buf = await req.arrayBuffer()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(buf), sig, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Identify the user: prefer metadata (set when creating the Checkout Session),
        // otherwise fall back to email.
        const userId = (session.metadata as Record<string, string> | null | undefined)?.supabase_user_id
        const email = session.customer_details?.email ?? null

        // Stripe objects we want to persist
        const stripeCustomerId = (session.customer as string | undefined) ?? null
        const stripeSubscriptionId =
          (typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id) ?? null

        // Only subscriptions are relevant now
        if (session.mode === 'subscription') {
          if (userId) {
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: 'pro',
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                subscription_status: 'active',
              })
              .eq('id', userId)
          } else if (email) {
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: 'pro',
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                subscription_status: 'active',
              })
              .eq('email', email)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status // 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'incomplete'...
        const customerId = sub.customer as string

        const plan = status === 'active' || status === 'trialing' ? 'pro' : 'starter'

        await supabaseAdmin
          .from('profiles')
          .update({
            plan,
            stripe_subscription_id: sub.id,
            subscription_status: status,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await supabaseAdmin
          .from('profiles')
          .update({
            plan: 'starter',
            stripe_subscription_id: null,
            subscription_status: 'canceled',
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      default:
        // no-op for other events
        break
    }
  } catch (err) {
    console.error('Webhook handler failed:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  // Respond 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}
