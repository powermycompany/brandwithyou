// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import AccountButton from '@/components/auth/AccountButton'
import AdminLink from '@/components/auth/AdminLink'

export const metadata: Metadata = {
  title: 'Customizer',
  description: 'From idea to manufacturable reality — in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Simple site header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">Customizer</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing">Pricing</Link>
            <Link href="/support">Support</Link>
            {/* Admin appears only for is_admin users */}
            {/* @ts-expect-error Async Server Component usage in layout is fine */}
            <AdminLink />
            <AccountButton />
          </nav>
        </header>

        {children}
      </body>
    </html>
  )
}
