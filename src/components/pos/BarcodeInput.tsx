'use client'

import { useRef, useEffect, useCallback } from 'react'

interface BarcodeInputProps {
  onScan: (barcode: string) => void
  disabled?: boolean
}

export default function BarcodeInput({ onScan, disabled }: BarcodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)

  const focusInput = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  // Auto-refocus when input loses focus
  useEffect(() => {
    const handleFocusOut = () => {
      // Delay to allow modal inputs to take focus
      setTimeout(() => {
        const active = document.activeElement
        const isModalInput = active?.closest('.ant-modal') || active?.closest('[data-pos-input]')
        if (!isModalInput && !disabled) {
          focusInput()
        }
      }, 100)
    }

    const input = inputRef.current
    input?.addEventListener('blur', handleFocusOut)
    focusInput()

    return () => {
      input?.removeEventListener('blur', handleFocusOut)
    }
  }, [disabled, focusInput])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()

    if (e.key === 'Enter') {
      e.preventDefault()
      const code = bufferRef.current.trim()
      if (code) {
        onScan(code)
      }
      bufferRef.current = ''
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    // Reset buffer if too much time between keystrokes (manual typing vs scanner)
    if (now - lastKeyTimeRef.current > 200) {
      bufferRef.current = ''
    }
    lastKeyTimeRef.current = now

    if (e.key.length === 1) {
      bufferRef.current += e.key
    }
  }

  return (
    <input
      ref={inputRef}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      style={{
        position: 'absolute',
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
      }}
      tabIndex={-1}
      autoComplete="off"
      aria-label="Barcode scanner input"
    />
  )
}
