'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui'

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY

type Tier = {
  name: 'Starter' | 'Pro' | 'Enterprise'
  price: string
  frequency?: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
}

const tiers: Tier[] = [
  {
    name: 'Starter',
    price: '$0',
    frequency: '/month',
    description: 'Get started designing with core features.',
    features: [
      'Upload images & basic AI processing',
      'Refine dimensions & materials',
      'Export low-res previews',
    ],
    cta: 'Start free',
  },
  {
    name: 'Pro',
    price: '$19',
    frequency: '/month',
    description: 'For creators who need full control & export options.',
    features: [
      'All Starter features',
      'Unlimited AI refinements',
      'High-res blueprint export',
      'Download full tech packs',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Tailored solutions for teams and large-scale production.',
    features: [
      'All Pro features',
      'Dedicated account manager',
      'Custom AI model training',
      'Direct manufacturer integrations',
    ],
    cta: 'Contact sales',
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState(false)

  async function startProCheckout() {
    if (!PRO_PRICE_ID) {
      alert('Missing price id. Set NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY in .env.local')
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: PRO_PRICE_ID, mode: 'subscription' }),
      })

      // Not signed in → redirect to sign-in with plan=pro and come back here
      if (res.status === 401) {
        window.location.href = '/signin?plan=pro&redirect=/pricing'
        return
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch (err) {
      console.error(err)
      alert('Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Simple, transparent pricing</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Choose a plan that fits your needs. Upgrade anytime.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {tiers.map((tier, i) => {
          const isPro = tier.name === 'Pro'
          const isStarter = tier.name === 'Starter'
          const isEnterprise = tier.name === 'Enterprise'

          return (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                tier.highlight
                  ? 'border-indigo-500 ring-2 ring-indigo-500 dark:border-indigo-400'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="mt-2 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold">{tier.price}</span>
                {tier.frequency && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{tier.frequency}</span>
                )}
              </p>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{tier.description}</p>

              <ul className="mt-6 space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isEnterprise ? (
                  <Link
                    href="/support"
                    className="block rounded-xl border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                  >
                    {tier.cta}
                  </Link>
                ) : isStarter ? (
                  <Link href="/signin?plan=starter">
                    <Button className="w-full">{tier.cta}</Button>
                  </Link>
                ) : (
                  <Button className="w-full" onClick={startProCheckout} disabled={loading}>
                    {loading ? 'Redirecting…' : tier.cta}
                  </Button>
                )}
              </div>

              {isPro && (
                <p className="mt-2 text-center text-xs text-zinc-500">Secure checkout by Stripe</p>
              )}
            </motion.div>
          )
        })}
      </div>
    </main>
  )
}
