/**
 * Barra superior MOBILE (< lg), por tela, como no Figma:
 * - Carrinho/Pagamento: botão circular "voltar" + título centralizado ("Carrinho de NFTs").
 * - Detalhe: "voltar" + ação à direita (favoritar), sem título.
 * - `brand`: logo centralizado, para telas sem título próprio.
 * O "voltar" usa o histórico quando existe; senão, vai para `fallback`.
 */
import type { ReactNode } from 'react'
import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/kurio/basics'
import { cn } from '@/lib/utils'

export function MobileTopBar({
  title,
  back = true,
  fallback = '/',
  action,
  brand = false,
  titleAs: TitleTag = 'h1',
  className,
}: {
  title?: string
  back?: boolean
  fallback?: '/' | '/mercado' | '/carrinho' | '/perfil'
  action?: ReactNode
  brand?: boolean
  /** Use 'p' quando a página já tiver o próprio h1. */
  titleAs?: 'h1' | 'p'
  className?: string
}) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('grid h-16 grid-cols-[44px_1fr_44px] items-center gap-2 px-4 lg:hidden', className)}>
      {back ? (
        <Button
          variant="icon-round"
          size="icon-lg"
          aria-label="Voltar"
          onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: fallback }))}
        >
          <ChevronLeft aria-hidden />
        </Button>
      ) : (
        <span />
      )}
      <div className="flex min-w-0 justify-center">
        {brand ? <Logo /> : title ? <TitleTag className="truncate text-title-2 font-bold">{title}</TitleTag> : null}
      </div>
      <div className="flex justify-end">{action}</div>
    </div>
  )
}
