/**
 * Ordenação do catálogo (Radix Select). CP9.2: arquivo próprio, carregado sob demanda: no desktop
 * pela CatalogSection e no mobile pelo drawer de filtros. Assim o Select do Radix não entra no
 * carregamento inicial do mobile, onde a ordenação fica no drawer.
 */
import { useId } from 'react'
import type { CatalogSort } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { CatalogController } from './controller'
import { SORT_LABEL } from './search'

export function SortSelect({ controller, className }: { controller: CatalogController; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-caption whitespace-nowrap text-foreground">
        Ordenar por:
      </label>
      <Select value={controller.search.sort ?? 'recent'} onValueChange={(v) => controller.setFilters({ sort: v === 'recent' ? undefined : (v as CatalogSort) })}>
        <SelectTrigger id={id} className="h-9 min-w-48 border-transparent bg-transparent px-1 text-caption hover:border-input lg:h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {(Object.keys(SORT_LABEL) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
