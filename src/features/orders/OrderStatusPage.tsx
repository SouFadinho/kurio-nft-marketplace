/**
 * Pedido e recibo definitivo (TELA-05 / PAY-05 / PAY-06 / PAY-08).
 *
 * Mostra SOMENTE o que a API simulada afirma:
 * - pendente: "Pedido recebido · aguardando a confirmação da rede" e o prazo da reserva;
 * - confirmado: RECIBO (snapshot imutável gravado na criação do pedido: itens, edições,
 *   preços congelados, valores, rede, carteira) + hash e explorador simulados;
 * - recusado: motivo (pagamento recusado ou reserva vencida), nada cobrado, carrinho preservado.
 * O estado chega por `order.updated` (Socket.IO) ou pelo REST (reconciliação, refresh, acesso
 * direto). Nada é lido do catálogo: mudanças posteriores de preço, estoque, perfil ou carteira
 * não alteram o recibo. Sem frame no Figma: derivado do design system (VISUAL_ANALYSIS §14).
 */
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { WALLET_TYPE_LABEL } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/kurio/basics'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { NftImage } from '@/components/kurio/NftImage'
import { shortenAddress } from '@/components/kurio/WalletCard'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { apiErrorMessage } from '@/components/kurio/form'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useOrder } from './queries'

/** Datas no fuso de Brasília (produto brasileiro; determinístico nos testes). */
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

export function statusView(order: Order) {
  if (order.status === 'confirmed') return { icon: CheckCircle2, title: 'Compra confirmada', text: 'A rede (simulada) confirmou o pagamento. Este é o seu recibo.', tone: 'text-success', label: 'Confirmado' }
  if (order.status === 'rejected') {
    const expired = order.failureReason === 'reservation_expired'
    return {
      icon: XCircle,
      title: expired ? 'Reserva expirada' : 'Pagamento recusado',
      text: expired
        ? 'A rede não confirmou dentro do prazo da reserva. Nenhum valor foi cobrado e os itens voltaram ao estoque.'
        : 'A rede (simulada) recusou o pagamento. Nenhum valor foi cobrado.',
      tone: 'text-destructive',
      label: expired ? 'Reserva expirada' : 'Recusado',
    }
  }
  return { icon: Clock, title: 'Pedido recebido', text: 'Aguardando a confirmação da rede…', tone: 'text-warning', label: 'Pendente' }
}

export function OrderStatusPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)

  let body
  if (order.isPending) body = <Skeleton className="h-96 w-full rounded-sm" aria-label="Carregando pedido" />
  else if (order.isError) {
    body =
      order.error instanceof ApiError && order.error.code === 'NOT_FOUND' ? (
        <EmptyState
          headingLevel="h1"
          title="Pedido não encontrado"
          description="Confira o endereço ou consulte seus pedidos."
          action={
            <Button asChild>
              <Link to="/pedidos">Ver meus pedidos</Link>
            </Button>
          }
        />
      ) : (
        <ErrorState title="Não foi possível carregar o pedido" message={apiErrorMessage(order.error)} onRetry={() => void order.refetch()} retrying={order.isFetching} />
      )
  } else body = <Receipt order={order.data} refreshing={order.isFetching} onRefresh={() => void order.refetch()} />

  return (
    <>
      <MobileTopBar title="Pedido" titleAs="p" fallback="/" />
      <Container className="max-w-3xl pb-10 lg:pt-8">{body}</Container>
    </>
  )
}

function Receipt({ order: o, refreshing, onRefresh }: { order: Order; refreshing: boolean; onRefresh: () => void }) {
  const s = statusView(o)
  const Icon = s.icon
  const p = o.pricing
  return (
    <article className="flex flex-col gap-6 rounded-sm bg-surface p-5 lg:p-8" aria-labelledby="order-title" data-testid="receipt">
      <header className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">Pedido {o.id}</p>
        <h1 id="order-title" className={cn('flex items-center gap-2 text-title-2 font-bold', s.tone)}>
          <Icon className="size-6 shrink-0" aria-hidden />
          {s.title}
        </h1>
        <p aria-live="polite" data-testid="order-status" data-status={o.status} className="text-body">
          {s.text}
        </p>
        {o.status === 'pending' && (
          <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            {o.reservedUntil && <span data-testid="reservation">Itens reservados até {formatDateTime(o.reservedUntil)}.</span>}
            <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn(refreshing && 'motion-safe:animate-spin')} aria-hidden />
              {refreshing ? 'Atualizando…' : 'Atualizar status'}
            </Button>
          </div>
        )}
        {o.status === 'rejected' && p && (
          <p className="text-caption">
            Os itens continuam no seu{' '}
            <Link to="/carrinho" className="text-price underline underline-offset-4">
              carrinho
            </Link>
            .
          </p>
        )}
      </header>

      <section aria-labelledby="receipt-data" className="flex flex-col gap-3">
        <h2 id="receipt-data" className="text-title-3 font-bold">
          {o.status === 'confirmed' ? 'Recibo' : 'Dados do pedido'}
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-caption sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Pedido</dt>
          <dd className="font-mono">{o.id}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd data-testid="receipt-status">{s.label}</dd>
          <dt className="text-muted-foreground">Criado em</dt>
          <dd>{formatDateTime(o.createdAt)}</dd>
          {o.settledAt && (
            <>
              <dt className="text-muted-foreground">{o.status === 'confirmed' ? 'Confirmado em' : 'Encerrado em'}</dt>
              <dd>{formatDateTime(o.settledAt)}</dd>
            </>
          )}
          {o.status === 'confirmed' && o.txHash && (
            <>
              <dt className="text-muted-foreground">Transação (simulada)</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <code className="break-all" data-testid="order-tx">
                  {o.txHash}
                </code>
                <Link to="/explorador/tx/$hash" params={{ hash: o.txHash }} className="inline-flex items-center gap-1 text-price underline underline-offset-4">
                  Ver no explorador simulado
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </dd>
            </>
          )}
          {p && (
            <>
              <dt className="text-muted-foreground">Rede</dt>
              <dd data-testid="receipt-network">{NETWORK_LABEL[p.network]}</dd>
              <dt className="text-muted-foreground">Carteira</dt>
              <dd data-testid="receipt-wallet" className="min-w-0 break-words">
                {p.walletLabel ? `${p.walletLabel} · ` : ''}
                <span title={p.walletAddress}>{shortenAddress(p.walletAddress)}</span>
                {p.provider ? ` · via ${WALLET_TYPE_LABEL[p.provider]}` : ''}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="receipt-items" className="flex flex-col gap-3">
        <h2 id="receipt-items" className="text-title-3 font-bold">
          NFTs
        </h2>
        <ul className="flex flex-col gap-2">
          {o.lines.map((l) => (
            <li key={`${l.nftId}:${l.editionId ?? ''}`} className="flex items-center gap-3 rounded-xs bg-surface-2 p-2" data-testid="receipt-line">
              {l.image && (
                <div className="size-14 shrink-0 overflow-hidden rounded-xs">
                  <NftImage src={l.image} alt={l.imageAlt ?? l.name} />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-caption font-bold">{l.name}</span>
                {l.editionLabel && <span className="text-[0.6875rem] text-muted-foreground">Edição {l.editionLabel}</span>}
                <span className="font-mono text-[0.6875rem] text-muted-foreground" data-testid="receipt-unit">
                  {l.quantity} × {formatEth(l.unitPrice)}
                </span>
              </div>
              <span className="font-mono text-caption font-bold text-price tabular-nums">{formatEth(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 text-caption">
          {p && (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono" data-testid="receipt-subtotal">{formatEth(p.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Desconto{p.couponCode ? ` (${p.couponCode})` : ''}</dt>
                <dd className="font-mono" data-testid="receipt-discount">(-) {formatEth(p.discount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Taxa de rede ({NETWORK_LABEL[p.network]})</dt>
                <dd className="font-mono" data-testid="receipt-fee">{formatEth(p.networkFee)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-3 border-t border-border-strong pt-3 text-body font-bold">
            <dt>Total</dt>
            <dd className="font-mono text-price" data-testid="order-total">
              {formatEth(o.total)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/mercado">Continuar explorando</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/pedidos">Ver meus pedidos</Link>
        </Button>
      </div>
    </article>
  )
}
