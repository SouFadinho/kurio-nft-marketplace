/**
 * Barra superior do catálogo no MOBILE/TABLET (Figma Mobile / Início): busca
 * "Explorar coleções" + botão de filtros laranja. Os filtros e a ordenação abrem num drawer
 * (Drawer do shadcn/vaul com foco preso, Esc fecha e o foco volta ao botão).
 */
import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { NftList } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { CatalogSearchField } from './CatalogSearchField'
import type { CatalogController } from './controller'
import { FiltersPanel } from './FiltersPanel'
import { SortSelect } from './CatalogSection'

export function MobileCatalogBar({ controller, data, className }: { controller: CatalogController; data: NftList | undefined; className?: string }) {
  const [open, setOpen] = useState(false)
  const s = controller.search
  const activeCount = [s.category, s.network, s.minPrice ?? s.maxPrice].filter(Boolean).length

  return (
    <div className={cn('flex items-center gap-3 lg:hidden', className)}>
      <CatalogSearchField controller={controller} className="min-w-0 flex-1" />
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="default"
            size="icon-lg"
            className="relative size-12 shrink-0 rounded-lg bg-primary-gradient"
            aria-label={activeCount > 0 ? `Filtros e ordenação (${activeCount} ativos)` : 'Filtros e ordenação'}
          >
            <SlidersHorizontal aria-hidden />
            {activeCount > 0 && (
              <Badge variant="count" className="absolute -top-1 -right-1 border-2 border-background" aria-hidden>
                {activeCount}
              </Badge>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Coleções, faixa de preço, rede e ordenação.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-2">
            <SortSelect controller={controller} className="justify-between" />
            <FiltersPanel data={data} controller={controller} onApplied={() => setOpen(false)} />
          </div>
          <DrawerFooter className="flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => (controller.clearAll(), setOpen(false))}>
              Limpar filtros
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Ver resultados
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
