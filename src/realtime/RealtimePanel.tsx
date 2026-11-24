import { useSyncExternalStore } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { diagnostics } from './diagnostics'

const LABELS: Record<string, string> = {
  idle: 'inativo',
  connecting: 'conectando',
  connected: 'conectado',
  disconnected: 'desconectado',
}

/** Painel de diagnóstico da PoC: mostra o que o cliente Socket.IO recebeu e decidiu. */
export function RealtimePanel() {
  const d = useSyncExternalStore(diagnostics.subscribe, diagnostics.get)
  const rows: Array<[string, string, string | number]> = [
    ['rt-reconnections', 'Reconexões', d.reconnections],
    ['rt-reconciliations', 'Reconciliações REST', d.reconciliations],
    ['rt-received', 'Eventos recebidos', d.received],
    ['rt-applied', 'Aplicados', d.applied],
    ['rt-duplicates', 'Duplicados descartados', d.duplicates],
    ['rt-stale', 'Antigos descartados', d.stale],
    ['rt-foreign', 'De outro usuário descartados', d.foreign],
    ['rt-auth-errors', 'Handshakes recusados', d.authErrors],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo real (socket.io-client)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm" aria-live="polite">
          Estado: <strong data-testid="rt-state">{LABELS[d.state]}</strong>
        </p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {rows.map(([id, label, value]) => (
            <div key={id} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd data-testid={id} className="text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 truncate text-xs text-muted-foreground" data-testid="rt-last">
          {d.lastEvent ?? '—'}
        </p>
      </CardContent>
    </Card>
  )
}
