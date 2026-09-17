import { AccessoryCatalog } from '@/components/catalog/AccessoryCatalog'
import '@/styles/bikebuddyCustomerArea.css'

export function AccessoriesPage() {
  return (
    <div className="relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-gradient-to-b from-slate-950/75 via-slate-950/70 to-slate-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(59,130,246,0.25),transparent_60%)]" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        <AccessoryCatalog />
      </div>
    </div>
  )
}
