import { useEffect } from 'react'

export interface ToastProps {
  message: string
  type: 'success' | 'error'
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, isVisible, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
  const borderAccent = type === 'success' ? 'border-l-emerald-700' : 'border-l-red-700'

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
      <div className={`${bgColor} ${borderAccent} border-l-4 text-white rounded-lg shadow-2xl ring-1 ring-black/10 p-4 max-w-md flex items-center space-x-3`}>
        {/* Message */}
        <div className="flex-1">
          <p className="text-base font-medium whitespace-pre-line">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  )
}
