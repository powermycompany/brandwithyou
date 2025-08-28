'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  // ✅ use helper

export default function SignInPage() {
  const params = useSearchParams()
  const router = useRouter()

  const plan = (params.get('plan') ?? 'starter').toLowerCase()
  const redirectTarget = useMemo(
    () => decodeURIComponent(params.get('redirect') ?? '/dashboard'),
    [params]
  )

  const [checking, setChecking] = useState(true)

  // ✅ create a client that syncs cookies for SSR
  const supabase = createClientComponentClient()

  const upsertPlan = (userId: string) => {
    supabase.from('profiles').upsert({ id: userId, plan }).then(() => {})
  }

const handleSignedIn = async (userId: string) => {
  // Save plan
  upsertPlan(userId)

  // Update last_login in profiles
  try {
  const { error } = await supabase.rpc('mark_last_login')
  if (error) console.warn('mark_last_login RPC error:', error)
} catch (e) {
  console.warn('mark_last_login RPC threw:', e)
}

  // Redirect
  router.replace(redirectTarget)
}


  useEffect(() => {
    let unsub: (() => void) | undefined

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        handleSignedIn(session.user.id)
        return
      }

      setChecking(false)
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          handleSignedIn(session.user.id)
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    })()

    return () => unsub?.()
  }, [redirectTarget, plan, router, supabase])

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
          supabaseClient={supabase} // ✅ pass helper client to Auth UI
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo={
            typeof window !== 'undefined'
              ? `${window.location.origin}/signin?redirect=${encodeURIComponent(redirectTarget)}`
              : undefined
          }
        />
      )}
    </div>
  )
}
