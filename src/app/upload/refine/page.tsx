// src/app/upload/refine/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import RefineClient from '@/components/upload/RefineClient'

export default async function RefinePage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Ensure user is authenticated
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect(`/signin?redirect=${encodeURIComponent('/upload/refine')}`)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Refine your design</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Adjust size, materials, and colors. The preview updates in real time.
        </p>
      </header>

      {/* Client component handles all interactive UI */}
      <RefineClient />
    </main>
  )
}
