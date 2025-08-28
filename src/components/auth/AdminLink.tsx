// src/components/auth/AdminLink.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function AdminLink() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!me?.is_admin) return null

  return (
    <Link href="/admin/support" className="text-sm underline">
      Admin
    </Link>
  )
}
