/**
 * Estrutura global da aplicação.
 *
 * - Link "Pular para o conteúdo" (primeiro item focável).
 * - Header desktop (≥ lg) e navegação inferior mobile (< lg).
 * - A bottom nav aparece só nas telas que a têm no Figma (ex.: Início). Telas com barra de
 *   ação própria no mobile (detalhe, carrinho, pagamento, login) a escondem via
 *   `staticData.hideBottomNav` na rota.
 * - `staticData.chrome = 'minimal'` remove header/rodapé (ex.: login mobile em tela cheia).
 */
import type { ReactNode } from 'react'
import { useMatches } from '@tanstack/react-router'
import { BottomNav } from './BottomNav'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { useCartCount } from '@/features/cart/queries'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Esconde a navegação inferior mobile nesta rota. */
    hideBottomNav?: boolean
    /** 'minimal' = sem header e sem rodapé (tela cheia). */
    chrome?: 'full' | 'minimal'
    /** 'minimal' só abaixo de lg: sem rodapé no mobile (login/cadastro em tela cheia). */
    mobileChrome?: 'full' | 'minimal'
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  // CP9.2 (performance medida): seleciona só as 3 flags como um valor primitivo. Sem `select`, toda
  // mudança de estado do Router (carregando, loader resolvido...) re-renderizava o shell inteiro
  // (header, navegação e rodapé) durante a abertura de cada tela.
  const flags = useMatches({
    select: (matches) =>
      [matches.some((m) => m.staticData?.hideBottomNav), matches.some((m) => m.staticData?.chrome === 'minimal'), matches.some((m) => m.staticData?.mobileChrome === 'minimal')]
        .map(Number)
        .join(''),
  })
  const [hideBottomNav, minimal, mobileMinimal] = [...flags].map((f) => f === '1')
  // Badge do carrinho (CP5): quantidade total vinda do carrinho da API.
  const cartCount = useCartCount()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-xs bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      {!minimal && <SiteHeader cartCount={cartCount} />}
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      {!minimal &&
        (mobileMinimal ? (
          <div className="hidden lg:block">
            <SiteFooter />
          </div>
        ) : (
          <SiteFooter />
        ))}
      {!minimal && !hideBottomNav && <BottomNav cartCount={cartCount} />}
    </div>
  )
}
