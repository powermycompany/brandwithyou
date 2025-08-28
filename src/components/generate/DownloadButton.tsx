'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

type Props = {
  url: string
  filename?: string
}

export default function DownloadButton({ url, filename }: Props) {
  const [downloading, setDownloading] = useState(false)

  const deriveName = () => {
    if (filename) return filename
    try {
      const u = new URL(url)
      const base = u.pathname.split('/').pop() || 'design'
      return base
    } catch {
      return 'design'
    }
  }

  const onDownload = async () => {
    try {
      setDownloading(true)
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error('Failed to fetch file')
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = deriveName()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      console.error(e)
      // (optional) show a toast here
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button onClick={onDownload} disabled={downloading}>
      {downloading ? 'Downloading…' : 'Download image'}
    </Button>
  )
}
