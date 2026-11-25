/**
 * Drawer de filtros e ordenação do catálogo no MOBILE/TABLET (Figma Mobile / Início).
 *
 * CP9.2 (performance medida): carregado sob demanda pela MobileCatalogBar no primeiro clique.
 * Montado fechado, o vaul lia `window.scrollY` no efeito de montagem e forçava um layout síncrono
 * da página inteira antes da primeira pintura; o chunk (vaul + Select + Slider) também saía do
 * caminho crítico do mobile. Foco preso e Esc vêm do Radix Dialog; ao fechar, o foco volta ao
 * botão que abriu (`returnFocusTo`).
 */
import type { RefObject } from 'react'
import type { NftList } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { CatalogController } from './controller'
import { FiltersPanel } from './FiltersPanel'
import { SortSelect } from './CatalogSection'

export default function FiltersDrawer({
  open,
  onOpenChange,
  controller,
  data,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  controller: CatalogController
  data: NftList | undefined
  returnFocusTo: RefObject<HTMLButtonElement | null>
}) {
  const close = () => onOpenChange(false)
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        id="catalog-filters-drawer"
        className="max-h-[88dvh]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusTo.current?.focus()
        }}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtros</DrawerTitle>
          <DrawerDescription>Coleções, faixa de preço, rede e ordenação.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-2">
          <SortSelect controller={controller} className="justify-between" />
          <FiltersPanel data={data} controller={controller} onApplied={close} />
        </div>
        <DrawerFooter className="flex-row">
          <Button variant="secondary" className="flex-1" onClick={() => (controller.clearAll(), close())}>
            Limpar filtros
          </Button>
          <Button className="flex-1" onClick={close}>
            Ver resultados
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
