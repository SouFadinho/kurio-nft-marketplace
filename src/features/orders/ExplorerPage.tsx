/**
 * Explorador de blocos SIMULADO (PAY-08). Claramente identificado como demonstração: não há
 * blockchain real. Mostra apenas dados públicos de uma transação confirmada (sem e-mail,
 * nome ou itens do comprador).
 */
import { Link } from '@tanstack/react-router'
import { FlaskConical } from 'lucide-react'
import { ApiError } from '@/api/http'
import { Skeleton } from '@/components/ui/skeleton'
import { Container } from '@/components/kurio/basics'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { apiErrorMessage } from '@/components/kurio/form'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { formatEth } from '@/lib/eth'
import { formatDateTime } from './OrderStatusPage'
import { useExplorerTx } from './queries'

export function ExplorerPage({ hash }: { hash: string }) {
  const tx = useExplorerTx(hash)
  let body
  if (tx.isPending) body = <Skeleton className="h-64 w-full rounded-sm" aria-label="Carregando transação" />
  else if (tx.isError) {
    body =
      tx.error instanceof ApiError && tx.error.code === 'NOT_FOUND' ? (
        <EmptyState headingLevel="h1" title="Transação não encontrada" description="Este explorador simulado só conhece transações confirmadas na demonstração." />
      ) : (
        <ErrorState title="Não foi possível carregar a transação" message={apiErrorMessage(tx.error)} onRetry={() => void tx.refetch()} retrying={tx.isFetching} />
      )
  } else {
    const t = tx.data
    body = (
      <article aria-labelledby="explorer-title" className="flex flex-col gap-5 rounded-sm bg-surface p-5 lg:p-8">
        <p role="note" className="flex items-center gap-2 rounded-xs border border-warning/50 bg-warning/10 px-3 py-2 text-caption text-warning">
          <FlaskConical className="size-4 shrink-0" aria-hidden />
          Explorador simulado: ambiente de demonstração, sem blockchain real.
        </p>
        <h1 id="explorer-title" className="text-title-2 font-bold">
          Transação
        </h1>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-caption sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Hash</dt>
          <dd className="break-all font-mono">{t.hash}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="text-success">Confirmada</dd>
          <dt className="text-muted-foreground">Rede</dt>
          <dd>{NETWORK_LABEL[t.network]}</dd>
          <dt className="text-muted-foreground">Bloco</dt>
          <dd className="font-mono">{t.blockNumber.toLocaleString('pt-BR')}</dd>
          <dt className="text-muted-foreground">De</dt>
          <dd className="break-all font-mono">{t.from}</dd>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-mono">{formatEth(t.value)}</dd>
          <dt className="text-muted-foreground">Confirmada em</dt>
          <dd>{formatDateTime(t.confirmedAt)}</dd>
        </dl>
        <Link to="/pedidos" className="self-start text-caption text-price underline underline-offset-4">
          Ver meus pedidos
        </Link>
      </article>
    )
  }
  return (
    <>
      <MobileTopBar title="Explorador simulado" titleAs="p" fallback="/" />
      <Container className="max-w-3xl pb-10 lg:pt-8">{body}</Container>
    </>
  )
}
