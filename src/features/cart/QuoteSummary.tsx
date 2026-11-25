/**
 * Resumo financeiro (Figma: "Resumo da carteira") e cupom.
 *
 * Os valores vêm SEMPRE da cotação da API (subtotal, desconto, taxa de rede, total). Enquanto
 * a cotação carrega, cada valor mostra um skeleton; em erro, há "Tentar novamente". Nenhuma
 * soma acontece no cliente.
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ApplyCoupon, type Cart, type Quote } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { apiErrorMessage } from '@/components/kurio/form'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from './queries'

export function SummaryRows({
  quote,
  loading,
  error,
  onRetry,
  feeNote,
}: {
  quote: Quote | undefined
  loading: boolean
  error: unknown
  onRetry?: () => void
  /** Texto abaixo da taxa (Figma: "Taxa estimada"). */
  feeNote?: string
}) {
  const value = (v: string | undefined, testId: string, negative = false) =>
    quote && v !== undefined ? (
      <span className="font-mono tabular-nums" data-testid={testId} data-value={v}>
        {negative ? `(-) ${formatEth(v)}` : formatEth(v)}
      </span>
    ) : loading ? (
      <Skeleton className="h-4 w-20 rounded-xs" />
    ) : (
      <span aria-hidden>—</span>
    )

  return (
    <div className="flex flex-col gap-3" aria-busy={loading}>
      {loading && !quote && (
        <p role="status" className="sr-only">
          Calculando os valores…
        </p>
      )}
      {error !== null && error !== undefined && !loading && (
        <div role="alert" className="flex flex-col gap-2 rounded-xs bg-destructive-surface px-3 py-2 text-caption text-destructive">
          <span>{error instanceof ApiError && error.code === 'OUT_OF_STOCK' ? error.message : `Não foi possível calcular os valores. ${apiErrorMessage(error)}`}</span>
          {onRetry && (
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      <dl className="flex flex-col gap-3 text-caption">
        <Row label="Subtotal">{value(quote?.subtotal, 'quote-subtotal')}</Row>
        <Row label={quote?.coupon ? quote.coupon.label : 'Desconto do lançamento'}>{value(quote?.discount, 'quote-discount', true)}</Row>
        <Row label={quote ? `Taxa de rede (${NETWORK_LABEL[quote.network]})` : 'Taxa de rede'}>
          <span className="flex flex-col items-end gap-0.5">
            {value(quote?.networkFee, 'quote-fee')}
            {feeNote && <span className="text-[0.6875rem] text-price">{feeNote}</span>}
          </span>
        </Row>
        <div className="flex items-center justify-between border-t border-border-strong pt-3">
          <dt className="text-body font-bold">Total</dt>
          <dd className="text-body font-bold text-price">{value(quote?.total, 'quote-total')}</dd>
        </div>
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  )
}

/** Cupom: aplicar, remover, inválido e expirado (erros da API no campo). */
export function CouponForm({ cart, className }: { cart: Cart; className?: string }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [error, setError] = useState<string | null>(null)
  const inputId = 'coupon-code'

  if (cart.coupon) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xs border border-primary/40 bg-primary/10 px-3 py-2 text-caption', className)}>
        <span>
          Cupom <strong className="text-price">{cart.coupon.code}</strong> aplicado · {cart.coupon.label}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutateAsync().then(
              () => toast.success('Cupom removido'),
              (e: unknown) => toast.error('Não foi possível remover o cupom', { description: apiErrorMessage(e) }),
            )
          }
        >
          {remove.isPending ? 'Removendo…' : 'Remover cupom'}
        </Button>
      </div>
    )
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (apply.isPending) return
    const parsed = ApplyCoupon.safeParse({ code: new FormData(e.currentTarget).get('code') })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Código inválido')
    setError(null)
    apply.mutateAsync(parsed.data.code).then(
      (r) => toast.success(`Cupom ${r.cart.coupon?.code ?? parsed.data.code} aplicado`),
      (err: unknown) => setError(err instanceof ApiError && err.details?.code ? err.details.code : apiErrorMessage(err)),
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex flex-col gap-1.5', className)} aria-label="Cupom de desconto">
      {/* Figma: no desktop, rótulo visível + campo e botão retos; no mobile, pílula sem rótulo
          visível (o rótulo continua associado para leitores de tela). Placeholder do Figma inteiro,
          sem corte, de 360 a 1440 px (layout.responsive); abaixo de 375 px a pílula empilha. */}
      <label htmlFor={inputId} className="sr-only text-caption font-semibold lg:not-sr-only">
        Código promocional
      </label>
      <div className="flex rounded-full bg-surface-2 p-1 max-[374px]:flex-col max-[374px]:rounded-2xl lg:rounded-none lg:bg-transparent lg:p-0">
        <Input
          id={inputId}
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Digite o código promocional…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 rounded-full border-transparent bg-transparent px-2.5 text-caption placeholder:text-[0.6875rem] lg:h-10 lg:rounded-xs lg:rounded-r-none lg:border-input lg:px-2.5"
        />
        <Button type="submit" size="sm" disabled={apply.isPending} className="h-10 shrink-0 rounded-full bg-primary-gradient px-3 lg:rounded-xs lg:rounded-l-none lg:bg-primary lg:bg-none lg:px-3.5">
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
