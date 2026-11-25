/**
 * Situação do pedido criado pelo checkout (CP5; o recibo completo é consolidado no CP6).
 *
 * Mostra SOMENTE o que a API simulada afirma: "aguardando confirmação" enquanto o status for
 * `pending`; "confirmado" só quando o status chegar `confirmed` (via Socket.IO `order.updated`
 * ou REST na reconciliação); "recusado" se `rejected`. Nada é presumido pela interface.
 */
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/kurio/basics'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { apiErrorMessage } from '@/components/kurio/form'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useOrder } from './queries'

const STATUS = {
  pending: { icon: Clock, title: 'Pedido recebido', text: 'Aguardando a confirmação da rede…', tone: 'text-warning' },
  confirmed: { icon: CheckCircle2, title: 'Pagamento confirmado', text: 'A rede (simulada) confirmou o pagamento.', tone: 'text-success' },
  rejected: { icon: XCircle, title: 'Pagamento recusado', text: 'A rede (simulada) recusou o pagamento. Nenhum valor foi cobrado.', tone: 'text-destructive' },
} as const

export function OrderStatusPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)

  let body
  if (order.isPending) body = <Skeleton className="h-64 w-full rounded-sm" aria-label="Carregando pedido" />
  else if (order.isError) {
    body =
      order.error instanceof ApiError && order.error.code === 'NOT_FOUND' ? (
        <EmptyState headingLevel="h1" title="Pedido não encontrado" description="Confira o endereço ou volte ao início." action={<Button asChild><Link to="/">Voltar ao início</Link></Button>} />
      ) : (
        <ErrorState title="Não foi possível carregar o pedido" message={apiErrorMessage(order.error)} onRetry={() => void order.refetch()} retrying={order.isFetching} />
      )
  } else {
    const o = order.data
    const s = STATUS[o.status]
    const Icon = s.icon
    body = (
      <article className="flex flex-col gap-5 rounded-sm bg-surface p-5 lg:p-8" aria-labelledby="order-title">
        <header className="flex flex-col gap-2">
          <p className="text-caption text-muted-foreground">Pedido {o.id}</p>
          <h1 id="order-title" className={cn('flex items-center gap-2 text-title-2 font-bold', s.tone)}>
            <Icon className="size-6 shrink-0" aria-hidden />
            {s.title}
          </h1>
          <p aria-live="polite" data-testid="order-status" data-status={o.status} className="text-body">
            {s.text}
          </p>
        </header>
        <ul className="flex flex-col divide-y divide-border">
          {o.lines.map((l) => (
            <li key={`${l.nftId}:${l.editionId ?? ''}`} className="flex justify-between gap-3 py-2 text-caption">
              <span>
                {l.name} × {l.quantity}
              </span>
              <span className="font-mono tabular-nums">{formatEth(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {o.pricing && (
          <dl className="flex flex-col gap-2 text-caption">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatEth(o.pricing.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Desconto{o.pricing.couponCode ? ` (${o.pricing.couponCode})` : ''}</dt><dd className="font-mono">(-) {formatEth(o.pricing.discount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Taxa de rede ({NETWORK_LABEL[o.pricing.network]})</dt><dd className="font-mono">{formatEth(o.pricing.networkFee)}</dd></div>
          </dl>
        )}
        <p className="flex justify-between border-t border-border-strong pt-3 text-body font-bold">
          <span>Total</span>
          <span className="font-mono text-price" data-testid="order-total">{formatEth(o.total)}</span>
        </p>
        {o.status === 'confirmed' && o.txHash && (
          <p className="break-all text-caption text-muted-foreground">
            Transação (simulada): <code data-testid="order-tx">{o.txHash}</code>
          </p>
        )}
        <Link to="/mercado" className="self-start text-caption text-price underline-offset-4 hover:underline">
          Continuar explorando
        </Link>
      </article>
    )
  }

  return (
    <>
      <MobileTopBar title="Pedido" titleAs="p" fallback="/" />
      <Container className="max-w-3xl pb-10 lg:pt-8">{body}</Container>
    </>
  )
}
