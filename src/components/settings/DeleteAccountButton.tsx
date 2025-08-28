'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'

export default function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE'

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting])

  // Autofocus input when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const submitDeletion = () => {
    if (!canDelete || submitting) return
    setSubmitting(true)
    // Submit a real form so the server redirect works normally
    formRef.current?.submit()
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
      >
        Delete account
      </Button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 id="delete-title" className="text-lg font-semibold text-red-600 dark:text-red-400">
              Delete account
            </h2>
            <p id="delete-desc" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This action is permanent and will delete your profile and all designs.
              To confirm, please type <span className="font-mono font-semibold">DELETE</span> below.
            </p>

            <input
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-zinc-700 dark:bg-transparent"
              disabled={submitting}
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                className="border border-zinc-300 dark:border-zinc-700"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={submitDeletion}
                disabled={!canDelete || submitting}
                className={`${
                  canDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600/60'
                } text-white dark:bg-red-600 dark:hover:bg-red-700`}
              >
                {submitting ? 'Deleting…' : 'Delete account'}
              </Button>
            </div>

            {/* Real form (hidden) so server redirect works */}
            <form
              ref={formRef}
              action="/api/account/delete"
              method="post"
              className="hidden"
            />
          </div>
        </div>
      )}
    </>
  )
}
