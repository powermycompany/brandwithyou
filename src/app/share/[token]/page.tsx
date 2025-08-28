import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

export default async function SharePage({ params }: { params: { token: string } }) {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Anonymous-friendly RPC
  const { data } = await supabase
    .rpc('get_design_by_share_token', { p_token: params.token })
    .maybeSingle()

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold">Link expired or not found</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Ask the owner to generate a new share link.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Shared Tech Pack</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        View-only link. No login required.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image_url} alt="Design" className="w-full rounded-lg object-contain" />
        </div>

        <div className="rounded-2xl border border-zinc-200 p-6 text-sm dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Specs</h2>
          <ul className="mt-3 space-y-2">
            <li><strong>Dimensions:</strong> {data.width ?? '-'} × {data.height ?? '-'} × {data.depth ?? '-'} cm</li>
            <li><strong>Material:</strong> {data.material ?? '-'}</li>
            <li><strong>Color:</strong> {data.color ?? '-'}</li>
            <li><strong>Created:</strong> {new Date(data.created_at).toLocaleString()}</li>
          </ul>

          <div className="mt-4">
            <a
              href={`/api/techpack/by-token/${params.token}/pdf`}
              className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
            >
              Download Tech Pack (PDF)
            </a>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            If you are the owner and want to edit, <Link href="/signin" className="underline">sign in</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}
