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
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #22D3EE 100%)',
          boxShadow: copied
            ? '0 4px 22px rgba(16,185,129,.35)'
            : '0 4px 22px rgba(59, 130, 246,.35)',
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
          background: copied ? 'rgba(16,185,129,.09)' : 'rgba(59, 130, 246,.07)',
          border: copied ? '1px solid rgba(16,185,129,.22)' : '1px solid rgba(59, 130, 246,.18)',
          color: copied ? '#34d399' : 'var(--indigo-light)',
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
        background: copied ? 'rgba(16,185,129,.09)' : 'rgba(59, 130, 246,.07)',
        border: copied ? '1px solid rgba(16,185,129,.22)' : '1px solid rgba(59, 130, 246,.18)',
        color: copied ? '#34d399' : 'var(--indigo-light)',
      }}
    >
      {copied ? '✅' : '📋'} {copied ? 'Copied!' : label}
    </button>
  )
}
