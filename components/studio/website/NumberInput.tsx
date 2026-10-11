'use client'

// Comma-formatted number entry for price/sqft-style editor fields ("1500000" -> "1,500,000" as
// you type) - the underlying stored value is always plain digits (what the backend's `_as_int`
// parser and every price-field placeholder already expect), commas are display-only.
export default function NumberInput({
  value, onChange, placeholder, className,
}: {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
}) {
  const digits = (value || '').replace(/[^0-9]/g, '')
  const display = digits ? Number(digits).toLocaleString('en-US') : ''
  return (
    <input
      value={display}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder={placeholder}
      inputMode="numeric"
      className={className}
    />
  )
}
