/**
 * Cenários determinísticos da simulação (MOCK-04 / MOCK-06).
 * Um cenário é DADO, não código espalhado: os handlers consultam a configuração ativa.
 * Selecionado por `?scenario=<nome>` (com `&reset=1` para restaurar o seed) ou por
 * `window.__kurioMock.reset(nome)`.
 */

/** Rotas que podem receber falhas ou latência específicas. */
export type RouteKey = 'nfts.list' | 'nfts.detail' | 'highlights' | 'favorites.read' | 'favorites.write'

export interface FailureRule {
  kind: 'http-503' | 'http-500' | 'network'
  /** Quantas requisições falham antes de voltar ao normal (Infinity = sempre). */
  times: number
}

export interface ScenarioConfig {
  /** Latência fixa (ms) aplicada a todas as respostas REST. Fixa = reproduzível. */
  latencyMs: number
  /** 'auto': o pedido é liquidado após settleDelayMs. 'manual': só via controle do mock. */
  settlement: 'auto' | 'manual'
  settleDelayMs: number
  settleResult: 'confirmed' | 'rejected'
  /** Latência adicional por rota, calculada a partir da URL (respostas fora de ordem). */
  routeLatency?: Partial<Record<RouteKey, (url: URL) => number>>
  failures?: Partial<Record<RouteKey, FailureRule>>
  /** Catálogo sem nenhum NFT (resultado vazio). */
  emptyCatalog?: boolean
  /** Imagens de NFT respondem 404 (falha ao carregar imagem). */
  brokenImages?: boolean
  /** Respostas destas rotas ficam RETIDAS até `__kurioMock.release(rota)` (testes determinísticos de carregamento). */
  holdRoutes?: RouteKey[]
  /** A listagem lê o banco ANTES de ser retida: simula uma resposta já em trânsito (dados antigos). */
  snapshotBeforeHold?: boolean
}

const base = { latencyMs: 120, settlement: 'auto', settleDelayMs: 1_500, settleResult: 'confirmed' } as const satisfies ScenarioConfig

export const SCENARIOS = {
  default: base,
  'payment-rejected': { ...base, settleResult: 'rejected' },
  'manual-settlement': { latencyMs: 0, settlement: 'manual', settleDelayMs: 0, settleResult: 'confirmed' },
  /** Carregamento lento: evidencia skeletons. */
  slow: { ...base, latencyMs: 1_500 },
  /** Busca: termos curtos respondem MAIS devagar que termos longos (respostas fora de ordem). */
  'out-of-order': {
    ...base,
    latencyMs: 0,
    routeLatency: { 'nfts.list': (url) => Math.max(0, 1_600 - (url.searchParams.get('q')?.length ?? 0) * 400) },
  },
  // 3 falhas = a tentativa inicial + os 2 retries automáticos do TanStack Query para erros
  // transitórios. Assim o estado de erro aparece e o botão "Tentar novamente" recupera.
  'catalog-error': { ...base, failures: { 'nfts.list': { kind: 'http-503', times: 3 } } },
  'catalog-offline': { ...base, failures: { 'nfts.list': { kind: 'network', times: 3 } } },
  'detail-error': { ...base, failures: { 'nfts.detail': { kind: 'http-500', times: 3 } } },
  /** A listagem só responde quando o teste liberar: skeletons sem depender de tempo. */
  'hold-catalog': { ...base, holdRoutes: ['nfts.list'] },
  /** Corrida REST × evento: a resposta antiga chega DEPOIS do nft.updated (teste da correção do CP3). */
  'stale-in-flight': { ...base, holdRoutes: ['nfts.list'], snapshotBeforeHold: true },
  empty: { ...base, emptyCatalog: true },
  'broken-images': { ...base, brokenImages: true },
  'favorite-fail': { ...base, failures: { 'favorites.write': { kind: 'http-503', times: Infinity } } },
} satisfies Record<string, ScenarioConfig>

export type ScenarioName = keyof typeof SCENARIOS

export function isScenarioName(value: string): value is ScenarioName {
  return Object.hasOwn(SCENARIOS, value)
}
