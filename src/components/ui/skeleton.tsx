import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton (base shadcn/ui) com shimmer do KURIO (`.skeleton` em index.css).
 * Decorativo: oculto para leitores de tela. O estado de carregamento é anunciado pelo
 * contêiner com `aria-busy` + texto `sr-only` (ver LoadingState/NFTCardSkeleton).
 * Sob `prefers-reduced-motion`, o shimmer é desligado.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('skeleton rounded-md', className)} {...props} />
}

export { Skeleton }
