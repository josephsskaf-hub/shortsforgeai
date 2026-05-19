'use client'

// Global toast notification system.
//
// Usage from anywhere in the client tree:
//
//   import { showToast } from '@/components/Toast'
//   showToast('Link copied!', 'success')
//
// Implementation is event-based (window.dispatchEvent) so callers don't have
// to import a context or pass a setter prop through the tree. The <ToastHost />
// component listens once and renders the stack into the root layout.

import { useEffect, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
  leaving?: boolean
}

const TOAST_EVENT = 'sfa:toast'
const DEFAULT_DURATION_MS = 2400
const LEAVE_ANIM_MS = 220

interface ToastDetail {
  message: string
  kind?: ToastKind
  durationMs?: number
}

export function showToast(
  message: string,
  kind: ToastKind = 'info',
  durationMs: number = DEFAULT_DURATION_MS,
): void {
  if (typeof window === 'undefined') return
  const detail: ToastDetail = { message, kind, durationMs }
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail }))
}

function iconFor(kind: ToastKind): string {
  if (kind === 'success') return '✅'
  if (kind === 'error') return '⚠️'
  return '💡'
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail
      if (!detail || !detail.message) return
      const id = ++counterRef.current
      const kind = detail.kind ?? 'info'
      const duration = Math.max(800, detail.durationMs ?? DEFAULT_DURATION_MS)
      setItems((prev) => [...prev, { id, message: detail.message, kind }])

      const removeAt = duration
      const leaveAt = duration - LEAVE_ANIM_MS

      window.setTimeout(() => {
        setItems((prev) =>
          prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
        )
      }, Math.max(0, leaveAt))

      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, removeAt)
    }
    window.addEventListener(TOAST_EVENT, onToast as EventListener)
    return () => window.removeEventListener(TOAST_EVENT, onToast as EventListener)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast toast--${t.kind}${t.leaving ? ' leaving' : ''}`}
        >
          <span className="toast__icon" aria-hidden="true">
            {iconFor(t.kind)}
          </span>
          <span className="toast__msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
