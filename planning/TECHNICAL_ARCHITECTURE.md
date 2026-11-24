# TECHNICAL_ARCHITECTURE — KURIO

Status: revisada no CP0.1 com base no `CHALLENGE.md` oficial. Onde houver conflito, as seções marcadas **(CP0.1)** prevalecem sobre o texto do CP0. As versões efetivamente instaladas estão no relatório do CP1 (`planning/CP1_REPORT.md`).

## 0. Mudanças do CP0.1 (prevalecem)
1. **Cotação é um recurso** (`POST /api/quotes`). O resumo do carrinho e do pagamento vem dela. O pedido referencia `quoteId` + `quoteVersion`; uma cotação desatualizada gera `409 QUOTE_STALE`, e a UI pede nova confirmação. A cotação da API é a autoridade financeira.
2. **Estados do pedido:** `pending → confirmed | rejected`. Os dois últimos são terminais. A confirmação só é exibida com `confirmed` vindo do mock (REST ou evento).
3. **Eventos obrigatórios:** `nft.updated` e `order.updated`, no envelope `{ eventId, type, resource: { type, id }, version, occurredAt, userId?, data }`. A ordenação usa a **versão do recurso** (não um `seq` por pedido). Regra: ignorar se o `eventId` já foi visto ou se `version <= versão conhecida`.
4. **Reset de cenário integral:** `?scenario=<nome>&reset=1` ou `window.__kurio.reset(nome)` restaura o db do seed daquele cenário.
5. **Pelo menos 2 usuários fictícios** no seed (`ana@kurio.test`, `bruno@kurio.test`). As senhas ficam documentadas no README e são guardadas no mock como hash PBKDF2 com salt.
6. **Socket isolado por sessão:** o client cria um socket novo a cada login (handshake com token) e o destrói no logout. O mock só entrega eventos privados (`order.updated`) à conexão do dono. O client também descarta eventos cujo `userId` difere da sessão atual.
7. **Carteira:** "conectar" é simulado em `POST /api/wallets/:id/connect`, com cenários `wallet-approve`, `wallet-reject` e `wallet-disconnect`.
8. **Entregáveis finais:** `README.md` e `ARCHITECTURE.md` na raiz (CP9). Lighthouse com 12 medições (`scripts/lighthouse.mjs`).
9. **Responsividade:** validar em 390, 768 e 1440 px. Breakpoints: `< 768` mobile; `768–1279` tablet (layout mobile ampliado, grid de 3 colunas, filtros em drawer); `≥ 1280` desktop (layout do Figma 1440).

## 1. Visão geral

SPA em React com Vite. Todo o "backend" é simulado no navegador pelo **MSW** (REST via Service Worker e WebSocket via interceptação da classe `WebSocket`). Assim, o mesmo build funciona em dev, nos testes E2E e no deploy público.

```
┌───────────── Browser ───────────────────────────────────────────────┐
│ React UI (shadcn/ui + Tailwind)                                      │
│   │ rotas tipadas (TanStack Router, loaders → ensureQueryData)      │
│   ▼                                                                  │
│ Features (catalog, auth, cart, checkout, orders, account)            │
│   │ hooks useQuery/useMutation (TanStack Query)                      │
│   ▼                                                                  │
│ api/ (Axios instance + interceptors)     realtime/ (socket.io-client)│
│   │ HTTP                                      │ WebSocket            │
│ ══╪═══════════════════════════════════════════╪══════════════════════│
│   ▼ MSW http handlers (Service Worker)        ▼ MSW ws.link + toSocketIo
│ mocks/ db (estado persistido em localStorage, seed determinístico)   │
│ mocks/ scenarios (falhas determinísticas controladas por flag)       │
└──────────────────────────────────────────────────────────────────────┘
```

Princípio central: **a UI nunca simula sucesso.** Toda confirmação (login, carrinho, pedido, status) vem de uma resposta HTTP ou de um evento Socket.IO produzido pela camada de mock. Se o mock falha, a UI mostra a falha.

## 2. Stack e versões

| Tecnologia | Versão alvo | Uso efetivo | Nota |
|---|---|---|---|
| React | 19.x | UI | — |
| TypeScript | **5.9.x** (não 7.x) | Tipagem estrita | O TS 7 (compilador nativo) é recente; ESLint e plugins podem não suportar. Decisão a revalidar no CP1 |
| Vite | 8.x | Build/dev | `@vitejs/plugin-react@6` exige Vite 8. **Fallback:** Vite 7 + plugin-react 5 se algo quebrar |
| TanStack Router | 1.170.x + `@tanstack/router-plugin` | Rotas por arquivo, search params tipados, guards (`beforeLoad`), loaders | — |
| TanStack Query | 5.108.x | Cache do servidor, mutations otimistas, invalidação | — |
| Axios | 1.x | Cliente HTTP único com interceptors | — |
| REST | — | Contrato definido em `src/api/contracts.ts` (ver §6) | O contrato é proposto por nós, porque não há enunciado |
| socket.io-client | 4.8.x | Status de pedidos e eventos de catálogo em tempo real | — |
| Tailwind CSS | 4.x + `@tailwindcss/vite` | Tokens via `@theme` | — |
| shadcn/ui | CLI 4.x | Componentes base (Radix) com o tema KURIO | — |
| MSW | **2.15.x (fixado em 2.x)** | Mock REST e WebSocket | **Crítico:** `@mswjs/socket.io-binding@0.2.0` declara `peerDependencies: { msw: "^2.10.2" }`. O `msw@latest` é 3.0.7 e **não satisfaz** esse peer |
| @mswjs/socket.io-binding | 0.2.0 | Codifica e decodifica o protocolo Socket.IO sobre `ws.link` | Última publicação em 2025-06-13; README avisa que rooms, namespaces e broadcast podem faltar |
| Playwright | 1.65.x | E2E + `toHaveScreenshot` | — |
| Lighthouse | `@lhci/cli` 0.16.x | Auditoria com assertions no CI e localmente | — |
| Validação | `zod` | Schemas de formulário e de payload | Decisão nossa (não obrigatória) |
| Formulários | `react-hook-form` + `@hookform/resolvers` | Integração com o `Form` do shadcn | Decisão nossa |

## 3. Compatibilidade MSW × socket.io-client × @mswjs/socket.io-binding

> **(CP1) Resultado verificado.** A integração funciona com o binding 0.2.0, com cinco ajustes. Cada um tem evidência (código-fonte lido e/ou teste com controle negativo). Detalhes em `planning/CP1_REPORT.md` §5.
> 1. `msw` fixado em 2.15.0 (o peer do binding é `^2.10.2`; o MSW 3.x é incompatível).
> 2. **Ordem de import:** o `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado. O App é importado dinamicamente **depois** de `startMocks()`.
> 3. **URL do `ws.link`:** o MSW 2.15 remove o prefixo `/socket.io/` e a query antes de comparar; o handler usa a RegExp `^ws://<host>/(socket\.io/?)?$`.
> 4. **Handshake:** o binding confirma o CONNECT (`40`) antes de o cliente enviar o token. Um "portão" em `client.send` descarta esse ACK; o servidor simulado envia `40` (válido ou anônimo) ou `44` (token inválido) só depois de validar.
> 5. **Heartbeat:** o binding não envia pings; o servidor simulado envia `2` a cada 20 s.
> 6. **Offline simulado:** fechar o WebSocket do MSW antes de abrir dispara só `close` (sem `error`), e o socket.io-client ficaria preso até o timeout de 20 s. Offline = abre o transporte e cai em 50 ms, sem confirmar o CONNECT.
> Transporte: somente WebSocket (`transports: ['websocket']`). Limitações: sem namespaces/rooms no binding; o estado do mock é por aba.

### 3.1 Fatos verificados (npm, 2026-11-24)
- `@mswjs/socket.io-binding@0.2.0` depende de `@mswjs/interceptors ^0.39.2`, `engine.io-parser ^5.2.3` e `socket.io-parser ^4.2.4`, com peer `msw ^2.10.2`.
- Uso documentado: `const io = toSocketIo(connection)` dentro de `ws.link(url).addEventListener('connection', …)`, com `io.client.on(...)` e `io.client.emit(...)`.
- O README declara limitações: rooms, namespaces e broadcasting não têm paridade total.

### 3.2 Pontos que **precisam de spike** (não verificados, conhecimento prévio)
1. **Transporte:** o `socket.io-client` começa com HTTP long-polling e depois faz upgrade. A interceptação de WebSocket do MSW só cobre WebSocket. → Configurar `io(url, { transports: ['websocket'] })`. Validar se o handshake (`0{…}` → `40`) funciona apenas com WebSocket.
2. **Autenticação no handshake:** o `auth` do socket.io vai no pacote CONNECT (`40{"token":…}`). Verificar se o binding expõe esse payload. Fallback: evento `authenticate` emitido logo após o `connect`, com resposta `auth:ok`/`auth:error`. **Nunca** colocar o token na query string.
3. **Reconexão:** verificar se `connection.client.close()` ou `connection.server` provoca `disconnect` e a reconexão automática do client. Necessário para cenários determinísticos de queda.
4. **Ambientes:** a interceptação de WebSocket do MSW 2 corre **na página**, então deve funcionar em dev, Playwright e produção estática. Confirmar no build de produção.
5. **Vários clientes ou abas:** cada aba tem a própria instância de handlers. Eventos "de servidor" que afetam outras abas (ex.: um item vendido) precisam de `BroadcastChannel` entre as instâncias de mock.

### 3.3 Plano de contingência (sem trocar tecnologia)
Se o binding falhar em algum ponto, implementar um adaptador próprio, `mocks/realtime/socketIoServer.ts`, sobre `ws.link` usando `engine.io-parser` e `socket.io-parser` (as mesmas dependências do binding) para codificar os pacotes. A aplicação continua usando `socket.io-client` sem mudanças. Custo estimado: 3–4 h. Por isso o spike fica no **início do CP1**.

## 4. Estrutura de pastas

```
src/
  app/            providers (QueryClient, Router, Theme), router.tsx, queryClient.ts
  routes/         arquivos do TanStack Router (file-based)
  features/
    catalog/      api.ts (queries), components/, hooks/
    nft/
    auth/
    account/      perfil, carteiras
    cart/
    checkout/
    orders/
  realtime/       socket.ts (singleton), useRealtime.ts, eventProcessor.ts
  api/            http.ts (Axios), contracts.ts (tipos + zod), errors.ts
  lib/            eth.ts (decimal), idempotency.ts, storage.ts, format.ts
  components/ui/  shadcn
  components/     layout (Header, BottomNav, Footer), NftCard, …
  mocks/
    browser.ts    setupWorker + handlers
    db/           schema, seed.ts (determinístico), persistence.ts
    handlers/     auth.ts, catalog.ts, cart.ts, orders.ts
    realtime/     socket handlers, orderLifecycle.ts
    scenarios.ts  registro de cenários de falha
tests/
  e2e/            *.spec.ts
  visual/         *.visual.spec.ts + snapshots
  unit/           (Vitest opcional para eth.ts e eventProcessor)
lighthouserc.cjs
```

## 5. Rotas (TanStack Router)

| Rota | Tela | Guard |
|---|---|---|
| `/` | Início (search params: `tab`, `collection`, `minPrice`, `maxPrice`, `network`, `sort`, `page`) | — |
| `/mercado` | Mesmo catálogo (breadcrumb "Início / Mercado") | — |
| `/nft/$nftId` | Detalhe | — |
| `/login`, `/cadastro` | Desktop: `Dialog` sobre a Home. Mobile: página inteira | Só para visitante (redireciona se autenticado) |
| `/carrinho` | Carrinho | — (carrinho de visitante permitido) |
| `/pagamento` | Checkout | `beforeLoad` exige sessão, com `redirect` para `/login?redirect=/pagamento` |
| `/perfil` (layout) → `/perfil/dados`, `/perfil/carteiras`, `/perfil/atividade` (pedidos) | Conta | Exige sessão |
| `/pedidos/$orderId` | Status do pedido em tempo real (**sem referência visual**) | Exige sessão |
| `/criadores`, `/aprenda` | Sem referência: decisão pendente (ver Risk Register) | — |

O search param `redirect` é validado (só caminhos internos) para evitar open redirect.

## 6. Contrato REST (proposto)

Base: `/api`. Todos os valores monetários são **strings decimais** (`"1.19"`).

| Método | Caminho | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria usuário e devolve `{ user, accessToken }` |
| POST | `/api/auth/login` | Devolve `{ user, accessToken }`; erro 401 genérico |
| POST | `/api/auth/logout` | Invalida a sessão no mock |
| GET | `/api/auth/me` | Sessão atual |
| GET | `/api/nfts?…` | Lista paginada `{ items, page, pageSize, total }` |
| GET | `/api/nfts/:id` | Detalhe com edições e estoque |
| GET | `/api/collections` | Coleções e contagens |
| GET/PUT | `/api/me/profile` | Perfil |
| GET/POST/PUT/DELETE | `/api/me/wallets` | Carteiras |
| GET | `/api/cart` | `{ items, version, totals }` |
| PUT | `/api/cart/items/:nftId` | `{ editionId, quantity }`, header `If-Match: <version>` |
| DELETE | `/api/cart/items/:nftId` | Remove item |
| POST | `/api/cart/merge` | Mescla o carrinho de visitante após o login |
| POST/DELETE | `/api/cart/coupon` | Aplica ou remove cupom (`COUPON_INVALID`, `COUPON_EXPIRED`) |
| GET/PUT/DELETE | `/api/favorites`, `/api/favorites/:nftId` | Favoritos do usuário **(CP0.1)** |
| POST | `/api/quotes` | Cotação: disponibilidade, cupom, desconto, taxa da rede, total, `quoteId`, `version`, `expiresAt` **(CP0.1)** |
| POST | `/api/wallets/:id/connect` | Conexão simulada (aceita, recusa, desconecta) **(CP0.1)** |
| POST | `/api/orders` | Header `Idempotency-Key`; corpo `{ quoteId, quoteVersion, walletId, network, collector }` |
| GET | `/api/orders/:id` | Estado autoritativo (`status`, `version`) + `receipt` (snapshot) |
| PUT | `/api/me/avatar`, `/api/me/password` | Avatar (data URL ≤ 512 KB no mock) e senha **(CP0.1)** |
| POST/GET | `/__mocks/scenario`, `/__mocks/emit` | **Somente controle do mock** (usado por testes e pelo painel de debug); nunca chamado pela UI de negócio **(CP0.1)** |

Erros: `{ code, message, details? }` com códigos estáveis (`CART_VERSION_CONFLICT`, `PRICE_CHANGED`, `OUT_OF_STOCK`, `IDEMPOTENCY_KEY_REUSED`, `UNAUTHORIZED`, …). O Axios mapeia isso em `ApiError` tipado.

## 7. Estratégias

### 7.1 Autenticação e isolamento de sessões
- O mock emite um token opaco (aleatório), não um JWT real. O access token fica **em memória**, espelhado em `sessionStorage` para sobreviver a reload. **Limitação documentada:** em produção real seria um cookie `httpOnly`. Aqui, tudo é mock e não há credencial real.
- O interceptor do Axios injeta `Authorization`. Em `401`, limpa a sessão e redireciona para `/login?redirect=…`.
- **Isolamento:** as query keys de dados do usuário incluem `userId` (`['cart', userId]`). No logout: `queryClient.clear()`, `socket.disconnect()`, limpeza do armazenamento do usuário e `BroadcastChannel('kurio-auth')` avisa as outras abas. No login: o socket reconecta com o novo token e o carrinho de visitante é mesclado via `/cart/merge`.
- Senhas no mock: guardadas como hash SHA-256 com salt (Web Crypto). Isso é só para não deixar texto puro no `localStorage` do mock; **não é segurança real**, e a documentação dirá isso.
- Login social (Google/Facebook): aparece no design, mas não há credenciais. Proposta: botões visíveis que abrem um aviso "indisponível na demo", sem simular sucesso. **Decisão a confirmar.**

### 7.2 Persistência e recuperação do carrinho
- Fonte de verdade: o servidor (mock) para usuários autenticados; para visitantes, o `localStorage` (`kurio:cart:guest`) com schema versionado e validado por zod. Dados corrompidos são descartados de forma segura.
- O carrinho tem `version` (inteiro). Cada mutation envia `If-Match`. Um `409 CART_VERSION_CONFLICT` faz o client buscar o carrinho de novo e mostrar um aviso.
- Recuperação: no boot, `GET /api/cart` (autenticado) ou hidratação local (visitante). Depois do login, merge: soma quantidades, limita ao estoque e mostra ao usuário os itens ajustados.
- Estado do checkout em andamento (`idempotencyKey`, `cartVersion`) persistido em `sessionStorage` para sobreviver a reload durante o pagamento.

### 7.3 Precisão decimal em ETH
- `lib/eth.ts`: converte as strings decimais em **`bigint` de wei (10^18)**. Soma, multiplicação por quantidade e desconto são feitos em inteiros, com formatação na saída. Nenhuma operação monetária usa `number`.
- Arredondamento: regra explícita (half-up) só na formatação para exibição, com casas decimais configuráveis (padrão de 2 a 4, como no Figma: "8.936 ETH").
- O backend (mock) recalcula o total. O client envia `expectedTotal`; se divergir, a resposta é `409 PRICE_CHANGED` com os novos valores e a UI pede uma nova confirmação.
- Testes unitários com casos de borda (0.1 + 0.2, 18 casas, quantidades altas).
- Alternativa considerada: `decimal.js`. Rejeitada para evitar dependência; `bigint` é mais simples de explicar.

### 7.4 Idempotência de pedidos
- Ao entrar em `/pagamento`, o client gera `idempotencyKey = crypto.randomUUID()` vinculada a `cartVersion`. A mesma chave é usada em retries, duplo clique e reload. A chave só é regenerada se o carrinho mudar.
- Mock: tabela `idempotency[key] = { requestHash, response }`. Mesma chave e mesmo hash → devolve **a mesma resposta** (o mesmo `orderId`). Mesma chave com hash diferente → `422 IDEMPOTENCY_KEY_REUSED`.
- UI: botão desabilitado durante a mutation, mas a garantia real está no servidor.

### 7.5 Atualizações otimistas e rollback
- Aplicadas em: quantidade do carrinho, remoção de item e favoritos. **Não** são aplicadas na criação de pedido nem no login (operações críticas esperam a confirmação do servidor).
- Padrão TanStack Query: `onMutate` (cancelQueries + snapshot + setQueryData) → `onError` (restaura o snapshot + toast com o erro real) → `onSettled` (invalidate).
- Mutations do mesmo item são serializadas com `scope: { id: 'cart' }` (TanStack Query v5) para evitar corrida de versões.

### 7.6 Eventos duplicados e fora de ordem
> **(CP0.1)** O texto abaixo vale com uma troca: `seq` por pedido passa a ser `version` por recurso (`nft` ou `order`). O guard compara com a versão no cache, ou com a última versão aplicada, e ignora `<=`. Os estados terminais (`confirmed`/`rejected`) nunca são sobrescritos.

Formato original do CP0: `{ eventId, type, orderId, seq, status, occurredAt }`, com `seq` monotônico por pedido.
`realtime/eventProcessor.ts` (função pura, testável):
1. `eventId` já visto (LRU com cerca de 500 IDs) → descarta.
2. `seq <= lastSeq[orderId]` → descarta (atrasado).
3. `seq === lastSeq + 1` → aplica no cache (`setQueryData(['order', id])`).
4. `seq > lastSeq + 1` (lacuna) → não aplica parcialmente; **reconcilia via REST** (`invalidateQueries(['order', id])`).
5. A máquina de estados do pedido (`pending → confirming → minted → completed` | `failed`) recusa transições inválidas mesmo com `seq` correto.

### 7.7 Reconexão e reconciliação REST
- `socket.io-client` com reconexão automática e backoff exponencial padrão.
- No evento `connect` (inclusive reconexões): `invalidateQueries({ queryKey: ['orders'] })` e no detalhe aberto. O REST devolve `lastSeq`, que reinicia o processador.
- `visibilitychange` (aba volta ao foco) também reconcilia. Indicador discreto na UI quando o socket está desconectado (não bloqueia a navegação).
- Fallback: enquanto o socket estiver desconectado, a tela de pedido faz polling do REST (`refetchInterval` de 5 s, apenas nessa condição).

### 7.8 Cenários determinísticos de falha
> **(CP0.1)** Catálogo mínimo de cenários exigido pelo §6: `default`, `empty`, `slow`, `jitter` (PRNG com seed), `out-of-order`, `offline`, `http-500`, `http-503`, `session-expired`, `forbidden`, `register-conflict`, `validation-error`, `coupon-invalid`, `coupon-expired`, `price-changed-during-checkout`, `edition-sold-out-during-checkout`, `order-timeout-after-create`, `payment-confirmed` (padrão), `payment-rejected`, `wallet-reject`, `wallet-disconnect`. O cenário e o db são persistidos em `localStorage` (`kurio:mock:*`); o reset recria o db a partir do seed. A lista abaixo, do CP0, foi absorvida por esta.

- `mocks/scenarios.ts` define cenários nomeados: `checkout-500-once`, `checkout-timeout`, `price-changed`, `out-of-stock`, `cart-version-conflict`, `ws-duplicate-events`, `ws-out-of-order`, `ws-gap`, `ws-disconnect-mid-order`, `login-401`, `slow-network`.
- Ativação: query `?scenario=a,b`, persistida em `sessionStorage`. No Playwright, via `page.addInitScript`. Em produção também (para demonstrar), com painel de debug acionado por `?debug=1`.
- **Sem aleatoriedade.** Atrasos fixos, seed fixo e relógio injetável no ciclo de vida do pedido (`orderLifecycle` usa uma lista de passos com delays configuráveis; nos testes, delays de ~50 ms).
- O handler aplica a falha **no mock**. A UI reage à resposta real; não existe "if scenario" no código de UI.

### 7.9 Testes E2E e regressão visual
- Playwright com projetos `desktop-chromium` (1440×900) e `mobile-chromium` (375×812, `isMobile`). Firefox e WebKit opcionais se o tempo permitir.
- `webServer`: `vite build && vite preview` com mocks ativos, para testar o **mesmo artefato** do deploy.
- Fluxos E2E: navegar no catálogo e filtrar; detalhe e adicionar ao carrinho; carrinho persiste após reload; login, merge e logout com isolamento (usuário B não vê o carrinho de A); checkout feliz com status ao vivo até `completed`; retry de checkout após 500 sem duplicar pedido (mesma chave); conflito de preço; eventos duplicados, fora de ordem e com lacuna; reconexão com reconciliação; rotas protegidas.
- Visual: `toHaveScreenshot` por tela e viewport, com animações desativadas, fontes carregadas (`document.fonts.ready`), dados de seed fixos e máscara em elementos voláteis. **Os baselines são gerados no container oficial do Playwright (Linux)** para evitar diferenças de fonte entre Windows e Linux.
- Acessibilidade: `@axe-core/playwright` nas telas principais (decisão nossa).
- Unitários (Vitest, opcional): `eth.ts`, `eventProcessor.ts`, `idempotency` do mock.

### 7.10 Deploy público com mocks
- Build estático; o MSW inicia em `main.tsx` antes do render quando `VITE_ENABLE_MOCKS=true` (padrão no deploy). `public/mockServiceWorker.js` é servido na raiz.
- Hospedagem estática com fallback de SPA (Vercel, Netlify ou Cloudflare Pages). **Só com autorização.**
- Impacto no Lighthouse: o registro do worker atrasa o primeiro render. Mitigações legítimas: importar MSW com `import()` dinâmico (fora do bundle principal), pré-carregar a fonte, imagens responsivas AVIF/WebP com `width`/`height` e lazy loading abaixo da dobra, além de code-splitting por rota. **Não** vamos desligar o MSW só para a medição: o relatório mede o app como publicado.
- Limitação a documentar: dados ficam no `localStorage` de cada visitante; não há backend compartilhado.

## 8. Qualidade e convenções
ESLint + Prettier; `strict: true`; aliases `@/`; commits pequenos por checkpoint; README do projeto com: como rodar, arquitetura, cenários, decisões e limitações.
