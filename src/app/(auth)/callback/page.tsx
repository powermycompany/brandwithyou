'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SignInCallback() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard') // where to go after login
      } else {
        router.push('/') // fallback
      }
    }
    getSession()
  }, [router, supabase])

  return <p>Signing you in…</p>
}
