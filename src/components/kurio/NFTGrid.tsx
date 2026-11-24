/**
 * Grade de NFTs.
 * - Mobile (< md): 2 colunas com a coluna da direita deslocada para baixo (efeito masonry do
 *   Figma, Mobile / Início). Implementado com `translate` nos itens pares: o DOM continua numa
 *   única lista, em ordem de leitura e de tabulação; o padding inferior reserva o deslocamento.
 * - Tablet e desktop (≥ md): grade uniforme de 3 colunas (Figma desktop).
 * - Carregando: mesmo layout com NFTCardSkeleton, `aria-busy` e aviso para leitores de tela.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { NFTCardSkeleton } from './NFTCard'

export function NFTGrid<T>({
  items,
  renderItem,
  getKey,
  loading = false,
  skeletonCount = 6,
  label,
  className,
}: {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  getKey: (item: T) => string
  loading?: boolean
  skeletonCount?: number
  /** Nome acessível da lista (ex.: "NFTs do catálogo"). */
  label: string
  className?: string
}) {
  const cells: Array<{ key: string; node: ReactNode }> = loading
    ? Array.from({ length: skeletonCount }, (_, i) => ({ key: `sk-${i}`, node: <NFTCardSkeleton /> }))
    : items.map((item, i) => ({ key: getKey(item), node: renderItem(item, i) }))

  return (
    <section aria-label={label} aria-busy={loading} className={className}>
      {loading && (
        <p role="status" className="sr-only">
          Carregando NFTs…
        </p>
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-4 pb-9 md:grid-cols-3 md:gap-x-5 md:gap-y-8 md:pb-0" data-testid="nft-grid">
        {cells.map((c) => (
          <li key={c.key} className={cn('min-w-0 max-md:even:translate-y-9')}>
            {c.node}
          </li>
        ))}
      </ul>
    </section>
  )
}
