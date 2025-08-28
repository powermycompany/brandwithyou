// src/app/settings/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { Button } from '@/components/ui'
import ManageBillingButton from '@/components/billing/ManageBillingButton'
import { formatBytes } from '@/lib/formatBytes'
import ProfileForm from '@/components/settings/ProfileForm'
import DeleteAccountButton from '@/components/settings/DeleteAccountButton'


export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Require auth
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/signin?redirect=/settings')

  // Profile + account data (safe defaults if missing)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, plan, storage_used, created_at, last_login, display_name, company, timezone')
    .eq('id', session.user.id)
    .maybeSingle()

  const email = profile?.email ?? session.user.email ?? ''
  const plan = (profile?.plan ?? 'starter').toLowerCase()
  const storageUsed = profile?.storage_used ?? 0
  const createdAt = profile?.created_at ?? null
  const lastLogin = profile?.last_login ?? null

  const displayName = profile?.display_name ?? ''
  const company = profile?.company ?? ''
  const timezone = profile?.timezone ?? 'UTC'

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage your profile and account preferences.
      </p>

      {/* Plan summary */}
      <section className="mt-8 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Plan</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              You’re on the <span className="font-medium">{plan}</span> plan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {plan === 'pro' ? (
              <ManageBillingButton />
            ) : (
              <Link
                href="/pricing"
                className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
              >
                View plans
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Account info */}
      <section className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Account</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd className="text-sm font-medium">{email}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Storage used</dt>
            <dd className="text-sm font-medium">{formatBytes(storageUsed)}</dd>
          </div>
          {createdAt && (
            <div>
              <dt className="text-sm text-zinc-500">Created</dt>
              <dd className="text-sm font-medium">
                {new Date(createdAt).toLocaleString()}
              </dd>
            </div>
          )}
          {lastLogin && (
            <div>
              <dt className="text-sm text-zinc-500">Last login</dt>
              <dd className="text-sm font-medium">
                {new Date(lastLogin).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          {plan === 'pro' ? (
            <ManageBillingButton />
          ) : (
            <Link href="/pricing">
              <Button
                variant="ghost"
                className="border border-zinc-300 dark:border-zinc-700"
              >
                Upgrade to Pro
              </Button>
            </Link>
          )}
          <form action="/api/auth/signout" method="post">
            <Button
              variant="ghost"
              className="border border-zinc-300 dark:border-zinc-700"
            >
              Sign out
            </Button>
          </form>
        </div>
      </section>

      {/* Profile form */}
      <section className="mt-6 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This is how manufacturers will see your info on shared links and PDFs.
        </p>
        <div className="mt-6">
          <ProfileForm
            initialDisplayName={displayName}
            initialCompany={company}
            initialTimezone={timezone}
          />
        </div>
      </section>

        {/* Optional: Danger zone */}
        <section className="mt-6 rounded-2xl border border-red-200 p-6 dark:border-red-800/60">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Danger zone
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Permanently delete your account and all designs.
        </p>
        <div className="mt-4">
            {/* New confirmation modal button */}
            <DeleteAccountButton />
        </div>
        </section>
    </main>
  )
}
