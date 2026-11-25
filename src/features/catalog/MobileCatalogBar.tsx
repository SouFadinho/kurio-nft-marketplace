/**
 * Barra superior do catálogo no MOBILE/TABLET (Figma Mobile / Início): busca
 * "Explorar coleções" + botão de filtros laranja. Os filtros e a ordenação abrem num drawer
 * (Drawer do shadcn/vaul com foco preso, Esc fecha e o foco volta ao botão).
 *
 * CP9.2 (performance medida): o drawer é carregado e montado só no primeiro clique
 * (`FiltersDrawer`, import dinâmico; pré-carregado ao passar o ponteiro ou focar o botão).
 */
import { SlidersHorizontal } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { NftList } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { CatalogSearchField } from './CatalogSearchField'
import type { CatalogController } from './controller'

const loadFiltersDrawer = () => import('./FiltersDrawer')
const FiltersDrawer = lazy(loadFiltersDrawer)

export function MobileCatalogBar({ controller, data, className }: { controller: CatalogController; data: NftList | undefined; className?: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const s = controller.search
  const activeCount = [s.category, s.network, s.minPrice ?? s.maxPrice].filter(Boolean).length
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const preload = () => void loadFiltersDrawer()
  // CP9.2: no desktop a barra não é montada (filtros e ordenação ficam na barra lateral).
  if (desktop) return null

  return (
    <div className={cn('flex items-center gap-3 lg:hidden', className)}>
      <CatalogSearchField controller={controller} className="min-w-0 flex-1" />
      <Button
        ref={trigger}
        type="button"
        variant="default"
        size="icon-lg"
        className="relative size-12 shrink-0 rounded-lg bg-primary-gradient"
        aria-label={activeCount > 0 ? `Filtros e ordenação (${activeCount} ativos)` : 'Filtros e ordenação'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'catalog-filters-drawer' : undefined}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => {
          setMounted(true)
          setOpen(true)
        }}
      >
        <SlidersHorizontal aria-hidden />
        {activeCount > 0 && (
          <Badge variant="count" className="absolute -top-1 -right-1 border-2 border-background" aria-hidden>
            {activeCount}
          </Badge>
        )}
      </Button>
      {mounted && (
        <Suspense fallback={null}>
          <FiltersDrawer open={open} onOpenChange={setOpen} controller={controller} data={data} returnFocusTo={trigger} />
        </Suspense>
      )}
    </div>
  )
}
