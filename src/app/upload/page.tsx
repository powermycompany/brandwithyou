// src/app/upload/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import UploadClient from '@/components/upload/UploadClient'

export default async function UploadPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect(`/signin?redirect=${encodeURIComponent('/upload')}`)

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">Upload your design</h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          Drop your file here or choose from your device. PNG, JPG, SVG up to 10MB.
        </p>
      </header>

      <UploadClient userId={session.user.id} />
    </main>
  )
}
