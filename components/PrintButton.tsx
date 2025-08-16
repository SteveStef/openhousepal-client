'use client'

interface PrintButtonProps {
  className?: string
  children: React.ReactNode
}

export default function PrintButton({ className = '', children }: PrintButtonProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className={className}
    >
      {children}
    </button>
  )
}