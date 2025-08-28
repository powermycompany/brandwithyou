// app/(auth)/signin/SignInClient.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SignInClient() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  const plan = (params.get('plan') ?? 'starter').toLowerCase()
  const redirectTarget = useMemo(
    () => decodeURIComponent(params.get('redirect') ?? '/dashboard'),
    [params]
  )

  const [checking, setChecking] = useState(true)

  // Use env in prod; fall back to window origin in dev
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  const redirectTo = `${baseUrl}/signin?redirect=${encodeURIComponent(
    redirectTarget
  )}`

  const upsertPlan = useCallback(
    async (userId: string) => {
      await supabase.from('profiles').upsert({ id: userId, plan })
    },
    [supabase, plan]
  )

  const handleSignedIn = useCallback(
    async (userId: string) => {
      await upsertPlan(userId)
      try {
        await supabase.rpc('mark_last_login')
      } catch {
        /* no-op */
      }
      router.replace(redirectTarget)
    },
    [upsertPlan, supabase, router, redirectTarget]
  )

  useEffect(() => {
    let unsub: (() => void) | undefined

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        await handleSignedIn(session.user.id)
        return
      }

      setChecking(false)
      const { data: sub } = supabase.auth.onAuthStateChange((event, session2) => {
        if (event === 'SIGNED_IN' && session2?.user) {
          void handleSignedIn(session2.user.id)
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })()

    return () => unsub?.()
  }, [handleSignedIn, supabase])

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {checking ? 'Checking session…' : (
          <>You selected the <span className="font-medium">{plan}</span> plan.</>
        )}
      </p>

      {!checking && (
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo={redirectTo}
        />
      )}
    </div>
  )
}
