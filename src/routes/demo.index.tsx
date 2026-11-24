import { createFileRoute, Link } from '@tanstack/react-router'
import { Container } from '@/components/kurio/basics'

export const Route = createFileRoute('/demo/')({
  component: () => (
    <Container className="py-10">
      <h1 className="mb-6 text-title-1">Demonstrações internas</h1>
      <ul className="flex flex-col gap-3 text-price underline underline-offset-4">
        <li><Link to="/demo/componentes">Design system: componentes e tokens</Link></li>
        <li><Link to="/demo/conta">Layout de conta</Link></li>
        <li><Link to="/demo/checkout">Layout de checkout</Link></li>
        <li><Link to="/demo/poc">Prova de conceito do CP1 (REST + Socket.IO)</Link></li>
      </ul>
    </Container>
  ),
})
