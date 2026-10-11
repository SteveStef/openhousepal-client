'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import Toast from '@/components/Toast'

type ToastType = 'success' | 'error'

interface ToastState {
  message: string
  type: ToastType
  isVisible: boolean
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_EVENT = 'ohp-toast'

/** Show a toast from anywhere - plain helpers and small editors that don't hold the hook (e.g. an
 * upload that failed). Picked up by the ToastProvider below. */
export function notify(message: string, type: ToastType = 'error') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }))
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    isVisible: false,
  })

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({
      message,
      type,
      isVisible: true,
    })
  }, [])

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }))
  }, [])

  useEffect(() => {
    const onNotify = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail || {}
      if (message) showToast(message, type || 'error')
    }
    window.addEventListener(TOAST_EVENT, onNotify)
    return () => window.removeEventListener(TOAST_EVENT, onNotify)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
