export default function Success() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="text-2xl font-bold">Payment successful</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Your account will update in a moment. You can safely close this window.
      </p>
      <a href="/dashboard" className="mt-6 inline-block rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
        Back to dashboard
      </a>
    </main>
  )
}
