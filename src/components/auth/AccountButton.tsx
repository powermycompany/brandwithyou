'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs' // ✅

export default function AccountButton() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const supabase = createClientComponentClient() // ✅

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSignedIn(!!session)
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  if (signedIn === null) return null

  if (!signedIn) {
    return (
      <Link href="/signin">
        <Button>Sign in</Button>
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard">
        <Button variant="ghost" className="border border-zinc-300 dark:border-zinc-700">
          Dashboard
        </Button>
      </Link>
      <form action="/api/auth/signout" method="post">
        <Button type="submit">Sign out</Button>
      </form>
    </div>
  )
}
