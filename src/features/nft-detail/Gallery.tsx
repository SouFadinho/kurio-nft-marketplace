/**
 * Galeria do NFT (Figma Desktop / Detalhes: miniaturas verticais à esquerda, imagem grande e
 * ícone de lupa; Mobile / Detalhes: imagem de largura total).
 * - Miniaturas são botões com `aria-pressed` e nome acessível.
 * - A lupa abre a imagem em um diálogo (foco preso, Esc fecha).
 * - A imagem principal é a candidata a LCP: carregamento prioritário.
 * - Mobile: indicadores "•" trocam a imagem (o Figma mostra uma só; temos 2 vistas).
 */
import { Search } from 'lucide-react'
import { useState } from 'react'
import type { NftDetail } from '@/api/contracts'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { NftImage } from '@/components/kurio/NftImage'
import { cn } from '@/lib/utils'

export function Gallery({ nft }: { nft: NftDetail }) {
  const [index, setIndex] = useState(0)
  const image = nft.gallery[index] ?? nft.gallery[0]!

  return (
    <>
      {/* ---------- Desktop ---------- */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[104px_minmax(0,1fr)]">
        <ul className="flex flex-col gap-3" aria-label="Imagens do NFT">
          {nft.gallery.map((g, i) => (
            <li key={g.src}>
              <button
                type="button"
                aria-pressed={i === index}
                aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-sm border-2 bg-surface-2 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring',
                  i === index ? 'border-primary' : 'border-transparent hover:border-border-strong',
                )}
              >
                <NftImage src={g.src} alt="" size={208} />
              </button>
            </li>
          ))}
        </ul>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-surface p-2">
          <div className="size-full overflow-hidden rounded-md bg-surface-2">
            <NftImage src={image.src} alt={image.alt} priority />
          </div>
          <Dialog>
            <DialogTrigger
              aria-label="Ampliar imagem"
              className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur-sm hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Search className="size-4" aria-hidden />
            </DialogTrigger>
            <DialogContent className="max-w-[min(92vw,720px)] p-3">
              <DialogTitle className="sr-only">{nft.name}</DialogTitle>
              <DialogDescription className="sr-only">{image.alt}</DialogDescription>
              <div className="aspect-square overflow-hidden rounded-md">
                <NftImage src={image.src} alt={image.alt} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ---------- Mobile / tablet ---------- */}
      {/* Figma: imagem com margens laterais e cantos arredondados (não em largura total). */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2 md:mx-auto md:w-full md:max-w-xl lg:hidden">
        <NftImage src={image.src} alt={image.alt} priority />
        {nft.gallery.length > 1 && (
          <div role="group" aria-label="Imagens do NFT" className="absolute inset-x-0 bottom-8 flex justify-center gap-1">
            {nft.gallery.map((g, i) => (
              <button
                key={g.src}
                type="button"
                aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className="grid size-7 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className={cn('block size-2 rounded-full bg-background/90 ring-1 ring-black/20', i === index && 'bg-primary')} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
