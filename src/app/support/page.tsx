// src/app/support/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import SupportForm from '@/components/support/SupportForm'

export default async function SupportPage({
  searchParams,
}: {
  searchParams?: { sent?: string }
}) {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  const userEmail = session?.user?.email ?? ''

  const sent = searchParams?.sent === '1'

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">Contact support</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Tell us what’s going on—we’ll get back to you.
      </p>

      {sent ? (
        <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          Thanks! Your message has been sent. We’ll be in touch.
        </div>
      ) : (
        <div className="mt-8">
          <SupportForm initialEmail={userEmail} />
        </div>
      )}
    </main>
  )
}
