'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decorations */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[-10%] h-[50rem] w-[50rem] -translate-x-1/2 rounded-full blur-3xl"
             style={{
               background:
                 'radial-gradient(35rem 35rem at 50% 50%, rgba(99,102,241,.35), transparent 60%)'
             }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-200/70 to-transparent dark:via-zinc-700/70" />
        <svg
          className="absolute inset-x-0 -top-12 mx-auto w-[120rem] opacity-[0.06] dark:opacity-[0.09]"
          viewBox="0 0 1440 320"
          role="img"
          aria-label="decorative"
        >
          <path fill="currentColor" d="M0,256L120,256C240,256,480,256,720,224C960,192,1200,128,1320,96L1440,64L1440,0L1320,0C1200,0,960,0,720,0C480,0,240,0,120,0L0,0Z"/>
        </svg>
      </div>

      {/* Hero content */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pb-28 md:pt-28">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-balance text-4xl font-extrabold tracking-tight md:text-6xl"
        >
          From idea to <span className="underline decoration-[--ring] underline-offset-4">manufacturable reality</span> — in minutes.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-zinc-600 md:text-xl dark:text-zinc-400"
        >
          Upload an image. Refine with intuitive controls. Download a production-ready tech pack and share it with your manufacturer.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/upload">
            <Button className="w-full sm:w-auto">Get started free</Button>
          </Link>
          <Link
            href="/pricing"
            className="w-full rounded-2xl border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          >
            See pricing
          </Link>
        </motion.div>

        {/* Mini “steps” preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 text-left sm:grid-cols-5"
        >
          {[
            ['Upload', 'Drag an image'],
            ['Refine', 'Adjust size & details'],
            ['Preview', 'Live 3D views'],
            ['Download', 'Blueprint + tech pack'],
            ['Produce', 'Share with factory'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <div className="font-semibold">{t}</div>
              <div className="mt-1 text-zinc-600 dark:text-zinc-400">{d}</div>
            </div>
          ))}
        </motion.div>

        {/* Trust bar (placeholder logos) */}
        <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-6 opacity-70">
          {['Alpha3D', 'AIPatterns', 'Kickflip', 'Supabase'].map((name) => (
            <div key={name} className="text-xs tracking-wide">
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
