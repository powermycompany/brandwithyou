// src/components/settings/ProfileForm.tsx
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui'

type Props = {
  initialDisplayName: string
  initialCompany: string
  initialTimezone: string
}

export default function ProfileForm({
  initialDisplayName,
  initialCompany,
  initialTimezone,
}: Props) {
  const supabase = createClientComponentClient()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [company, setCompany] = useState(initialCompany)
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setMessage('Not signed in.')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        company,
        timezone,
      })
      .eq('id', user.id)

    setSaving(false)
    setMessage(error ? error.message : 'Saved!')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700"
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700"
          placeholder="Acme Studio"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700"
        >
          <option value="UTC">UTC</option>
          <option value="Europe/Copenhagen">Europe/Copenhagen</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Asia/Singapore">Asia/Singapore</option>
          <option value="Asia/Tokyo">Asia/Tokyo</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {message && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </span>
        )}
      </div>
    </form>
  )
}
