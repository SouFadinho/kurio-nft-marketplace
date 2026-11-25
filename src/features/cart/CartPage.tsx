/**
 * Carrinho de NFTs (TELA-03). Figma: Desktop / Carrinho (tabela NFTs · Preço · Edições · Total e
 * "Resumo da carteira" à direita); Mobile / Carrinho (cards com stepper, cupom em pílula e
 * "Conectar e finalizar" fixo na base).
 *
 * - Itens, quantidades e disponibilidade vêm do carrinho da API; total por linha e resumo vêm
 *   da COTAÇÃO da API (rede Ethereum como estimativa; a rede final é escolhida no pagamento).
 * - Problemas de estoque aparecem na linha, com ação para corrigir; o checkout fica bloqueado
 *   até o carrinho estar válido (a API também recusa a cotação).
 * - Toda ação tem feedback acessível (toast em região aria-live; erros em role=alert).
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, CartLine, Quote } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/NftImage'
import { PriceDisplay } from '@/components/kurio/PriceDisplay'
import { QuantitySelector } from '@/components/kurio/QuantitySelector'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { apiErrorMessage } from '@/components/kurio/form'
import { CheckoutLayout } from '@/components/layout/CheckoutLayout'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { CouponForm, SummaryRows } from './QuoteSummary'
import { cartHasIssues, useCart, useQuote, useRemoveCartLine, useUpdateCartLine } from './queries'
import { NFTCard } from '@/components/kurio/NFTCard'
import { SectionHeading } from '@/components/kurio/SectionHeading'
import { nftListQuery } from '@/features/nfts/queries'
import { useCartActions } from './actions'

const CRUMBS = [{ label: 'Início', to: '/' as const }, { label: 'Mercado', to: '/mercado' as const }, { label: 'Carrinho' }]

export function CartPage() {
  const cart = useCart()
  const quote = useQuote('ethereum', cart.data)
  const navigate = useNavigate()

  if (cart.isPending) {
    return (
      <CheckoutLayout
        title="Carrinho de NFTs"
        crumbs={CRUMBS}
        backTo="/mercado"
        main={
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando carrinho">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        }
        summary={<Skeleton className="h-72 w-full rounded-sm" />}
      />
    )
  }
  if (cart.isError) {
    return (
      <CheckoutLayout
        title="Carrinho de NFTs"
        crumbs={CRUMBS}
        backTo="/mercado"
        main={<ErrorState title="Não foi possível carregar o carrinho" message={apiErrorMessage(cart.error)} onRetry={() => void cart.refetch()} retrying={cart.isFetching} />}
        summary={null}
      />
    )
  }

  const data = cart.data
  if (data.lines.length === 0) {
    return (
      <CheckoutLayout
        title="Carrinho de NFTs"
        crumbs={CRUMBS}
        backTo="/mercado"
        main={
          <EmptyState
            title="Seu carrinho está vazio"
            description="Explore o mercado e adicione NFTs para continuar."
            action={
              <Button asChild>
                <Link to="/mercado">Explorar NFTs</Link>
              </Button>
            }
          />
        }
        summary={null}
      />
    )
  }

  const issues = cartHasIssues(data)
  const canCheckout = !issues && !!quote.data && !quote.isFetching
  const blockedReason = issues ? 'Ajuste os itens sem estoque para continuar.' : !quote.data ? 'Aguarde o cálculo dos valores.' : null
  const goCheckout = () => void navigate({ to: '/pagamento' })

  const checkoutButton = (className: string, variant: 'default' | 'gradient') => (
    <Button
      variant={variant}
      size="lg"
      className={className}
      onClick={goCheckout}
      disabled={!canCheckout}
      aria-describedby={blockedReason ? 'checkout-blocked' : undefined}
    >
      Conectar e finalizar
    </Button>
  )

  return (
    <CheckoutLayout
      title="Carrinho de NFTs"
      crumbs={CRUMBS}
      backTo="/mercado"
      main={<CartLines cart={data} quote={quote.data} />}
      summary={
        <section aria-labelledby="summary-title" className="flex flex-col gap-4 rounded-sm bg-surface p-5">
          <h2 id="summary-title" className="border-b border-border-strong pb-3 text-title-3 font-bold">
            Resumo da carteira
          </h2>
          <CouponForm cart={data} className="lg:flex" />
          <SummaryRows quote={quote.data} loading={quote.isFetching} error={quote.error} onRetry={() => void quote.refetch()} feeNote="Taxa estimada" />
          {blockedReason && (
            <p id="checkout-blocked" className="text-caption text-muted-foreground">
              {blockedReason}
            </p>
          )}
          {checkoutButton('hidden w-full lg:flex', 'default')}
          <Link to="/mercado" className="hidden text-center text-caption text-price underline-offset-4 hover:underline lg:block">
            Continuar explorando
          </Link>
        </section>
      }
      mobileAction={checkoutButton('w-full', 'gradient')}
      below={<AlsoViewed exclude={data.lines.map((l) => l.nftId)} />}
    />
  )
}

/** Figma (Desktop / Carrinho): "Colecionadores também viram". Só no desktop, como no Figma. */
function AlsoViewed({ exclude }: { exclude: string[] }) {
  const { data } = useQuery(nftListQuery({ pageSize: 8, sort: 'popular' }))
  const cart = useCartActions()
  const items = (data?.items ?? []).filter((n) => !exclude.includes(n.id)).slice(0, 5)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="also-viewed-title" className="mt-12 hidden flex-col gap-5 lg:flex">
      <SectionHeading id="also-viewed-title" title="Colecionadores também viram" />
      <ul className="grid grid-cols-5 gap-4">
        {items.map((n) => (
          <li key={n.id}>
            <NFTCard nft={n} onAddToCart={() => void cart.addToCart({ nftId: n.id, name: n.name, quantity: 1 })} addPending={cart.pendingNftId === n.id} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CartLines({ cart, quote }: { cart: Cart; quote: Quote | undefined }) {
  const lineTotals = new Map(quote?.lines.map((l) => [l.lineId, l.lineTotal]))
  return (
    <section aria-labelledby="cart-items-title">
      <h2 id="cart-items-title" className="sr-only">
        Itens do carrinho
      </h2>
      <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_110px_120px_110px_40px] gap-4 border-b border-border-strong px-3 pb-2 text-caption font-semibold text-foreground lg:grid">
        <span>NFTs</span>
        <span>Preço</span>
        <span>Edições</span>
        <span>Total</span>
        <span />
      </div>
      <ul className="flex flex-col gap-3 lg:mt-3 lg:gap-2" aria-label="Itens do carrinho">
        {cart.lines.map((line) => (
          <CartRow key={line.id} line={line} lineTotal={lineTotals.get(line.id)} />
        ))}
      </ul>
    </section>
  )
}

function CartRow({ line, lineTotal }: { line: CartLine; lineTotal: string | undefined }) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const busy = update.isPending || remove.isPending
  const max = Math.max(line.quantity, line.available, 1)

  const setQuantity = (quantity: number) =>
    update.mutateAsync({ lineId: line.id, quantity, name: line.name }).then(
      () => toast.success(`Quantidade de ${line.name}: ${quantity}`),
      (e: unknown) =>
        toast.error(`Não foi possível alterar a quantidade de ${line.name}`, { description: e instanceof ApiError ? e.message : apiErrorMessage(e) }),
    )
  const onRemove = () =>
    remove.mutateAsync({ lineId: line.id, name: line.name }).then(
      () => toast.success(`${line.name} removido do carrinho`),
      (e: unknown) => toast.error(`Não foi possível remover ${line.name}`, { description: apiErrorMessage(e) }),
    )

  const priceChanged = line.priceAtAdd !== line.unitPrice
  return (
    <li
      className={cn('overflow-hidden rounded-lg bg-surface lg:rounded-xs', line.issue && 'ring-1 ring-destructive/60')}
      data-testid="cart-line"
      data-line-id={line.id}
      aria-busy={busy}
    >
      <div className="flex items-stretch lg:grid lg:grid-cols-[minmax(0,1fr)_110px_120px_110px_40px] lg:items-center lg:gap-4 lg:px-3 lg:py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-20 shrink-0 overflow-hidden bg-surface-2 lg:size-12 lg:rounded-xs">
            <NftImage src={line.image} alt={line.imageAlt} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 py-2 lg:py-0">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="truncate text-body font-bold hover:underline lg:text-caption">
              {line.name}
            </Link>
            <span className="text-caption text-muted-foreground">Edição: {line.editionLabel}</span>
            <PriceDisplay value={line.unitPrice} size="lg" label="Preço unitário" className="lg:hidden" />
          </div>
        </div>
        <PriceDisplay value={line.unitPrice} label="Preço unitário" className="hidden text-caption lg:inline-flex" />
        <div className="ml-auto flex items-center gap-1 self-center pr-3 lg:ml-0 lg:pr-0">
          <QuantitySelector value={line.quantity} onChange={(q) => void setQuantity(q)} max={max} itemName={line.name} disabled={busy} className="gap-2" />
        </div>
        <span className="hidden font-mono text-caption font-bold text-price tabular-nums lg:block" data-testid="line-total">
          {lineTotal ? formatEth(lineTotal) : <span aria-label="Total da linha indisponível">—</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden text-muted-foreground hover:text-foreground lg:inline-flex"
          aria-label={`Remover ${line.name} do carrinho`}
          onClick={onRemove}
          disabled={busy}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5 lg:hidden">
        <span className="font-mono text-caption tabular-nums">
          Total: <strong className="text-price">{lineTotal ? formatEth(lineTotal) : '—'}</strong>
        </span>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" aria-label={`Remover ${line.name} do carrinho`} onClick={onRemove} disabled={busy}>
          <Trash2 aria-hidden /> Remover
        </Button>
      </div>
      {(line.issue || priceChanged) && (
        <div role={line.issue ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-2 px-3 py-2 text-caption', line.issue ? 'bg-destructive-surface text-destructive' : 'bg-primary/10 text-price')}>
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {line.issue === 'unavailable' && <span>Esta edição esgotou. Remova o item para continuar.</span>}
          {line.issue === 'insufficient' && (
            <>
              <span>
                Só {line.available === 1 ? 'resta 1 unidade' : `restam ${line.available} unidades`}. Ajuste a quantidade para continuar.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => void setQuantity(line.available)} disabled={busy}>
                Ajustar para {line.available}
              </Button>
            </>
          )}
          {!line.issue && priceChanged && (
            <span>
              Preço atualizado: era {formatEth(line.priceAtAdd)}, agora {formatEth(line.unitPrice)}.
            </span>
          )}
        </div>
      )}
    </li>
  )
}
