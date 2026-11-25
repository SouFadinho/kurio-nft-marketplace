/**
 * Imagem ampliada do NFT (diálogo da lupa da galeria desktop).
 *
 * CP9.2 (performance medida): carregado e montado só no primeiro clique na lupa. Antes, o
 * Dialog do Radix (com focus-scope e react-remove-scroll) entrava no caminho crítico do detalhe
 * só para existir fechado. Foco preso e Esc vêm do Radix Dialog; ao fechar, o foco volta à lupa.
 */
import type { RefObject } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NftImage } from '@/components/kurio/NftImage'

export default function GalleryZoom({
  open,
  onOpenChange,
  name,
  image,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  image: { src: string; alt: string }
  returnFocusTo: RefObject<HTMLButtonElement | null>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="gallery-zoom"
        className="max-w-[min(92vw,720px)] p-3"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusTo.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <DialogDescription className="sr-only">{image.alt}</DialogDescription>
        <div className="aspect-square overflow-hidden rounded-md">
          <NftImage src={image.src} alt={image.alt} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
