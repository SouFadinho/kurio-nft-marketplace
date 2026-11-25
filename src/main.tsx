import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Roboto Mono variável, self-hosted (arquivos woff2 empacotados pelo Vite; sem CDN).
import '@fontsource-variable/roboto-mono'
import './index.css'

/**
 * Ordem de inicialização (importante):
 *
 * 1. A camada de mocks entra por import dinâmico: só é baixada quando habilitada por
 *    configuração (VITE_ENABLE_MOCKS) e fica fora do chunk principal.
 * 2. O socket.io-client só pode ser AVALIADO depois de o MSW iniciar: o engine.io-client guarda
 *    a referência a `globalThis.WebSocket` quando o módulo é avaliado; antes do MSW, guardaria a
 *    classe original e o WebSocket iria para a rede real (evidência no CP1: "Unexpected response
 *    code: 200").
 * 3. CP8 (performance, medido no Lighthouse): o App é BAIXADO em paralelo com a camada de mocks.
 *    Isso é seguro porque o App não importa mais o socket.io-client estaticamente: ele é carregado
 *    sob demanda pelo RealtimeProvider, depois da primeira renderização (já com o MSW ativo).
 *    A renderização continua esperando o MSW: nenhuma requisição sai antes da interceptação.
 */
async function bootstrap() {
  const app = import('./app/App')
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { App } = await app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
