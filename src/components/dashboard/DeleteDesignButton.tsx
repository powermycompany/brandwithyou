'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

export default function DeleteDesignButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return

    setLoading(true)
    const res = await fetch(`/api/designs/${id}/delete`, { method: 'POST' })
    setLoading(false)

    if (res.ok) {
      router.push('/dashboard') // Redirect after delete
      router.refresh()          // Refresh data
    } else {
      const { error } = await res.json()
      alert(`Error deleting: ${error || 'Unknown error'}`)
    }
  }

  return (
    <Button
      onClick={handleDelete}
      disabled={loading}
      variant="destructive"
    >
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
