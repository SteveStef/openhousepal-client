import { OhpHouse, OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'

// Dev-only proof sheet for the logo + loader.
export default function BrandProof() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-end gap-8 rounded-2xl bg-white p-8 text-[#111827]">
        <OhpWordmark animate className="text-6xl" />
        <OhpWordmark className="text-xl" />
        <OhpHouse animate className="h-16" />
        <OhpHouse className="h-6" />
      </div>
      <div className="dark flex flex-wrap items-end gap-8 rounded-2xl bg-[#0B0B0B] p-8 text-white">
        <OhpWordmark animate className="text-5xl" />
        <OhpHouse className="h-12" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="overflow-hidden rounded-2xl border"><OhpLoader fullScreen={false} label="Loading your leads" /></div>
        <div className="dark overflow-hidden rounded-2xl bg-[#0B0B0B]"><OhpLoader fullScreen={false} /></div>
      </div>
    </div>
  )
}
