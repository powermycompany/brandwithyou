import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

type Ticket = {
  id: string
  user_id: string | null
  email: string | null
  subject: string
  message: string
  status: 'open' | 'closed'
  created_at: string
}

export default async function AdminSupportPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // ✅ Authenticate with getUser (no warning)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin?redirect=/admin/support')

  // ✅ Ensure admin
  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.is_admin) redirect('/')

  // Admin can read all tickets via policy
  const { data: tickets = [] } = await supabase
    .from('support_tickets')
    .select('id, user_id, email, subject, message, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support inbox</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Review and resolve tickets submitted by users.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
        >
          Back to dashboard
        </Link>
      </header>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No tickets yet.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {tickets.map((t: Ticket) => (
            <li key={t.id} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                        t.status === 'open'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{t.subject}</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    From: {t.email ?? '(no email)'}
                    {t.user_id ? ` • user ${t.user_id.slice(0, 8)}…` : ''}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{t.message}</p>
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/admin/support/${t.id}`}
                    className="rounded-xl border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                  >
                    Open thread
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
