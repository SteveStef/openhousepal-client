'use client'

export default function MoneyInput({ value, onChange, placeholder = '0', className = '' }: {
  value?: number | null, onChange: (v: number | null) => void, placeholder?: string, className?: string,
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value != null ? value.toLocaleString('en-US') : ''}
        onChange={e => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits ? Number(digits) : null)
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-6 pr-3 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/30 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
      />
    </div>
  )
}
