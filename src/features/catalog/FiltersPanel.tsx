/**
 * Painel de filtros (Figma Desktop / Início, barra lateral): "Coleções" com contagem,
 * "Faixa de preço" (slider + "Aplicar") e "Rede" com contagem.
 * O mesmo componente é usado na barra lateral desktop e no drawer mobile.
 *
 * - Contagens vêm da API (facetas calculadas com os DEMAIS filtros aplicados).
 * - Seleção é single-select com alternância (clicar de novo remove), refletida na URL.
 * - Itens selecionados: cor + `aria-pressed` + marcador visual (não depende só de cor).
 */
import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import type { CategoryId, Network, NftList } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { CatalogController } from './controller'

function FacetList<T extends string>({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string
  items: Array<{ id: string; label: string; count: number }>
  selected: T | undefined
  onSelect: (id: T | undefined) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-caption font-bold text-foreground">{title}</legend>
      <ul className="flex flex-col">
        {items.map((item) => {
          const active = selected === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? undefined : (item.id as T))}
                className={cn(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-xs px-2 text-left text-caption transition-colors lg:min-h-8',
                  'outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring',
                  active ? 'font-semibold text-price' : 'text-muted-foreground',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {active && <Check className="size-3.5" aria-hidden />}
                  {item.label}
                </span>
                <span className="tabular-nums" aria-label={`${item.count} NFTs`}>
                  ({item.count})
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

const toNumber = (v: string | undefined, fallback: number) => (v === undefined ? fallback : Number(v))

export function FiltersPanel({
  data,
  controller,
  onApplied,
  className,
}: {
  data: NftList | undefined
  controller: CatalogController
  /** Chamado após aplicar (o drawer mobile fecha). */
  onApplied?: () => void
  className?: string
}) {
  const { search, setFilters } = controller
  const priceLabelId = useId()
  const boundsMax = data ? Math.ceil(Number(data.priceBounds.max) * 10) / 10 : 12.3
  const boundsMin = 0
  const [range, setRange] = useState<number[]>([toNumber(search.minPrice, boundsMin), toNumber(search.maxPrice, boundsMax)])

  // Sincroniza o slider quando a URL muda (voltar/avançar, limpar filtros): ajuste de estado
  // durante o render, padrão recomendado pelo React (sem effect + setState).
  const urlKey = `${search.minPrice ?? ""}|${search.maxPrice ?? ""}|${boundsMax}`
  const [syncedKey, setSyncedKey] = useState(urlKey)
  if (urlKey !== syncedKey) {
    setSyncedKey(urlKey)
    setRange([toNumber(search.minPrice, boundsMin), toNumber(search.maxPrice, boundsMax)])
  }

  const applyPrice = () => {
    const [min = boundsMin, max = boundsMax] = range
    setFilters({
      minPrice: min > boundsMin ? min.toFixed(2) : undefined,
      maxPrice: max < boundsMax ? max.toFixed(2) : undefined,
    })
    onApplied?.()
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} data-testid="filters-panel">
      <FacetList<CategoryId>
        title="Coleções"
        items={data?.facets.categories ?? []}
        selected={search.category}
        onSelect={(category) => {
          setFilters({ category })
          onApplied?.()
        }}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-caption font-bold text-foreground" id={priceLabelId}>
          Faixa de preço
        </legend>
        <Slider
          aria-labelledby={priceLabelId}
          min={boundsMin}
          max={boundsMax}
          step={0.01}
          value={range}
          onValueChange={setRange}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
        />
        <p className="text-caption text-muted-foreground" aria-live="polite">
          Preço: {range[0]?.toFixed(2)} – {range[1]?.toFixed(2)} ETH
        </p>
        <Button size="sm" className="w-fit" onClick={applyPrice}>
          Aplicar
        </Button>
      </fieldset>
      <FacetList<Network>
        title="Rede"
        items={data?.facets.networks ?? []}
        selected={search.network}
        onSelect={(network) => {
          setFilters({ network })
          onApplied?.()
        }}
      />
    </div>
  )
}
