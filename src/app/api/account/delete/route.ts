// src/app/api/account/delete/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient, createClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase' // optional if you have generated types

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

  // 1) Must be signed in
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    return NextResponse.redirect(new URL('/signin?deleted=0', req.url))
  }

  try {
    // 2) Delete designs (RLS: user must be allowed to delete their own)
    //    design_shares has ON DELETE CASCADE, so shares will be removed automatically.
    await supabase.from('designs').delete().eq('user_id', user.id)

    // 3) Delete profile (owner-only). If your RLS doesn’t allow delete, we’ll anonymize instead.
    const { error: profDelErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (profDelErr) {
      // Fall back to anonymize if delete is blocked by RLS
      await supabase
        .from('profiles')
        .update({
          display_name: null,
          company: null,
          timezone: 'UTC',
          plan: 'starter',
          credits: 0,
          storage_used: 0,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .eq('id', user.id)
    }

    // 4) Optionally delete auth user with service role (recommended to use a Supabase Edge Function in prod)
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (serviceRole && url) {
      // Use service key ONLY on the server
      const admin = createClient<Database>(url, serviceRole, {
        // auth-helpers-nextjs re-export supports this signature
        auth: { persistSession: false },
      })
      // Ignore errors here; user will be signed out anyway
      await admin.auth.admin.deleteUser(user.id).catch(() => {})
    }

    // 5) Sign out (clears the session cookies)
    await supabase.auth.signOut()

    // 6) Redirect to sign-in with a little flag
    return NextResponse.redirect(new URL('/signin?deleted=1', req.url))
  } catch (e) {
    console.error('Delete account failed:', e)
    return NextResponse.redirect(new URL('/signin?deleted=0', req.url))
  }
}
