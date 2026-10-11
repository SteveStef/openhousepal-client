'use client'

// A plain <select> of fixed 30-minute slots - replaces native <input type="time"> for start/end
// time fields. A native time input lets typed digits bypass both its `step` and `max` attributes
// (e.g. typing "1:34 AM" straight past a computed 5-hour cap), which is how a request for
// "11:34 PM - 1:34 AM" was able to get created in the first place. A <select> can only ever hold
// one of the options actually offered, so that class of bug isn't reachable here.
export default function TimeSelect({
  value,
  onChange,
  options,
  placeholder = 'Time',
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
