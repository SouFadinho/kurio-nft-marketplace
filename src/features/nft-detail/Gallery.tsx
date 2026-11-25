/**
 * Galeria do NFT (Figma Desktop / Detalhes: miniaturas verticais à esquerda, imagem grande e
 * ícone de lupa; Mobile / Detalhes: imagem de largura total).
 * - Miniaturas são botões com `aria-pressed` e nome acessível.
 * - A lupa abre a imagem em um diálogo (foco preso, Esc fecha).
 * - A imagem principal é a candidata a LCP: carregamento prioritário.
 * - Mobile: indicadores "•" trocam a imagem (o Figma mostra uma só; temos 2 vistas).
 * - CP9.2 (performance medida): cada variante só é montada no seu breakpoint, e o diálogo da
 *   lupa é carregado sob demanda (GalleryZoom) no primeiro clique.
 */
import { Search } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { NftDetail } from '@/api/contracts'
import { NftImage } from '@/components/kurio/NftImage'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

const loadZoom = () => import('./GalleryZoom')
const GalleryZoom = lazy(loadZoom)

export function Gallery({ nft, onMainImageSettled }: { nft: NftDetail; onMainImageSettled?: () => void }) {
  const [index, setIndex] = useState(0)
  const image = nft.gallery[index] ?? nft.gallery[0]!
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [zoomMounted, setZoomMounted] = useState(false)
  const zoomButton = useRef<HTMLButtonElement>(null)

  if (desktop) {
    return (
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
            <NftImage src={image.src} alt={image.alt} priority onSettled={onMainImageSettled} />
          </div>
          <button
            ref={zoomButton}
            type="button"
            aria-label="Ampliar imagem"
            aria-haspopup="dialog"
            aria-expanded={zoomOpen}
            aria-controls={zoomOpen ? 'gallery-zoom' : undefined}
            onPointerEnter={() => void loadZoom()}
            onFocus={() => void loadZoom()}
            onClick={() => {
              setZoomMounted(true)
              setZoomOpen(true)
            }}
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur-sm hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Search className="size-4" aria-hidden />
          </button>
          {zoomMounted && (
            <Suspense fallback={null}>
              <GalleryZoom open={zoomOpen} onOpenChange={setZoomOpen} name={nft.name} image={image} returnFocusTo={zoomButton} />
            </Suspense>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ---------- Mobile / tablet ---------- */}
      {/* Figma: imagem com margens laterais e cantos arredondados (não em largura total). */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2 md:mx-auto md:w-full md:max-w-xl lg:hidden">
        <NftImage src={image.src} alt={image.alt} priority onSettled={onMainImageSettled} />
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
