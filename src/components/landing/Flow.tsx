'use client'

import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import type { SVGProps, ComponentType } from 'react'

type Step = {
  title: string
  desc: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const steps: Step[] = [
  { title: 'Upload',   desc: 'Drag-and-drop an image or generate one with AI.', Icon: Icons.Image },
  { title: 'Refine',   desc: 'Adjust dimensions, features, materials with simple controls.', Icon: Icons.SlidersHorizontal },
  // Replaced Cube → Monitor to avoid undefined on older lucide versions
  { title: 'Preview',  desc: 'Real-time multi-angle and 3D previews.', Icon: Icons.Monitor },
  { title: 'Download', desc: 'Blueprints, patterns, and a tech pack in one click.', Icon: Icons.Download },
  { title: 'Produce',  desc: 'Share securely with your manufacturer.', Icon: Icons.Share2 },
]

export default function Flow() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20" aria-labelledby="how-it-works-title">
      <div className="text-center">
        <h2 id="how-it-works-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          A guided workflow from inspiration to production-ready documentation.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(({ title, desc, Icon }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="group rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
