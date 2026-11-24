import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/**
 * Ordem de inicialização (importante):
 *
 * 1. A camada de mocks entra por import dinâmico: só é baixada quando habilitada por
 *    configuração (VITE_ENABLE_MOCKS) e fica fora do chunk principal.
 * 2. O App (e com ele o socket.io-client) só é importado DEPOIS de o MSW iniciar.
 *    O engine.io-client guarda a referência a `globalThis.WebSocket` no momento em que
 *    o módulo é avaliado. Se ele fosse importado antes, guardaria a classe original
 *    e o WebSocket iria para a rede real, sem passar pelo MSW.
 *    (Evidência no CP1: "Error during WebSocket handshake: Unexpected response code: 200".)
 */
async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { App } = await import('./app/App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
