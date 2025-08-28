'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  const openPortal = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const payload = await res.json()
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || `HTTP ${res.status}`)
      }
      window.location.href = payload.url
    } catch (e) {
      console.error(e)
      alert('Could not open billing portal.')
      setLoading(false)
    }
  }

  return (
    <Button onClick={openPortal} variant="ghost" className="border border-zinc-300 dark:border-zinc-700" disabled={loading}>
      {loading ? 'Opening…' : 'Manage billing'}
    </Button>
  )
}
