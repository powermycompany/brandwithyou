'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

type Props = { id: string }

export function ShareButton({ id }: Props) {
  const [status, setStatus] =
    useState<'idle' | 'working' | 'copied' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string>('')

  async function handleShare() {
    if (status === 'working') return
    setStatus('working')
    setErrMsg('')

    try {
      const res = await fetch(`/api/designs/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      let payload: any = null
      let fallbackText = ''
      try {
        payload = await res.json()
      } catch {
        fallbackText = await res.text().catch(() => '')
      }

      if (!res.ok) {
        const message =
          payload?.error || fallbackText || `HTTP ${res.status}`
        throw new Error(message)
      }

      const token: string = payload.token
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : ''
      const shareUrl = `${origin}/share/${token}`

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setStatus('copied')
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        window.open(shareUrl, '_blank', 'noopener,noreferrer')
        setStatus('idle')
      }
    } catch (e: any) {
      console.error(e)
      setErrMsg(e?.message || 'Something went wrong')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <Button
        type="button"
        onClick={handleShare}
        disabled={status === 'working'}
        className="border border-zinc-300 dark:border-zinc-700"
        variant="ghost"
      >
        {status === 'working' ? 'Creating…' : 'Create share link'}
      </Button>

      {/* non-blocking feedback pill */}
      <div
        aria-live="polite"
        className={`pointer-events-none select-none rounded-full px-2 py-0.5 text-xs transition-opacity ${
          status === 'copied'
            ? 'opacity-100 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
            : status === 'error'
            ? 'opacity-100 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
            : 'opacity-0'
        }`}
        title={status === 'error' ? errMsg : undefined}
      >
        {status === 'copied'
          ? 'Link copied!'
          : status === 'error'
          ? errMsg || 'Something went wrong'
          : ''}
      </div>
    </div>
  )
}
