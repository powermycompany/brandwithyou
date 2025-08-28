// src/app/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import DeleteDesignButton from '@/components/dashboard/DeleteDesignButton'
import ManageBillingButton from '@/components/billing/ManageBillingButton'
import { Button } from '@/components/ui'
import { formatBytes } from '@/lib/formatBytes'

type Profile = {
  plan: string | null
  storage_used: number | null
}

type Design = {
  id: string
  image_url: string
  width: number | null
  height: number | null
  depth: number | null
  material: string | null
  color: string | null
  created_at: string
}

export default async function DashboardPage({
  // ✅ Next 15: searchParams is a Promise and must be awaited
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const { billing } = await searchParams
  const billingFlag = billing

  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // ✅ Use getUser() to avoid the warning
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/signin?redirect=/dashboard')
  }

  // Profile (plan + storage) — safe defaults
  const { data: profileDataRaw } = await supabase
    .from('profiles')
    .select('plan, storage_used')
    .eq('id', user.id)
    .maybeSingle()

  const profileData: Profile = profileDataRaw || {
    plan: 'starter',
    storage_used: 0,
  }

  // User designs
  const { data: designs = [] } = await supabase
    .from('designs')
    .select('id, image_url, width, height, depth, material, color, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const plan = (profileData.plan ?? 'starter').toLowerCase()

  // Unread ticket badge
  const { count: unreadCount } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('has_unread_user', true)

  const hasUnread = !!unreadCount && unreadCount > 0

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome{user.email ? `, ${user.email}` : ''}
          </h1>

          <div className="mt-2 text-zinc-600 dark:text-zinc-400">
            <p>
              Current plan: <span className="font-medium">{plan}</span>
            </p>
            <p className="mt-1 text-sm">
              Storage used:{' '}
              <span className="font-medium">
                {formatBytes(profileData.storage_used ?? 0)}
              </span>
            </p>
          </div>

          {/* Tiny banners */}
          {billingFlag === 'success' && (
            <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm dark:border-emerald-700 dark:bg-emerald-900/20">
              Your subscription is active. 🎉
            </div>
          )}
          {billingFlag === 'managed' && (
            <div className="mt-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm dark:border-blue-700 dark:bg-blue-900/20">
              Billing settings updated.
            </div>
          )}
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          className="text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
        >
          <Button variant="ghost">Go to Settings</Button>
        </Link>
      </div>

      {/* Actions */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {/* Start project (prominent) */}
        <div className="md:col-span-2 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Start a project</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Upload an image and generate your blueprint/tech pack.
          </p>
          <div className="mt-4">
            <Link href="/upload">
              <Button>Go to Upload</Button>
            </Link>
          </div>
        </div>

        {/* Account column: Billing + Support */}
        <div className="rounded-2xl border border-zinc-200 p-0 dark:border-zinc-800">
          {/* Billing */}
          <div className="p-6">
            <h2 className="text-lg font-semibold">Billing</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {plan === 'pro'
                ? 'Manage your subscription and invoices.'
                : 'Need more exports and priority processing? Go Pro.'}
            </p>
            <div className="mt-4">
              {plan === 'pro' ? (
                <ManageBillingButton />
              ) : (
                <Link href="/pricing">
                  <Button
                    variant="ghost"
                    className="w-full border border-zinc-300 dark:border-zinc-700"
                  >
                    View plans
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />

          {/* Support */}
          <div className="p-6">
            <h2 className="text-lg font-semibold">Help &amp; support</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Have a question? Create a ticket or check your conversations.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link href="/support">
                <button className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
                  New ticket
                </button>
              </Link>

              <Link href="/support/tickets">
                <button className="rounded-xl border border-zinc-300 px-4 py-2 pr-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
                  My tickets
                  {hasUnread && (
                    <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white">
                      New message!
                    </span>
                  )}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Designs list */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your designs</h2>
          <span className="text-sm text-zinc-500">{designs.length} item(s)</span>
        </div>

        {designs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You don’t have any designs yet.
            </p>
            <div className="mt-4">
              <Link href="/upload">
                <Button>Start a project</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <Link href={`/generate/${d.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.image_url}
                      alt="Design"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </Link>

                <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {d.width ?? '-'}×{d.height ?? '-'}×{d.depth ?? '-'} cm
                    </span>
                  </div>
                  <div>
                    {d.material ?? '-'} • {d.color ?? '-'}
                  </div>
                  <div className="text-xs">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/generate/${d.id}`}>
                    <Button
                      variant="ghost"
                      className="border border-zinc-300 dark:border-zinc-700"
                    >
                      View
                    </Button>
                  </Link>

                  <DeleteDesignButton id={d.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
