// src/app/generate/[id]/page.tsx
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { ShareButton } from '@/components/share/ShareButton'

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Next 15: params is async
  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Require sign-in
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    redirect(`/signin?redirect=/generate/${id}`)
  }

  // Owner-scoped fetch
  const { data } = await supabase
    .from('designs')
    .select(
      'id, image_url, width, height, depth, material, color, created_at, user_id'
    )
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!data) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Your Tech Pack</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Preview your generated design and specifications.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Image preview */}
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image_url}
            alt="Design"
            className="w-full rounded-lg object-contain"
          />
        </div>

        {/* Specs + actions */}
        <div className="rounded-2xl border border-zinc-200 p-6 text-sm dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Specs</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <strong>Dimensions:</strong> {data.width ?? '-'} × {data.height ?? '-'} ×{' '}
              {data.depth ?? '-'} cm
            </li>
            <li>
              <strong>Material:</strong> {data.material ?? '-'}
            </li>
            <li>
              <strong>Color:</strong> {data.color ?? '-'}
            </li>
            <li>
              <strong>Created:</strong> {new Date(data.created_at).toLocaleString()}
            </li>
          </ul>

          {/* Downloads */}
          <a
            href={data.image_url}
            download
            className="mt-6 inline-flex rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
          >
            Download image
          </a>

          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={`/api/techpack/${data.id}/pdf`}
              className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
            >
              Download Tech Pack (PDF)
            </a>

            {/* Owner-only share (POSTs then copies the link) */}
            <ShareButton id={data.id} />
          </div>
        </div>
      </div>
    </main>
  )
}
