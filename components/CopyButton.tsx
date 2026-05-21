'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  variant?: 'default' | 'primary' | 'small'
  className?: string
}

// Push #162 — inline SVG icons (clipboard / check) replace the emoji
// glyphs so the icons render consistently across platforms, animate a
// quick pop on success, and the live state is announced to screen
// readers via aria-live.
function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'fadeIn 0.2s ease' }}
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CopyButton({
  text,
  label = 'Copy',
  variant = 'default',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for browsers/contexts where the async clipboard API is blocked
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Announce the result to assistive tech without changing the visible label.
  const srStatus = (
    <span
      aria-live="polite"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {copied ? 'Copied to clipboard' : ''}
    </span>
  )

  if (variant === 'primary') {
    return (
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 rounded-[13px] px-5 py-4 text-sm font-extrabold text-white transition-all ${className}`}
        style={{
          background: copied
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #22D3EE 100%)',
          boxShadow: copied
            ? '0 4px 22px rgba(16,185,129,.35)'
            : '0 4px 22px rgba(59, 130, 246,.35)',
          animation: copied ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
          letterSpacing: '-0.01em',
          transform: copied ? 'scale(0.98)' : 'scale(1)',
        }}
      >
        {srStatus}
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        {copied ? 'Copied!' : label}
      </button>
    )
  }

  if (variant === 'small') {
    return (
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${className}`}
        style={{
          background: copied ? 'rgba(16,185,129,.09)' : 'rgba(59, 130, 246,.07)',
          border: copied ? '1px solid rgba(16,185,129,.22)' : '1px solid rgba(59, 130, 246,.18)',
          color: copied ? '#34d399' : 'var(--indigo-light)',
        }}
      >
        {srStatus}
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${className}`}
      style={{
        background: copied ? 'rgba(16,185,129,.09)' : 'rgba(59, 130, 246,.07)',
        border: copied ? '1px solid rgba(16,185,129,.22)' : '1px solid rgba(59, 130, 246,.18)',
        color: copied ? '#34d399' : 'var(--indigo-light)',
      }}
    >
      {srStatus}
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : label}
    </button>
  )
}
