'use client';

import * as React from 'react';

export default function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return; // prevent double-submit
    setError(null);
    setSending(true);

    try {
      const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        // try to surface a JSON error message, else fallback to status
        let message = `HTTP ${res.status}`;
        try {
          const json = (await res.json()) as { error?: unknown };
          if (json && typeof json.error === 'string') message = json.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      // refresh page to show the new message
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send';
      setError(message);
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        required
        maxLength={8000}
        value={body}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        placeholder="Write a reply…"
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || body.trim().length === 0}
        className="inline-flex rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {sending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
}
