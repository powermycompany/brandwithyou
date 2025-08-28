import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

type TicketRow = {
  id: string
  subject: string
  status: 'open' | 'closed'
  created_at: string
}

export default async function MyTicketsPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/signin?redirect=/support/tickets')

  const { data: tickets = [] } = await supabase
    .from('support_tickets')
    .select('id, subject, status, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">My support tickets</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        View and follow up on your requests.
      </p>

      <div className="mt-8">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You haven’t created any tickets yet.
            </p>
            <div className="mt-4">
              <Link
                href="/support"
                className="rounded-xl bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
              >
                Create a ticket
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {tickets.map((t: TicketRow) => (
              <li
                key={t.id}
                className="rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
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
                    <h3 className="mt-1 font-semibold">{t.subject}</h3>
                  </div>
                  <Link
                    className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                    href={`/support/tickets/${t.id}`}
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
