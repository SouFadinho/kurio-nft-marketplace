/**
 * Card de NFT (Figma: Início, "Mais desta coleção", "Colecionadores também viram").
 *
 * Composição medida nas referências: moldura escura arredondada (superfície) em volta da arte
 * quadrada, com nome e preço ABAIXO da moldura, sobre o fundo da página. Selo "RARO" no canto
 * superior esquerdo e botão de favoritar circular no canto superior direito.
 *
 * - A área clicável é o card inteiro (link esticado no nome). O favoritar fica acima, com o
 *   próprio nome acessível e `aria-pressed`.
 * - A imagem tem width/height e `aspect-square`: o espaço é reservado antes do carregamento.
 * - `NFTCardSkeleton` reproduz exatamente as mesmas dimensões.
 */
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { Nft } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NftImage } from './NftImage'
import { PriceDisplay } from './PriceDisplay'

export type NftCardData = Pick<Nft, 'id' | 'name' | 'image' | 'imageAlt' | 'price' | 'previousPrice' | 'rarity' | 'available'>

const RARITY_LABEL = { rare: 'Raro', legendary: 'Lendário' } as const

export function NFTCard({
  nft,
  favorite,
  onToggleFavorite,
  favoritePending = false,
  priority = false,
  className,
}: {
  nft: NftCardData
  /** undefined = não exibe o botão (ex.: visitante). */
  favorite?: boolean
  onToggleFavorite?: (next: boolean) => void
  favoritePending?: boolean
  /** Primeira dobra: carrega com prioridade (LCP). */
  priority?: boolean
  className?: string
}) {
  const soldOut = nft.available === 0
  return (
    <article className={cn('group relative flex flex-col gap-2', className)} data-testid="nft-card" data-nft-id={nft.id}>
      <div className="relative rounded-xl bg-surface p-1.5 pb-5 transition-colors duration-[var(--duration-base)] group-hover:bg-surface-2 lg:rounded-lg lg:pb-3">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-2 lg:rounded-md">
          <NftImage
            src={nft.image}
            alt={nft.imageAlt}
            priority={priority}
            className={cn(
              'transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)] motion-safe:group-hover:scale-[1.03]',
              soldOut && 'opacity-60 grayscale-[35%]',
            )}
          />
          {nft.rarity !== 'common' && (
            <Badge variant="rare" className="absolute top-0 left-0 rounded-none rounded-br-sm px-3.5 py-1.5 text-caption">
              {RARITY_LABEL[nft.rarity]}
            </Badge>
          )}
          {soldOut && (
            <Badge variant="neutral" className="absolute bottom-2 left-2 bg-background/85 text-foreground">
              Esgotado
            </Badge>
          )}
        </div>
        {favorite !== undefined && onToggleFavorite && (
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            disabled={favoritePending}
            onClick={() => onToggleFavorite(!favorite)}
            className={cn(
              "absolute top-3 right-3 z-10 grid size-7 place-items-center rounded-full bg-surface-2/90 transition-colors after:absolute after:-inset-2 after:content-['']",
              'hover:bg-surface-3 hover:text-foreground disabled:opacity-60 outline-none focus-visible:outline-2 focus-visible:outline-ring',
              favorite ? 'text-price' : 'text-muted-foreground',
            )}
          >
            <Heart className="size-3.5" fill={favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        <h3 className="truncate text-title-3 font-normal text-foreground">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {nft.name}
          </Link>
        </h3>
        <PriceDisplay value={nft.price} previous={nft.previousPrice ?? undefined} label="Preço" />
      </div>
    </article>
  )
}

/** Mesmas dimensões do NFTCard; decorativo (o contêiner da lista anuncia o carregamento). */
export function NFTCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true" data-testid="nft-card-skeleton">
      <div className="rounded-xl bg-surface p-1.5 pb-5 lg:rounded-lg lg:pb-3">
        <Skeleton className="aspect-square w-full rounded-lg lg:rounded-md" />
      </div>
      {/* Alturas iguais às linhas reais do card (título 15px×1.4; preço 14px×1.6): sem CLS. */}
      <div className="flex flex-col gap-0.5 px-1">
        <div className="flex h-[1.3125rem] items-center">
          <Skeleton className="h-3.5 w-3/4 rounded-xs" />
        </div>
        <div className="flex h-[1.4rem] items-center">
          <Skeleton className="h-3.5 w-1/3 rounded-xs" />
        </div>
      </div>
    </div>
  )
}
