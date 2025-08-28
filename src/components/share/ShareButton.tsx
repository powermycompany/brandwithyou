'use client';

import * as React from 'react';
import { Button } from '@/components/ui';

type Props = { id: string };

type ShareSuccess = {
  token: string;
  expires_at?: string | null;
};

export function ShareButton({ id }: Props) {
  const [status, setStatus] =
    React.useState<'idle' | 'working' | 'copied' | 'error'>('idle');
  const [errMsg, setErrMsg] = React.useState<string>('');

  async function handleShare() {
    if (status === 'working') return;
    setStatus('working');
    setErrMsg('');

    try {
      const res = await fetch(`/api/designs/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Try JSON first, fall back to text for better error messages
      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');

      const data: unknown = isJson ? await res.json().catch(() => undefined) : undefined;
      const textFallback = !isJson ? await res.text().catch(() => '') : '';

      if (!res.ok) {
        const message =
          (typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof (data as { error?: unknown }).error === 'string' &&
            (data as { error: string }).error) ||
          textFallback ||
          `HTTP ${res.status}`;
        throw new Error(message);
      }

      // Narrow the success payload
      if (
        typeof data !== 'object' ||
        data === null ||
        !('token' in data) ||
        typeof (data as Record<string, unknown>).token !== 'string'
      ) {
        throw new Error('Malformed response');
      }

      const { token } = data as ShareSuccess;

      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      const shareUrl = `${origin}/share/${token}`;

      // Copy to clipboard if available, otherwise open in a new tab
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setStatus('copied');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        setStatus('idle');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      console.error(err);
      setErrMsg(message);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <Button
        type="button"
        onClick={handleShare}
        disabled={status === 'working'}
        className="border border-zinc-300 dark:border-zinc-700"
      >
        {status === 'working' ? 'Creating…' : 'Create share link'}
      </Button>

      {/* non-blocking feedback pill */}
      <div
        aria-live="polite"
        className={`pointer-events-none select-none rounded-full px-2 py-0.5 text-xs transition-opacity ${
          status === 'copied'
            ? 'opacity-100 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
            : status === 'error'
            ? 'opacity-100 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
            : 'opacity-0'
        }`}
        title={status === 'error' ? errMsg : undefined}
      >
        {status === 'copied'
          ? 'Link copied!'
          : status === 'error'
          ? errMsg || 'Something went wrong'
          : ''}
      </div>
    </div>
  );
}
