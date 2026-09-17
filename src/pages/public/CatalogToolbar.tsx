import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type Props = {
  search: string
  onSearchChange: (v: string) => void
  category: string
  onCategoryChange: (v: string) => void
  categories: string[]
  maxPrice: string
  onMaxPriceChange: (v: string) => void
}

export function CatalogToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  maxPrice,
  onMaxPriceChange,
}: Props) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/15 bg-slate-900/50 p-4 shadow-xl backdrop-blur-md [&_label>span]:text-slate-200 sm:grid-cols-3 sm:p-5">
      <Input
        label="Search"
        placeholder="Search by title…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border-white/20 bg-slate-950/55 text-slate-100 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-500/30"
      />
      <Select
        label="Category"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="border-white/20 bg-slate-950/55 text-slate-100 focus:border-sky-400 focus:ring-sky-500/30"
      >
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        label="Max price"
        type="number"
        min={0}
        placeholder="No limit"
        value={maxPrice}
        onChange={(e) => onMaxPriceChange(e.target.value)}
        className="border-white/20 bg-slate-950/55 text-slate-100 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-500/30"
      />
    </div>
  )
}
