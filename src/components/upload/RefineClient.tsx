'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Material = 'plush' | 'cotton' | 'ceramic'
type Units = 'cm' | 'in'

export default function RefineClient() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [imgType, setImgType] = useState<string | null>(null)
  const [imgName, setImgName] = useState<string | null>(null)
  const [imgData, setImgData] = useState<string | null>(null)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)

  const [units, setUnits] = useState<Units>('cm')
  const [height, setHeight] = useState<number>(30)
  const [width, setWidth] = useState<number>(20)
  const [depth, setDepth] = useState<number>(10)
  const [material, setMaterial] = useState<Material>('plush')
  const [color, setColor] = useState<string>('#8b5cf6')

  const [submitting, setSubmitting] = useState(false)

  // Load from sessionStorage (set by UploadClient)
  useEffect(() => {
    const t = sessionStorage.getItem('upload:current:type')
    const n = sessionStorage.getItem('upload:current:name')
    const d = sessionStorage.getItem('upload:current:data')
    setImgType(t)
    setImgName(n)
    setImgData(d)

    if (d) {
      fetch(d)
        .then((res) => res.blob())
        .then((blob) => setImageBlob(blob))
        .catch((err) => console.error('Failed to load blob', err))
    }
  }, [])

  const dimsLabel = useMemo(() => {
    const toIn = (v: number) => (v / 2.54).toFixed(1)
    if (units === 'cm') return `${height} × ${width} × ${depth} cm`
    return `${toIn(height)} × ${toIn(width)} × ${toIn(depth)} in`
  }, [height, width, depth, units])

  const handleContinue = async () => {
    if (!imageBlob || !imgName) return
    setSubmitting(true)

    // Ensure the user is logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/signin?redirect=/upload/refine')
      return
    }

    // 1) Atomically consume one credit
    const { data: creditOk, error: creditErr } = await supabase.rpc('use_one_credit')
    if (creditErr || !creditOk) {
      setSubmitting(false)
      alert('You are out of credits on your current plan. Please upgrade to continue.')
      router.push('/pricing?reason=credits')
      return
    }

    // 2) Upload to Supabase Storage
    const fileExt = imgName.split('.').pop()
    const fileName = `${Date.now()}-${user.id}.${fileExt}`
    const { error: storageError } = await supabase
      .storage
      .from('designs')
      .upload(fileName, imageBlob, {
        contentType: imgType || 'image/png',
      })

    if (storageError) {
      console.error(storageError)
      setSubmitting(false)
      return
    }

    // ✅ 2.1) Track storage usage in profiles
        try {
      const { error: bytesErr } = await supabase.rpc('add_storage_bytes', {
        delta: imageBlob.size, // number is fine for bigint
      })
      if (bytesErr) {
        console.warn('add_storage_bytes RPC returned error:', bytesErr)
      }
    } catch (e) {
      // Network/transport error
      console.warn('add_storage_bytes RPC threw:', e)
    }

    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/${fileName}`

    // 3) Insert DB record
    const { data: insertData, error: insertError } = await supabase
      .from('designs')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        width,
        height,
        depth,
        material,
        color,
      })
      .select()
      .single()

    if (insertError) {
      console.error(insertError)
      setSubmitting(false)
      return
    }

    // 4) Redirect to generate page
    router.push(`/generate/${insertData.id}`)

    // Optional: clear temporary sessionStorage after success
    sessionStorage.removeItem('upload:current:type')
    sessionStorage.removeItem('upload:current:name')
    sessionStorage.removeItem('upload:current:data')
    sessionStorage.removeItem('refine:current')
  }

  const missing = !imgData || !imgType

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {!missing ? (
            imgType === 'image/svg+xml' ? (
              <div
                className="h-full w-full bg-white p-4 dark:bg-zinc-900"
                dangerouslySetInnerHTML={{ __html: imgData! }}
              />
            ) : (
              <Image
                src={imgData!}
                alt={imgName ?? 'preview'}
                fill
                className="object-contain"
                priority
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              No image found — go back and upload one.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
            {dimsLabel}
          </span>
          <button
            onClick={() => setUnits(units === 'cm' ? 'in' : 'cm')}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          >
            Toggle {units === 'cm' ? 'inches' : 'centimeters'}
          </button>
          {imgName && (
            <span className="rounded-lg bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
              {imgName}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <aside className="space-y-6">
        {/* Dimensions */}
        <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-base font-semibold">Dimensions</h3>
          <div className="mt-4 space-y-4">
            {[
              { label: 'Height', value: height, setter: setHeight, min: 5, max: 120 },
              { label: 'Width', value: width, setter: setWidth, min: 5, max: 120 },
              { label: 'Depth', value: depth, setter: setDepth, min: 1, max: 60 },
            ].map(({ label, value, setter, min, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <span className="text-xs text-zinc-500">
                    {value} {units}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Material */}
        <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-base font-semibold">Material</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['plush', 'cotton', 'ceramic'] as Material[]).map((m) => (
              <button
                key={m}
                onClick={() => setMaterial(m)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  material === m
                    ? 'border-indigo-500 ring-1 ring-indigo-500'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Color */}
        <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-base font-semibold">Primary color</h3>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-md border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{color}</span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/upload"
            className="inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          >
            Back
          </Link>
          <Button
            onClick={handleContinue}
            disabled={submitting || missing}
          >
            {submitting ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </aside>
    </div>
  )
}
