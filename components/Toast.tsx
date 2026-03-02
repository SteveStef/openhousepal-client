import { useEffect } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

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

  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      border: 'border-emerald-500/30',
      bg: 'bg-white dark:bg-[#1A1A1A]',
      accent: 'bg-emerald-500',
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      border: 'border-red-500/30',
      bg: 'bg-white dark:bg-[#1A1A1A]',
      accent: 'bg-red-500',
    }
  }

  const { icon, border, bg, accent } = config[type]

  return (
    <div className="fixed bottom-8 right-8 z-[100] animate-slide-in-right">
      <div className={`
        ${bg} ${border}
        border px-5 py-4 rounded-2xl shadow-2xl 
        min-w-[320px] max-w-md flex items-center gap-4
        ring-1 ring-black/5 dark:ring-white/5
      `}>
        {/* Left Status Accent Bar */}
        <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full ${accent}`} />

        {/* Icon Container */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* Message Content */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
            {type === 'success' ? 'Success' : 'Attention'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-medium whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
