'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  variant?: 'default' | 'primary' | 'small'
  className?: string
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (variant === 'primary') {
    return (
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 rounded-[13px] px-5 py-4 text-sm font-extrabold text-white transition-all ${className}`}
        style={{
          background: copied
            ? 'linear-gradient(135deg, #8b5cf6, #7C3AED)'
            : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 55%, #22D3EE 100%)',
          boxShadow: copied
            ? '0 4px 22px rgba(139,92,246,.35)'
            : '0 4px 22px rgba(16, 185, 129,.35)',
          animation: copied ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
          letterSpacing: '-0.01em',
        }}
      >
        {copied ? '✅ Copied!' : `📋 ${label}`}
      </button>
    )
  }

  if (variant === 'small') {
    return (
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${className}`}
        style={{
          background: copied ? 'rgba(139,92,246,.09)' : 'rgba(16, 185, 129,.07)',
          border: copied ? '1px solid rgba(139,92,246,.22)' : '1px solid rgba(16, 185, 129,.18)',
          color: copied ? '#a78bfa' : 'var(--indigo-light)',
        }}
      >
        {copied ? '✅' : '📋'} {copied ? 'Copied' : 'Copy'}
      </button>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${className}`}
      style={{
        background: copied ? 'rgba(139,92,246,.09)' : 'rgba(16, 185, 129,.07)',
        border: copied ? '1px solid rgba(139,92,246,.22)' : '1px solid rgba(16, 185, 129,.18)',
        color: copied ? '#a78bfa' : 'var(--indigo-light)',
      }}
    >
      {copied ? '✅' : '📋'} {copied ? 'Copied!' : label}
    </button>
  )
}
