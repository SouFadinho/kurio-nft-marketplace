/**
 * Área de demonstração INTERNA (validação visual e prova de conceito).
 * Não faz parte da navegação pública: nenhum link do site aponta para cá, e a página
 * pede `noindex` aos buscadores.
 *
 * CP9: ISOLADA do build público. Só existe com `VITE_DEMO_ROUTES=true`, definido apenas no build
 * dos testes (playwright.config.ts → webServer.env), para manter a cobertura da PoC (CP1) e da
 * galeria de componentes (CP2). No build público (Vercel, Lighthouse) `/demo/*` responde com a
 * página 404 do app e os chunks dessas páginas nunca são carregados.
 */
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Container } from '@/components/kurio/basics'

const DEMO_ROUTES_ENABLED = import.meta.env.VITE_DEMO_ROUTES === 'true'

export const Route = createFileRoute('/demo')({
  beforeLoad: () => {
    if (!DEMO_ROUTES_ENABLED) throw notFound()
  },
  component: DemoLayout,
})

function DemoLayout() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  return (
    <>
      <div className="border-b border-warning/40 bg-warning/10">
        <Container className="py-2 text-caption text-warning">Área interna de demonstração · fora da navegação pública</Container>
      </div>
      <Outlet />
    </>
  )
}
