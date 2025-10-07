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

  const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50'
  const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200'
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800'
  const iconBgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100'
  const iconColor = type === 'success' ? 'text-green-600' : 'text-red-600'

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
      <div className={`${bgColor} ${borderColor} ${textColor} border rounded-lg shadow-lg p-4 max-w-md flex items-start space-x-3`}>
        {/* Icon */}
        <div className={`${iconBgColor} rounded-full p-2 flex-shrink-0`}>
          {type === 'success' ? (
            <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          ) : (
            <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          )}
        </div>

        {/* Message */}
        <div className="flex-1 pt-0.5">
          <p className="text-sm font-medium whitespace-pre-line">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className={`${textColor} hover:${textColor}/80 transition-colors flex-shrink-0`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  )
}
