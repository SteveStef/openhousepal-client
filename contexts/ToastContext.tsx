'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
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
