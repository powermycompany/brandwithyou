// app/(auth)/signin/page.tsx
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Page component: ONLY renders a Suspense boundary that wraps the child
 * which actually calls useSearchParams(). This satisfies Next's rule.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-20 text-sm text-zinc-500">Loading sign-in…</div>}>
      <SignInInner />
    </Suspense>
  );
}

/**
 * Child component that uses useSearchParams(), wrapped by Suspense above.
 */
function SignInInner() {
  const params = useSearchParams();
  const router = useRouter();

  const plan = (params.get('plan') ?? 'starter').toLowerCase();
  const redirectTarget = React.useMemo(
    () => decodeURIComponent(params.get('redirect') ?? '/dashboard'),
    [params]
  );

  const [checking, setChecking] = React.useState(true);

  // Supabase client (cookie-aware on the client)
  const supabase = createClientComponentClient();

  const upsertPlan = React.useCallback(
    async (userId: string) => {
      await supabase.from('profiles').upsert({ id: userId, plan });
    },
    [supabase, plan]
  );

  const handleSignedIn = React.useCallback(
    async (userId: string) => {
      // Save plan
      await upsertPlan(userId);

      // Update last_login (best-effort)
      try {
        const { error } = await supabase.rpc('mark_last_login');
        if (error) console.warn('mark_last_login RPC error:', error);
      } catch (e) {
        console.warn('mark_last_login RPC threw:', e);
      }

      // Redirect
      router.replace(redirectTarget);
    },
    [router, redirectTarget, upsertPlan, supabase]
  );

  React.useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleSignedIn(session.user.id);
        return;
      }

      setChecking(false);
      const { data: sub } = supabase.auth.onAuthStateChange((event, session2) => {
        if (event === 'SIGNED_IN' && session2?.user) {
          void handleSignedIn(session2.user.id);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => unsub?.();
  }, [handleSignedIn, supabase]);

  // ✅ Build a safe origin for redirectTo:
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://brandwithyou.com';

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {checking ? 'Checking session…' : (
          <>You selected the <span className="font-medium">{plan}</span> plan.</>
        )}
      </p>

      {!checking && (
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo={`${origin}/signin?redirect=${encodeURIComponent(redirectTarget)}`}
        />
      )}
    </div>
  );
}
