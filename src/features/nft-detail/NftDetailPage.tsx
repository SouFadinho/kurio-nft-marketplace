/**
 * Detalhes do NFT (TELA-02). Figma Desktop / Detalhes e Mobile / Detalhes.
 *
 * DESKTOP: trilha "Início / Mercado / <nome>"; galeria (miniaturas + imagem grande) e, à
 * direita, nome, preço, estrelas, "Sobre este NFT", edições, quantidade, ações ("Comprar",
 * carrinho, "Favoritar"), ID do token, coleção, atributos e compartilhamento. Abaixo, abas
 * "Detalhes do NFT | Avaliações de colecionadores (N)" e "Mais desta coleção".
 * MOBILE: imagem de largura total com "voltar" e "favoritar" sobrepostos; painel de
 * superfície arredondado; barra inferior FIXA com "Qtd.", preço, "Comprar NFT" e carrinho.
 *
 * Tempo real: preço e estoque chegam por `nft.updated` (socket.io-client) e atualizam o
 * cache; esta tela reage ao cache, limita a quantidade ao estoque da edição e anuncia a
 * mudança em uma região `aria-live`.
 */
import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Link2, ShoppingCart } from 'lucide-react'
import { toast } from '@/lib/toast'
import type { NftDetail } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Container, UnavailableAction } from '@/components/kurio/basics'
import { FacebookIcon, XSocialIcon } from '@/components/icons/brand'
import { NetworkBadge } from '@/components/kurio/NetworkBadge'
import { NFTCard, NFTCardSkeleton } from '@/components/kurio/NFTCard'
import { PriceDisplay } from '@/components/kurio/PriceDisplay'
import { QuantitySelector } from '@/components/kurio/QuantitySelector'
import { RatingStars } from '@/components/kurio/RatingStars'
import { SectionHeading } from '@/components/kurio/SectionHeading'
import { useCartActions } from '@/features/cart/actions'
import { useFavoriteAction } from '@/features/favorites/queries'
import { nftDetailQuery, nftListQuery } from '@/features/nfts/queries'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { defaultEdition, EditionPicker } from './EditionPicker'
import { useAfterFirstPaint } from '@/lib/useAfterFirstPaint'
import { Gallery } from './Gallery'

const RARITY_LABEL = { common: 'Comum', rare: 'Raro', legendary: 'Lendário' } as const

/** Anuncia mudanças de preço/estoque recebidas em tempo real (A11Y-06). */
type Snapshot = { id: string; editionId: string | undefined; price: string; available: number | undefined }

/**
 * Compara o que está na tela com o valor anterior DURANTE o render (padrão recomendado pelo
 * React para derivar estado de mudanças de props, sem effect + setState).
 */
function useLiveChanges(nft: NftDetail | undefined, editionId: string | undefined) {
  const [message, setMessage] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  if (nft) {
    const now: Snapshot = { id: nft.id, editionId, price: nft.price, available: nft.editions.find((e) => e.id === editionId)?.available }
    const changed = !snapshot || snapshot.id !== now.id || snapshot.editionId !== now.editionId || snapshot.price !== now.price || snapshot.available !== now.available
    if (changed) {
      setSnapshot(now)
      // Primeiro valor, outro NFT ou troca de edição pela pessoa: não é uma mudança "ao vivo".
      if (snapshot && snapshot.id === now.id && snapshot.editionId === now.editionId) {
        const notes: string[] = []
        if (snapshot.price !== now.price) notes.push(`Preço atualizado para ${formatEth(now.price)}.`)
        if (snapshot.available !== undefined && now.available !== undefined && snapshot.available !== now.available)
          notes.push(now.available === 0 ? 'Esta edição esgotou.' : `Disponibilidade atualizada: ${now.available} unidades.`)
        if (notes.length) setMessage(notes.join(' '))
      }
    }
  }
  return message
}

function InfoList({ nft }: { nft: NftDetail }) {
  return (
    <dl className="flex flex-col gap-2 text-caption">
      {[
        ['ID do token', nft.tokenId],
        ['Coleção', nft.collection],
        ['Atributos', nft.attributes.join(', ')],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-muted-foreground">{k}:</dt>
          <dd className="text-muted-foreground">{v}</dd>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">Rede:</dt>
        <dd>
          <NetworkBadge network={nft.network} />
        </dd>
      </div>
    </dl>
  )
}

function Share({ nft }: { nft: NftDetail }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link', { description: 'Copie o endereço pela barra do navegador.' })
    }
  }
  const icon = 'grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:size-7'
  return (
    <div className="flex items-center gap-2 text-caption font-bold">
      <span>Compartilhar este NFT:</span>
      <button type="button" className={icon} aria-label={`Copiar link de ${nft.name}`} onClick={() => void copy()}>
        <Link2 className="size-4" aria-hidden />
      </button>
      <UnavailableAction label="Compartilhar no X" className={icon}>
        <XSocialIcon />
      </UnavailableAction>
      <UnavailableAction label="Compartilhar no Facebook" className={icon}>
        <FacebookIcon />
      </UnavailableAction>
    </div>
  )
}

function InfoTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs defaultValue="details" className="gap-5">
      <TabsList bordered aria-label="Informações do NFT">
        <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
        <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
      </TabsList>
      {/* forceMount: os dois painéis existem no DOM (aria-controls sempre válido). */}
      <TabsContent value="details" forceMount className="flex flex-col gap-4 text-caption leading-relaxed text-muted-foreground data-[state=inactive]:hidden">
        <p>
          {nft.name} é {nft.description.charAt(0).toLowerCase()}
          {nft.description.slice(1)} Cada atributo fica armazenado nos metadados do token e é verificado na rede.
        </p>
        <p>
          A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência. O criador recebe {nft.royalties}{' '}
          de direitos autorais nas vendas secundárias.
        </p>
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold text-foreground">Rede:</dt>
            <dd>Cunhado na rede {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS (simulado).</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Contrato:</dt>
            <dd>
              <code>{nft.contract}</code>: contrato inteligente ERC-721 (simulado).
            </dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Direitos autorais:</dt>
            <dd>Royalties de {nft.royalties} para o criador nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
          </div>
        </dl>
      </TabsContent>
      <TabsContent value="reviews" forceMount className="data-[state=inactive]:hidden">
        <ul className="flex flex-col gap-4">
          {nft.reviews.map((r) => (
            <li key={r.id} className="rounded-sm bg-surface p-4">
              <p className="flex items-center justify-between text-caption">
                <span className="font-bold">{r.author}</span>
                <RatingStars rating={r.rating} count={1} className="[&>span:last-child]:hidden" />
              </p>
              <p className="mt-2 text-caption text-muted-foreground">{r.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-muted-foreground">Exibindo {nft.reviews.length} de {nft.reviewsCount} avaliações.</p>
      </TabsContent>
    </Tabs>
  )
}

function Related({ nft }: { nft: NftDetail }) {
  const { data, isPending, isError } = useQuery(nftListQuery({ collection: nft.collection, exclude: nft.id, pageSize: 5, sort: 'popular' }))
  const favorites = useFavoriteAction()
  if (isError || (data && data.items.length === 0)) return null
  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-5">
      <SectionHeading id="related-title" title="Mais desta coleção" />
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-40 shrink-0 snap-start lg:w-auto">
                <NFTCardSkeleton />
              </li>
            ))
          : data?.items.map((n) => (
              <li key={n.id} className="w-40 shrink-0 snap-start lg:w-auto">
                <NFTCard nft={n} favorite={favorites.isFavorite(n.id)} favoritePending={favorites.pendingId === n.id} onToggleFavorite={(next) => favorites.toggle(n, next)} />
              </li>
            ))}
      </ul>
    </section>
  )
}

export function NftDetailPage({ nftId, edition, onEditionChange }: { nftId: string; edition?: string; onEditionChange: (id: string) => void }) {
  const { data: nft } = useQuery(nftDetailQuery(nftId))
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const favorites = useFavoriteAction()
  const cart = useCartActions()
  const editionLabelId = useId()
  const [requestedQty, setQuantity] = useState(1)

  const editions = nft?.editions ?? []
  const selectedId = edition && editions.some((e) => e.id === edition) ? edition : defaultEdition(editions)
  const selected = editions.find((e) => e.id === selectedId)
  const maxQty = selected?.available ?? 0
  // Estoque reduzido (inclusive em tempo real): a quantidade efetiva nunca passa do disponível.
  const quantity = Math.max(1, Math.min(requestedQty, maxQty))
  const live = useLiveChanges(nft, selectedId)
  // CP9.2: abas e relacionados (abaixo da dobra) só depois da imagem principal (o LCP): montá-los
  // antes da primeira pintura com conteúdo atrasava o FCP. Limite de 3 s como garantia.
  const [mainImageSettled, setMainImageSettled] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setMainImageSettled(true), 3_000)
    return () => window.clearTimeout(timer)
  }, [])
  const showSecondary = useAfterFirstPaint(!!nft && mainImageSettled)

  if (!nft) return null
  const isFavorite = favorites.isFavorite(nft.id)
  const canBuy = maxQty > 0
  const line = { nftId: nft.id, name: nft.name, editionId: selectedId ?? '', quantity }
  const back = () => (canGoBack ? router.history.back() : void navigate({ to: '/mercado' }))

  const favoriteButton = (variant: 'desktop' | 'mobile') => (
    <Button
      variant={variant === 'desktop' ? 'outline' : 'icon-round'}
      size={variant === 'desktop' ? 'md' : 'icon-lg'}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
      disabled={favorites.pendingId === nft.id}
      onClick={() => favorites.toggle(nft, !isFavorite)}
      className={cn(isFavorite && 'text-price')}
    >
      <Heart aria-hidden fill={isFavorite ? 'currentColor' : 'none'} />
      {variant === 'desktop' && (isFavorite ? 'Favoritado' : 'Favoritar')}
    </Button>
  )

  return (
    <>
      <Container className="flex flex-col gap-10 pb-36 lg:gap-14 lg:pt-6 lg:pb-4">
        <nav aria-label="Trilha de navegação" className="hidden text-caption text-muted-foreground lg:block">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/" className="hover:text-foreground">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/mercado" className="hover:text-foreground">
                Mercado
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {nft.name}
            </li>
          </ol>
        </nav>

        {/* Mobile (Figma): "voltar" e "favoritar" numa barra ACIMA da imagem. */}
        <div className="-mb-7 flex items-center justify-between pt-1 md:mx-auto md:w-full md:max-w-xl lg:hidden">
          <Button variant="icon-round" size="icon-lg" aria-label="Voltar" onClick={back}>
            <ChevronLeft aria-hidden />
          </Button>
          {favoriteButton('mobile')}
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,580px)_minmax(0,1fr)] lg:gap-16">
          <Gallery nft={nft} onMainImageSettled={() => setMainImageSettled(true)} />

          <div className="relative -mx-4 -mt-10 flex flex-col gap-5 rounded-t-2xl bg-surface px-5 pt-6 pb-6 md:mx-auto md:mt-6 md:w-full md:max-w-xl md:rounded-2xl lg:m-0 lg:max-w-none lg:rounded-none lg:bg-transparent lg:p-0">
            {/* Mobile (Figma): nome + selo "★ 4.8 (19)" na mesma linha.
                Desktop (Figma): nome sozinho; abaixo, preço à esquerda e estrelas à direita. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-title-2 lg:text-title-1" data-testid="nft-name">
                  {nft.name}
                </h1>
                <RatingStars rating={nft.rating} count={nft.reviewsCount} compact className="shrink-0 lg:hidden" />
              </div>
              <div className="hidden flex-wrap items-center justify-between gap-x-4 gap-y-1 lg:flex">
                <PriceDisplay value={nft.price} previous={nft.previousPrice ?? undefined} size="lg" label="Preço" />
                <RatingStars rating={nft.rating} count={nft.reviewsCount} />
              </div>
            </div>
            <p className="sr-only" role="status" aria-live="polite" data-testid="live-notice">
              {live}
            </p>
            {live && (
              <p className="rounded-xs border border-primary/40 bg-primary/10 px-3 py-2 text-caption text-price" aria-hidden>
                {live}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <h2 className="hidden text-caption font-bold lg:block">Sobre este NFT:</h2>
              <p className="text-caption leading-relaxed text-muted-foreground">{nft.description}</p>
            </div>
            <div className="flex flex-col gap-2">
              <h2 id={editionLabelId} className="text-caption font-bold">
                Edição:
              </h2>
              <EditionPicker
                editions={editions}
                value={selectedId}
                labelId={editionLabelId}
                onChange={(id) => {
                  setQuantity(1)
                  onEditionChange(id)
                }}
              />
              {selected && selected.available === 0 && (
                <p className="text-caption text-destructive" role="alert">
                  Edição {selected.label} indisponível no momento.
                </p>
              )}
              {selected && selected.available > 0 && (
                <p className="text-caption text-muted-foreground" data-testid="edition-stock">
                  {selected.available} {selected.available === 1 ? 'unidade disponível' : 'unidades disponíveis'} · {RARITY_LABEL[nft.rarity]}
                </p>
              )}
            </div>

            {/* Ações (desktop): quantidade à esquerda, comprar / carrinho / favoritar à direita. */}
            <div className="hidden flex-wrap items-center justify-between gap-4 lg:flex">
              <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, maxQty)} disabled={!canBuy} itemName={nft.name} />
              <div className="flex items-center gap-2">
                <Button onClick={() => cart.buyNow(line)} disabled={!canBuy} className="uppercase">
                  Comprar
                </Button>
                <Button variant="secondary" size="icon" aria-label={`Adicionar ${nft.name} ao carrinho`} onClick={() => cart.addToCart(line)} disabled={!canBuy}>
                  <ShoppingCart aria-hidden />
                </Button>
                {favoriteButton('desktop')}
              </div>
            </div>

            <InfoList nft={nft} />
            <Share nft={nft} />
          </div>
        </div>

        {showSecondary ? (
          <>
            <InfoTabs nft={nft} />
            <Related nft={nft} />
          </>
        ) : (
          // Reserva o espaço das seções para o rodapé não se deslocar quando elas entram.
          <div aria-hidden data-testid="detail-secondary-placeholder" className="min-h-[53.5rem] md:min-h-[43.75rem] lg:min-h-[43.8rem]" />
        )}
      </Container>

      {/* Barra de compra fixa (mobile/tablet), como no Figma Mobile / Detalhes. */}
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl bg-surface px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.6)] lg:hidden" data-testid="mobile-buy-bar">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-caption text-muted-foreground">Qtd.</span>
              <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, maxQty)} disabled={!canBuy} itemName={nft.name} />
            </div>
            <PriceDisplay value={nft.price} size="lg" label="Preço" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="gradient" size="lg" className="flex-1" onClick={() => cart.buyNow(line)} disabled={!canBuy}>
              {canBuy ? 'Comprar NFT' : 'Indisponível'}
            </Button>
            <Button variant="icon-round" size="icon-lg" className="size-12" aria-label={`Adicionar ${nft.name} ao carrinho`} onClick={() => cart.addToCart(line)} disabled={!canBuy}>
              <ShoppingCart aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
