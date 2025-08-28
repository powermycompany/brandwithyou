'use client'

import { useState } from 'react'

export default function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSending(true)

    try {
      const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || `HTTP ${res.status}`)
      }
      // refresh page to show the new message
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Failed to send')
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        required
        maxLength={8000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        placeholder="Write a reply…"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="inline-flex rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
      >
        {sending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  )
}
