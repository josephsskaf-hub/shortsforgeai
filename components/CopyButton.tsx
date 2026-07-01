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
          background: copied ? '#2997ff' : '#f5f5f7',
          color: copied ? '#fff' : '#000',
          boxShadow: copied
            ? '0 4px 22px rgba(41,151,255,.35)'
            : '0 4px 22px rgba(255,255,255,.12)',
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
          background: copied ? 'rgba(41,151,255,.12)' : '#1d1d1f',
          border: copied ? '1px solid rgba(41,151,255,.35)' : '1px solid #2a2a2d',
          color: copied ? '#2997ff' : '#f5f5f7',
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
        background: copied ? 'rgba(41,151,255,.12)' : '#1d1d1f',
        border: copied ? '1px solid rgba(41,151,255,.35)' : '1px solid #2a2a2d',
        color: copied ? '#2997ff' : '#f5f5f7',
      }}
    >
      {copied ? '✅' : '📋'} {copied ? 'Copied!' : label}
    </button>
  )
}
