/**
 * Cenários determinísticos da simulação (MOCK-04 / MOCK-06).
 * Um cenário é DADO, não código espalhado: os handlers consultam a configuração ativa.
 * Selecionado por `?scenario=<nome>` (com `&reset=1` para restaurar o seed) ou por
 * `window.__kurioMock.reset(nome)`.
 */

/** Rotas que podem receber falhas ou latência específicas. */
export type RouteKey =
  | 'nfts.list'
  | 'nfts.detail'
  | 'highlights'
  | 'favorites.read'
  | 'favorites.write'
  | 'auth.login'
  | 'auth.register'
  | 'me.profile.read'
  | 'me.profile.write'
  | 'me.avatar'
  | 'me.password'
  | 'me.wallets.read'
  | 'me.wallets.write'
  | 'cart.read'
  | 'cart.write'
  | 'quote'
  | 'wallet.connect'
  | 'orders.create'
  | 'orders.read'

export interface FailureRule {
  /**
   * 'rejected': recusa de negócio (ex.: a carteira recusou a conexão).
   * '*-after-commit': o servidor GRAVA e depois a resposta se perde (rede) ou demora mais que o
   * timeout do cliente; o retry com a mesma chave de idempotência recupera o mesmo pedido (PEND-02).
   */
  kind: 'http-503' | 'http-500' | 'network' | 'rejected' | 'network-after-commit' | 'timeout-after-commit'
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
  // ---------- CP4: conta e sessão ----------
  /** Falha de conexão no login (mutations não repetem: o erro aparece na primeira tentativa). */
  'auth-offline': { ...base, failures: { 'auth.login': { kind: 'network', times: Infinity } } },
  'avatar-fail': { ...base, failures: { 'me.avatar': { kind: 'http-503', times: Infinity } } },
  'profile-save-fail': { ...base, failures: { 'me.profile.write': { kind: 'http-503', times: Infinity } } },
  /** Leituras privadas ficam retidas até o teste liberar: respostas atrasadas após logout/troca de usuário. */
  'slow-private': { ...base, holdRoutes: ['favorites.read', 'me.wallets.read'] },
  // ---------- CP5: carrinho e checkout ----------
  /** A leitura do carrinho falha até `__kurioMock.recover('cart.read')` (erro + recuperação determinística). */
  'cart-error': { ...base, failures: { 'cart.read': { kind: 'http-503', times: Infinity } } },
  /** Escritas no carrinho falham sempre (o carrinho anterior é preservado). */
  'cart-write-fail': { ...base, failures: { 'cart.write': { kind: 'http-503', times: Infinity } } },
  /** A cotação fica retida até o teste liberar (skeleton do resumo). */
  'hold-quote': { ...base, holdRoutes: ['quote'] },
  /** A primeira conexão de carteira é recusada pelo "usuário" na carteira simulada. */
  'wallet-refused': { ...base, failures: { 'wallet.connect': { kind: 'rejected', times: 1 } } },
  /** A primeira criação de pedido falha ANTES de gravar (503). */
  'order-fail': { ...base, failures: { 'orders.create': { kind: 'http-503', times: 1 } } },
  /** A primeira criação GRAVA o pedido e a resposta se perde (erro de rede). */
  'order-lost-response': { ...base, settlement: 'manual', failures: { 'orders.create': { kind: 'network-after-commit', times: 1 } } },
  /** A primeira criação GRAVA o pedido e responde depois do timeout do cliente. */
  'order-timeout': { ...base, settlement: 'manual', failures: { 'orders.create': { kind: 'timeout-after-commit', times: 1 } } },
  /** Criação lenta (1,5 s) e liquidação manual: estado "enviando" observável e cliques repetidos. */
  'slow-order': { ...base, settlement: 'manual', routeLatency: { 'orders.create': () => 1_500 } },
  // ---------- CP6: pedidos ----------
  /** CP7: liquidação automática em 4 s (troca de líder do cluster DURANTE a liquidação). */
  'slow-settlement': { ...base, settleDelayMs: 4_000 },
  /** Leitura do pedido retida até o teste liberar (carregamento da tela do pedido). */
  'hold-order-read': { ...base, settlement: 'manual', holdRoutes: ['orders.read'] },
  /** Leitura do pedido falha até `recover('orders.read')` (erro + recuperação). */
  'order-read-error': { ...base, settlement: 'manual', failures: { 'orders.read': { kind: 'http-503', times: Infinity } } },
} satisfies Record<string, ScenarioConfig>

export type ScenarioName = keyof typeof SCENARIOS

export function isScenarioName(value: string): value is ScenarioName {
  return Object.hasOwn(SCENARIOS, value)
}
