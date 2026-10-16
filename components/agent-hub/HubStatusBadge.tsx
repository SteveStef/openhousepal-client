import { formatSaleStatus, getSaleStatusClass } from '@/lib/agentSales'

// The status on a hub home photo. Sold is always the matte red tablet with its breathing dot
// (app/globals.css .hub-lx-sold - on Classic and Luxe alike); everything else keeps its color pill.
export default function HubStatusBadge({ status, size = 'sm', className = '' }: {
  /** Raw MLS status ("Closed", "ACTIVE-BRIGHT", "Sold"...) - formatted here. */
  status?: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const label = formatSaleStatus(status)
  const sold = label === 'Sold'
  const box = sold
    ? (size === 'md' ? 'rounded-[10px] px-3.5 py-2 text-[11px]' : size === 'sm' ? 'rounded-[9px] px-3 py-1.5 text-[10px]' : 'rounded-[8px] px-2.5 py-1 text-[9px]')
    : (size === 'md' ? 'rounded-full px-3 py-1 text-[11px]' : size === 'sm' ? 'rounded-full px-2.5 py-1 text-[10px]' : 'rounded-full px-2 py-0.5 text-[9px]')
  const color = sold ? 'hub-lx-sold' : `${label === 'Active' ? 'bg-emerald-500 text-white' : getSaleStatusClass(status)} shadow`
  return (
    <span className={`inline-flex shrink-0 items-center font-black uppercase tracking-wide ${box} ${color} ${className}`}>
      {sold && <span className="hub-lx-sold-dot" />}<span className="relative">{label}</span>
    </span>
  )
}
