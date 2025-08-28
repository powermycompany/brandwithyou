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

type Reply = {
  id: string
  body: string
  author_id: string
  created_at: string
}

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // ✅ Authenticate with getUser
  const { data: { user} } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?redirect=/admin/support/${id}`)

  // ✅ Ensure admin
  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.is_admin) redirect('/')

  // Ticket
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, user_id, email, subject, message, status, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!ticket) redirect('/admin/support')

  // Replies
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
        <div className="flex gap-2">
          <Link
            href="/admin/support"
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          >
            Back to inbox
          </Link>
          {ticket.status === 'open' ? (
            <form action={`/api/admin/support/${ticket.id}/close`} method="post">
              <button
                type="submit"
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
              >
                Mark as closed
              </button>
            </form>
          ) : null}
        </div>
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

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          From: {ticket.email ?? '(no email)'}
          {ticket.user_id ? ` • user ${ticket.user_id.slice(0, 8)}…` : ''}
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
              <li key={r.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-1 text-xs text-zinc-500">
                  {new Date(r.created_at).toLocaleString()} •{' '}
                  {r.author_id === ticket.user_id ? 'user' : 'admin'}
                </div>
                <div className="whitespace-pre-wrap text-sm">{r.body}</div>
              </li>
            ))}
          </ul>
        )}

        {ticket.status === 'open' ? (
          <form
            action={`/api/admin/support/${ticket.id}/reply`}
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
