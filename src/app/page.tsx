'use client'

import { Hero, Flow, Testimonials } from '@/components/landing'
import Link from 'next/link'

export default function Page() {
  return (
    <main className="relative">
      <Hero />
      <Flow />
      <Testimonials />

      <footer className="mx-auto max-w-6xl px-6 pb-16 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-8 md:flex-row dark:border-zinc-800">
          <p>© {new Date().getFullYear()} Customizer</p>
          <nav className="flex gap-6">
            <Link href="/about">About</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
