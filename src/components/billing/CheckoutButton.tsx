'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

type Props = {
  priceId: string
  mode: 'subscription' | 'payment'
  quantity?: number
  label: string
  className?: string
}

export function CheckoutButton({ priceId, mode, quantity, label, className }: Props) {
  const [loading, setLoading] = useState(false)

  const startCheckout = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, mode, quantity }),
      })
      const { url, error } = await res.json()
      if (error || !url) throw new Error(error || 'No URL')
      window.location.href = url
    } catch (e) {
      console.error(e)
      alert('Unable to start checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={startCheckout} disabled={loading} className={className}>
      {loading ? 'Redirecting…' : label}
    </Button>
  )
}
