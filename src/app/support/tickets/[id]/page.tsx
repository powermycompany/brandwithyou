// src/app/support/tickets/[id]/page.tsx
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
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

type Reply = {
  id: string
  body: string
  author_id: string
  created_at: string
}

export default async function UserTicketPage({
  params,
}: {
  // Next.js 15: dynamic params are async
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Require auth
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect(`/signin?redirect=/support/tickets/${id}`)

  // Fetch ONLY the user's own ticket
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, user_id, email, subject, message, status, created_at')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!ticket) notFound()

  // ---------- 👇 CLEAR UNREAD BADGE FOR USER HERE 👇 ----------
  // Safe RPC (security definer) – flips has_unread_user=false for this ticket
  // It’s okay if the function isn’t present in dev; we swallow errors.
  try {
    await supabase.rpc('mark_ticket_read', { p_ticket: id })
  } catch (_) {
    // no-op
  }
  // ---------- 👆 CLEAR UNREAD BADGE FOR USER HERE 👆 ----------

  // Load the thread
  const { data: repliesRaw } = await supabase
    .from('support_replies')
    .select('id, body, author_id, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const replies: Reply[] = repliesRaw ?? []

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{ticket.subject}</h1>
        <Link
          href="/support/tickets"
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
        >
          Back to list
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
              ticket.status === 'open'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
            }`}
          >
            {ticket.status}
          </span>
          <span className="text-sm text-zinc-500">
            {new Date(ticket.created_at).toLocaleString()}
          </span>
        </div>

        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          You opened this ticket as{' '}
          <span className="font-medium">
            {ticket.email ?? session.user.email}
          </span>
        </p>

        <p className="mt-3 whitespace-pre-wrap">{ticket.message}</p>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-semibold">Thread</h2>

        {replies.length === 0 ? (
          <p className="text-sm text-zinc-500">No replies yet.</p>
        ) : (
          <ul className="space-y-4">
            {replies.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-1 text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleString()} •{' '}
                  {r.author_id === session.user.id ? 'you' : 'support'}
                </div>
                <div className="whitespace-pre-wrap text-sm">{r.body}</div>
              </li>
            ))}
          </ul>
        )}

        {/* Reply form (only while open) */}
        {ticket.status === 'open' ? (
          <form
            action={`/api/support/tickets/${ticket.id}/reply`}
            method="post"
            className="mt-6 space-y-3"
          >
            <label htmlFor="body" className="block text-sm font-medium">
              Your reply
            </label>
            <textarea
              id="body"
              name="body"
              minLength={1}
              maxLength={5000}
              required
              className="h-32 w-full rounded-lg border border-zinc-300 p-3 text-sm outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-xl bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Send reply
            </button>
          </form>
        ) : null}
      </div>
    </main>
  )
}
