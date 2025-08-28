'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui'

type Props = { userId: string }

const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export default function UploadClient({ userId }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ w: number; h: number } | null>(null)

  const reset = () => {
    setFile(null)
    setPreviewUrl(null)
    setError(null)
    setMeta(null)
    if (inputRef.current) inputRef.current.value = ''
    // clear session storage too
    sessionStorage.removeItem('upload:current:name')
    sessionStorage.removeItem('upload:current:type')
    sessionStorage.removeItem('upload:current:data')
  }

  const validate = useCallback((f: File) => {
    if (!ACCEPT.includes(f.type)) {
      return 'Please upload PNG, JPG, or SVG.'
    }
    if (f.size > MAX_BYTES) {
      return 'File too large. Max 10MB.'
    }
    return null
  }, [])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files[0]) return
      const f = files[0]
      const msg = validate(f)
      if (msg) {
        setError(msg)
        return
      }
      setError(null)
      setFile(f)

      // Save to sessionStorage so RefineClient can use it later
      const reader = new FileReader()
      reader.onloadend = () => {
        sessionStorage.setItem('upload:current:name', f.name)
        sessionStorage.setItem('upload:current:type', f.type)
        sessionStorage.setItem('upload:current:data', reader.result as string)
      }
      reader.readAsDataURL(f)

      if (f.type === 'image/svg+xml') {
        const url = URL.createObjectURL(f)
        setPreviewUrl(url)
        setMeta(null)
      } else {
        const url = URL.createObjectURL(f)
        setPreviewUrl(url)
        const img = new window.Image()
        img.onload = () => {
          setMeta({ w: img.width, h: img.height })
        }
        img.src = url
      }
    },
    [validate]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const choose = () => inputRef.current?.click()

  const canContinue = useMemo(() => !!file, [file])

  return (
    <div className="grid gap-8 md:grid-cols-5">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="md:col-span-3 rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"
      >
        {!previewUrl ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <div className="rounded-xl bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
              PNG • JPG • SVG • up to 10MB
            </div>
            <p className="text-lg font-medium">Drag & drop your image here</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">or</p>
            <Button onClick={choose}>Choose file</Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(',')}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative h-[420px] w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              {file?.type === 'image/svg+xml' ? (
                <object data={previewUrl} type="image/svg+xml" className="h-full w-full" />
              ) : (
                <Image
                  src={previewUrl}
                  alt={file?.name || 'preview'}
                  fill
                  className="object-contain"
                  priority
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-lg bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {file?.name}
              </span>
              {meta && (
                <span className="rounded-lg bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                  {meta.w} × {meta.h}px
                </span>
              )}
              <span className="rounded-lg bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {(file!.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="md:col-span-2 space-y-4">
        <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-base font-semibold">Tips for best results</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Use a clear subject on a plain background.</li>
            <li>Front view is ideal for plush & apparel.</li>
            <li>High resolution helps with edge detection.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-base font-semibold">Next step</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Once your image is ready, continue to refine dimensions & materials.
          </p>

          <div className="mt-4 flex gap-3">
            <Button onClick={choose} variant="ghost" className="border border-zinc-300 dark:border-zinc-700">
              Choose another
            </Button>

            {canContinue ? (
              <Link
                href="/upload/refine"
                className="inline-flex rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
              >
                Continue
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex cursor-not-allowed rounded-xl bg-zinc-200 px-4 py-2 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
