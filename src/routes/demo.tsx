/**
 * Área de demonstração INTERNA (validação visual e prova de conceito).
 * Não faz parte da navegação pública: nenhum link do site aponta para cá, e a página
 * pede `noindex` aos buscadores. Será removida ou ocultada na entrega final (CP9).
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Container } from '@/components/kurio/basics'

export const Route = createFileRoute('/demo')({
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
