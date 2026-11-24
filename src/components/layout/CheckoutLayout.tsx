/**
 * Layout de checkout (Figma: Desktop / Carrinho e Pagamento; Mobile / Carrinho e Pagamento).
 *
 * DESKTOP: breadcrumb ("Início / Mercado / …"), conteúdo principal à esquerda e resumo à
 * direita (coluna de 360px, fixa ao rolar).
 * MOBILE: barra com "voltar" + título centralizado; resumo abaixo do conteúdo; ação principal
 * fixa na base da tela ("Conectar e finalizar", "Confirmar compra"), como no Figma.
 * O conteúdo reserva espaço para a barra fixa (nada fica escondido atrás dela).
 */
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Container } from '@/components/kurio/basics'
import { MobileTopBar } from './MobileTopBar'

export type Crumb = { label: string; to?: '/' | '/mercado' | '/carrinho' }

export function CheckoutLayout({
  title,
  crumbs,
  main,
  summary,
  mobileAction,
  backTo = '/',
}: {
  title: string
  crumbs: Crumb[]
  main: ReactNode
  summary: ReactNode
  /** Ação principal fixa no mobile. */
  mobileAction?: ReactNode
  backTo?: '/' | '/mercado' | '/carrinho'
}) {
  return (
    <>
      <MobileTopBar title={title} titleAs="p" fallback={backTo} />
      <Container className="pb-8 lg:pt-6">
        <nav aria-label="Trilha de navegação" className="mb-4 hidden lg:block">
          <ol className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.label} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {c.to ? (
                  <Link to={c.to} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="sr-only lg:not-sr-only lg:mb-4 lg:text-title-2">{title}</h1>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10">
          <div className="min-w-0">{main}</div>
          <aside aria-label="Resumo" className="lg:sticky lg:top-[calc(var(--spacing-header)+1.5rem)]">
            {summary}
          </aside>
        </div>
      </Container>
      {mobileAction && (
        <>
          <div aria-hidden className="h-24 lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
            {mobileAction}
          </div>
        </>
      )}
    </>
  )
}
