/** Layout da prova de conceito do CP1 (mesmo código validado, agora sob /demo/poc). */
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Container } from '@/components/kurio/basics'
import { RealtimePanel } from '@/realtime/RealtimePanel'

export const Route = createFileRoute('/demo/poc')({
  staticData: { hideBottomNav: true },
  component: () => (
    <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <Outlet />
      </div>
      <aside aria-label="Diagnóstico do tempo real">
        <RealtimePanel />
      </aside>
    </Container>
  ),
})
