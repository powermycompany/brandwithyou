'use client'

import { motion } from 'framer-motion'

const testimonials = [
  {
    quote:
      'This platform saved us weeks of back-and-forth with manufacturers. We went from a sketch to a factory-ready design in minutes.',
    name: 'Alex Rivera',
    role: 'Founder, Plushify Co.',
  },
  {
    quote:
      'The live 3D preview gave us complete confidence in our design before sending it to production.',
    name: 'Jamie Chen',
    role: 'Product Designer, CraftWear',
  },
  {
    quote:
      'Our manufacturer said it was the cleanest, most complete tech pack they’d ever received.',
    name: 'Morgan Lee',
    role: 'Entrepreneur',
  },
]

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20" aria-labelledby="testimonials-title">
      <div className="text-center">
        <h2
          id="testimonials-title"
          className="text-3xl font-bold tracking-tight md:text-4xl"
        >
          Trusted by creators worldwide
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          See what our users are saying about their experience.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="rounded-2xl border border-zinc-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <blockquote className="text-sm text-zinc-600 dark:text-zinc-400">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-4">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-zinc-500">{t.role}</div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  )
}
