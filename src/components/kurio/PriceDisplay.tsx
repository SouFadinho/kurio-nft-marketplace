import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'text-caption',
  md: 'text-body',
  lg: 'text-title-2',
  xl: 'text-title-1',
} as const

/**
 * Preço em ETH. Recebe a STRING decimal da API e formata com bigint (lib/eth): nunca usa number.
 * `previous` mostra o preço anterior riscado (Figma: "1.99 ETH 2.29 ETH"), com rótulo acessível.
 */
export function PriceDisplay({
  value,
  previous,
  size = 'md',
  className,
  label,
}: {
  value: string
  previous?: string
  size?: keyof typeof SIZES
  className?: string
  /** Prefixo lido por leitores de tela, ex.: "Preço". */
  label?: string
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 font-mono', className)} data-slot="price">
      {label && <span className="sr-only">{label}: </span>}
      <span className={cn('font-bold text-price tabular-nums', SIZES[size])} data-value={value}>
        {formatEth(value)}
      </span>
      {previous && (
        <s className="text-caption text-muted-foreground tabular-nums">
          <span className="sr-only">preço anterior </span>
          {formatEth(previous)}
        </s>
      )}
    </span>
  )
}
