'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

type Props = {
  initialEmail?: string | null
}

export default function SupportForm({ initialEmail }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')

  const canSubmit = email && subject && message && status !== 'sending'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('sending')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, message }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('sent')
      setSubject('')
      setMessage('')
    } catch {
      setStatus('error')
    } finally {
      // keep email field as-is
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-transparent"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Subject</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-transparent"
          placeholder="How can we help?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Message</label>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-transparent"
          placeholder="Describe your issue or request…"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </Button>

        <span className={`text-sm transition-opacity ${
          status === 'sent'
            ? 'opacity-100 text-emerald-600 dark:text-emerald-400'
            : status === 'error'
            ? 'opacity-100 text-red-600 dark:text-red-400'
            : 'opacity-0'
        }`}>
          {status === 'sent' ? 'Thanks! We’ll get back to you.' :
           status === 'error' ? 'Something went wrong.' : ''}
        </span>
      </div>
    </form>
  )
}
