'use client'

import { useEffect } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'

export type ToastType = 'success' | 'error'

export interface ToastState {
  message: string
  type: ToastType
  id: number
}

interface ToastProps {
  toast: ToastState | null
  onDismiss: () => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 2800)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed top-14 inset-x-4 z-[100] flex justify-center pointer-events-none animate-slide-up">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium max-w-xs w-full ${
          toast.type === 'success'
            ? 'bg-navy text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        {toast.type === 'success'
          ? <CheckCircle size={16} className="text-gold flex-shrink-0" />
          : <AlertCircle size={16} className="text-white flex-shrink-0" />
        }
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
