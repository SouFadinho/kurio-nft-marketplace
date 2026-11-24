# CP1 — Fundação técnica e prova de conceito · Relatório

Data: 2026-11-24. Todos os resultados abaixo vêm de execuções reais. Os logs estão em `planning/evidence/cp1/`.

## 1. Ambiente

| Item | Valor |
|---|---|
| SO | Windows 11 (NT 10.0.26300, x64) |
| Node | **v26.13.1**, instalado em `D:\dowload` (fora do PATH das sessões abertas antes da instalação) |
| npm | 11.20.0 |
| Navegador de teste | Chromium 159 (Chrome for Testing, Playwright build 1255) |
| Disco | **C: com 0 GB livres.** Navegadores, temporários, cache do npm e logs foram direcionados a `D:\emprego\.cache` (`.cache/env.sh`). Nada foi apagado em C: |

## 2. Versões instaladas (lidas de `node_modules`)

| Pacote | Versão | | Pacote | Versão |
|---|---|---|---|---|
| react / react-dom | 19.3.1 | | msw | **2.15.0** |
| typescript | 5.9.3 | | @mswjs/socket.io-binding | 0.2.0 |
| vite | 8.3.8 | | @mswjs/interceptors | 0.39.8 |
| @vitejs/plugin-react | 6.3.0 | | socket.io-client | 4.8.4 |
| @tanstack/react-router | 1.170.46 | | engine.io-client | 6.6.8 |
| @tanstack/router-plugin | 1.169.0 | | socket.io-parser | 4.2.7 |
| @tanstack/react-query | 5.108.4 | | tailwindcss / @tailwindcss/vite | 4.3.5 |
| axios | 1.21.1 | | radix-ui (shadcn) | 1.8.1 |
| zod | 4.6.7 | | shadcn CLI usado | 4.23.0 |
| @playwright/test | 1.65.1 | | lighthouse | 13.6.0 |
| eslint | 10.15.0 | | typescript-eslint | 8.74.0 |

- `npm install` sem `--force` e sem `--legacy-peer-deps`: **0 vulnerabilidades**, `npm ls` sem conflitos de peer.
- Observações:
  - O npm 11 bloqueou o `postinstall` do MSW. O worker foi gerado explicitamente com `npx msw init public` (versão 2.15.0 conferida no arquivo).
  - O `npm ls` lista 4 pacotes `@emnapi/*`/`@napi-rs/*`/`@tybys/*` como *extraneous*: sobras de dependências opcionais WASM; não afetam a execução.

## 3. Resultado dos comandos

| Comando | Resultado | Evidência |
|---|---|---|
| `npm install` | OK (394 pacotes) | — |
| `npx shadcn@4.23.0 add button card` | OK (ver achado 5.6) | `src/components/ui/*` |
| `npm run typecheck` | **OK** (exit 0) após 1 correção (`erasableSyntaxOnly`) | `typecheck.log` |
| `npm run lint` | **OK** (exit 0) | `lint.log` |
| Sonda de lint (arquivo temporário importando `@/mocks/db` e usando `fetch`) | **2 erros detectados**, como esperado | §4 |
| `npm run build` | **OK** (exit 0) | `build.log` |
| `npm run dev` (smoke HTTP) | `/`, `/mockServiceWorker.js` e `/nft/nft-003` → 200 | apenas HTTP; não houve teste de navegador em modo dev |
| `npm run test:e2e` (suíte completa) | **43 passed · 0 failed · 0 skipped**, em **3 rodadas seguidas** | `e2e-full-run-{1,2,3}.log` |
| Repetição do teste de reconexão | **40/40** (20× desktop + 20× mobile) | `reconnect-repeat-20x.log` |
| Controles negativos (portão e heartbeat desligados) | **2/2 falharam, como esperado** | `negative-controls.log` |
| `LH_RUNS=1 npm run audit:lighthouse` | OK: 4 execuções, HTML + JSON + resumo; 2ª validação após corrigir o vazamento do preview → porta liberada | `lighthouse-smoke-*-NAO-OFICIAL.*` |
| **Checkout limpo** (`git clone` do commit `91380dc` + `npm ci` + typecheck + lint + build + `test:e2e`) | **OK: 43/43**. A 1ª tentativa de E2E falhou: porta 4173 ocupada pelo preview vazado do script Lighthouse (achado 5.8) | `clean-checkout.log` |

### 3.1 Contagem de testes (por rodada completa)
| Projeto | Aprovados | Reprovados | Ignorados |
|---|---|---|---|
| unit (eth + EventGuard) | 11 | 0 | 0 |
| desktop-chromium (1440×900) | 16 | 0 | 0 |
| mobile-chromium (390×844, touch) | 16 | 0 | 0 |
| **Total** | **43** | **0** | **0** |

### 3.2 Histórico de falhas (não ocultado)
1. 1ª execução E2E: **15/15 falharam** (socket `desconectado`). Causas: achados 5.2 e 5.3. Log: `e2e-desktop-first-run-FAILED.log`.
2. 1ª rodada completa após a correção: **1 falha** em T6b. Era um defeito do teste: consultava `__kurioMock` antes de o MSW reiniciar após o reload. Corrigido no helper `mock()`.
3. 3 rodadas seguintes: **1 falha intermitente por rodada** em T7/8 (2× mobile, 1× desktop). Era uma falha real de fidelidade do mock (achado 5.5). Corrigida e comprovada com 20× por viewport e mais 3 rodadas limpas.

## 4. Evidências das integrações críticas
`T<n>` = teste em `e2e/poc.spec.ts`. Todos rodam contra **`vite build` + `vite preview`**, com MSW ativo.

| Validação | Como foi comprovada |
|---|---|
| REST via Axios + MSW | T1: `response.fromServiceWorker() === true`, status 200, preço como string, 9 itens renderizados via Query |
| Query + Router | T2 (mutations de login e pedido, consulta do pedido), T11 (loader com acesso direto, refresh, `notFound`, 404 global, guard com `redirect` e retorno ao destino) |
| socket.io-client real | T3/4 e T5: a UI muda **sem reload e sem polling**; o painel registra `nft.updated:apply` e `order.updated:apply` |
| `nft.updated` | T3/4: lista e detalhe atualizados (preço e disponibilidade, versão 2); **após o reload o REST devolve o mesmo valor** (mock consistente) |
| `order.updated` | T5 (pendente → confirmado, hash de tx simulado), T5b (recusado; terminal no servidor: um novo `settle` retorna `null`) |
| Heartbeat | Teste com `page.clock` avançando 65 s: 0 reconexões. **Controle negativo** sem heartbeat: 5 reconexões |
| Autenticação antes de dados | T6c (WebSocket bruto): conexão sem CONNECT recebe só `0{` (nenhum `40` nem `42`); anônima recebe `0{` → `40` → `42`. **Controle negativo** sem portão: chega um `40` prematuro → teste falha |
| Token inválido rejeitado | T6b: `rejected = 1`, `accepted = 0`, sessão local cai para visitante, novo socket anônimo. T6c: sequência `0{` → `44`, nunca `40` nem `42` |
| Isolamento entre usuários | T6: depois de trocar de Ana para Bruno, o servidor só tem `authenticated:usr_bruno`; a liquidação do pedido de Ana não chega a Bruno; um evento mal roteado de propósito é descartado (`rt-foreign = 1`, `rt-applied = 0`); `GET /pedidos/<de Ana>` → "Pedido não encontrado" |
| Duplicados e antigos | T9: `replayLast` (mesmo `eventId`) → `duplicates = 1`; versão antiga → `stale = 1`; o preço não regride. Mais 6 testes unitários do `EventGuard` |
| Reconexão + reconciliação | T7/8: offline → confirmação perdida → online → `reconnections = 1`, `reconciliations = 1`, status `confirmed` **vindo do REST** (`rt-applied = 0`) |
| Recuperação após refresh | T7b: pedido pendente + reload → confirmado; a liquidação agendada sobrevive ao refresh; 1 único pedido |
| Idempotência | T2b: duplo clique → 1 pedido. O conflito 409 (mesma chave com outro conteúdo) está implementado, mas ainda não foi testado |
| Precisão em ETH | Unitários: `0.1+0.2 = 0.3`; carrinho desktop do Figma `26.83` e `26.846`; 18 casas; half-up; entradas inválidas rejeitadas |
| Mocks no build de produção | Toda a suíte roda no build de produção |
| Acesso direto e refresh | T11 (`/nft/nft-003` + reload; rota inexistente; rota protegida) |
| Reset integral | T "reset integral": depois de alterar preço, criar pedido e logar, `?reset=1` restaura preço `1.19`/v1, pedidos `[]`, cenário `default`, e o token antigo deixa de valer |
| Fronteira de arquitetura | Sonda de lint: `no-restricted-imports` (mocks) e `no-restricted-globals` (`fetch`) acusam erro |

## 5. Achados técnicos (com evidência) e decisões

### 5.1 MSW 3 × binding
O `@mswjs/socket.io-binding@0.2.0` declara o peer `msw ^2.10.2`. O MSW 3.0.7 não atende. **Decisão:** `msw` fixado em 2.15.0.

### 5.2 Ordem de import do socket.io-client (causa da 1ª falha)
O `engine.io-client` guarda `globalThis.WebSocket` quando o módulo é avaliado. Com `App` importado estaticamente, o cliente guardava a classe nativa, e o WebSocket ia para a rede (`Unexpected response code: 200`). **Correção:** `main.tsx` importa o `App` dinamicamente **depois** de `startMocks()`.

### 5.3 URL do `ws.link` (outra causa da 1ª falha)
No `msw/lib/core/handlers/WebSocketHandler.mjs`, o método `parse` faz `clientUrl.pathname.replace(/^\/socket.io\//, "/")`, e depois `getCleanUrl` remove a query. A URL comparada vira `ws://<host>/`, então o handler `.../socket.io/` nunca casava (verificado com WebSocket bruto). **Correção:** RegExp `^ws://<host>/(socket\.io/?)?$`, que aceita as duas formas.

### 5.4 Handshake e heartbeat do binding (corrida eliminada)
No `@mswjs/socket.io-binding/src/index.ts`, o binding envia o OPEN **e** o ACK `40{"sid":"test"}` numa microtask, sem ler o CONNECT do cliente, e não envia pings, embora anuncie `pingInterval` de 25 s.
- **Portão:** `client.send` é envolvido **antes** de `toSocketIo()` e descarta qualquer `40` do binding. O ACK passa a ser responsabilidade do servidor simulado, depois de ler o CONNECT:
  - sem token → conexão anônima;
  - token válido → conexão autenticada;
  - token inválido → `44` (CONNECT_ERROR).
- **Sem corrida:** o portão já está instalado quando a microtask roda, e o ACK nunca depende da ordem entre a microtask e a mensagem do cliente.
- **Comprovação:** T6c + controle negativo.
- **Heartbeat:** ping `2` a cada 20 s, comprovado por teste + controle negativo.
- **Eventos:** os públicos só vão para conexões `anonymous`/`authenticated`; os privados só para `authenticated` do dono. Uma conexão `pending` nunca recebe eventos.

### 5.5 Offline simulado (falha intermitente)
Uma sonda mostrou que fechar o WebSocket do MSW antes de abrir dispara apenas `close` (3 ms), sem `error`. Durante a abertura, o `Manager` do socket.io-client escuta só `error`, e esperava o `timeout` de 20 s para tentar de novo. **Correção:** em modo offline, o transporte abre (OPEN), o CONNECT nunca é confirmado e a conexão cai em 50 ms. É uma queda de transporte normal, com reconexão por backoff. Comprovado: 40/40 repetições.

### 5.6 shadcn CLI 4.23 e o pacote `cn`
O CLI gerou `import { cn } from "cn"` e instalou o pacote `cn@0.5.2`. Verifiquei que é **oficial** (mantenedor shadcn, repositório `shadcn-ui/cn`). **Decisão:** manter o utilitário `@/lib/utils` (clsx + tailwind-merge), estável e já presente; `cn` e `@radix-ui/react-slot` (sem uso) foram removidos; `radix-ui` fixado em 1.8.1.

### 5.8 Vazamento do servidor de preview no script Lighthouse
O script encerrava o processo `npm` antes do `taskkill /T`, deixando `cmd` → `vite preview` órfãos na porta 4173. Isso foi descoberto quando o E2E do checkout limpo falhou com "port already used". **Correção:** no Windows, `taskkill /T /F` na árvore primeiro. Revalidado: a porta fica livre depois do script.
Observação da 2ª validação (não oficial, 1 medição): a Performance mobile da Início caiu de 85 para **56** entre duas execuções únicas, o que mostra alta variância na máquina local. Isso reforça a mediana de 3 medições exigida e o risco R-25.

### 5.7 Outras correções
- `erasableSyntaxOnly` proíbe parameter properties → construtor do `EventGuard` ajustado.
- `routeTree.gen.ts` passa a ser **versionado**: o `tsc -b` roda antes de o Vite gerar o arquivo.
- `reuseExistingServer: false` no Playwright: cada execução faz o próprio build, então a evidência sempre corresponde ao código atual.
- Lighthouse: aviso `DEP0190` corrigido (comando como string com `shell: true`).

## 6. Limitações conhecidas
1. **Transporte somente WebSocket** nos mocks. Long-polling não é interceptado por `ws.link`.
2. **Binding sem paridade total:** namespaces e rooms não são suportados (não são usados). O protocolo de handshake é parcialmente reimplementado no mock (§5.4).
3. **Estado do mock por aba:** cada aba tem sua instância de handlers; a persistência em localStorage é lida no boot. A sincronização entre abas (BroadcastChannel) está prevista para o CP6.
4. **`window.__kurioMock`** fica exposto no build de demonstração, porque a camada de mocks é parte da entrega. Ele só aciona o "lado servidor"; nunca toca no cache nem na UI.
5. **Sessão:** o token fica em `sessionStorage`, uma limitação aceita para uma API simulada (em produção seria cookie httpOnly). As senhas do mock usam PBKDF2 com salt, que não é segurança real.
6. **Contadores do painel** reiniciam quando a sessão muda; os testes de isolamento usam as estatísticas do servidor simulado.
7. **Interface temporária:** é só prova de conceito, sem fidelidade ao Figma.
8. **Modo `dev`:** validado só por HTTP; os testes de navegador rodam no build de produção.
9. **Cenários:** 3 implementados (`default`, `manual-settlement`, `payment-rejected`) de 21 previstos.

## 7. Riscos restantes (detalhes em `RISK_REGISTER.md`)
- **R-02b:** os ajustes dependem de detalhes internos do MSW e do binding. Mitigado com versões exatas + testes com controle negativo.
- **R-21/R-25:** Performance mobile. Na medição não oficial da página da PoC, a Início mobile teve Performance 85 e LCP 3,6 s, por causa da cadeia entry → MSW (452 kB) → worker → App. Tratar no CP8, sem simplificações exclusivas para a auditoria.
- **R-23:** disco C: cheio. Precisa de ação sua.
- **R-24:** Node instalado em `D:\dowload`.
- **R-22:** escopo grande para o prazo.
- **R-20:** exportação de assets do Figma.

## 8. Arquitetura implementada — explicação didática

**Ideia central:** a aplicação acredita que fala com um servidor real. Esse servidor é o MSW rodando dentro do próprio navegador. Por isso, o mesmo build funciona em desenvolvimento, nos testes e na demonstração pública.

```
main.tsx ── 1. inicia o MSW (import dinâmico) ── 2. só então importa o App
   │
   ├─ App: QueryClientProvider → RealtimeProvider → RouterProvider
   │
   ├─ REST:  componente → hook TanStack Query → Axios (src/api/http.ts) ─┐
   │                                                                     │ Service Worker
   │                                         MSW handlers (src/mocks) ◄──┘
   │                                                │ lê/escreve
   │                                         db do mock (localStorage)
   │                                                │ cada mudança relevante gera evento
   └─ Tempo real: socket.io-client ◄── WebSocket interceptado ── servidor Socket.IO simulado
                   │                                            (ws.link + binding + portão)
                   └─ EventGuard (dedupe/versão) → applyEvent → cache do TanStack Query → UI
```

1. **Contratos (`src/api/contracts.ts`).** Schemas zod de tudo o que trafega. O cliente valida as respostas e o mock usa os mesmos tipos. Um contrato quebrado falha na hora, não em produção.
2. **Axios (`src/api/http.ts`).** O único caminho para o REST. Coloca o token, transforma erros HTTP em `ApiError` com código estável e, no 401, encerra a sessão local. O lint proíbe `fetch` direto.
3. **TanStack Query.** Guarda o "estado do servidor".
   - Dados privados ficam sob a chave `['me', userId, …]`; ao trocar de usuário, esse prefixo é apagado. É assim que a sessão anterior nunca vaza.
   - Retry só para falhas transitórias; mutations nunca repetem sozinhas.
4. **TanStack Router.** Rotas por arquivo (`src/routes`).
   - O *loader* garante os dados no acesso direto.
   - `beforeLoad` protege rotas privadas e devolve o usuário ao destino depois do login.
   - O parâmetro `redirect` só aceita caminhos internos, para evitar *open redirect*.
5. **Tempo real (`src/realtime`).**
   - Há um socket por sessão: logout ou troca de usuário destrói o socket anterior e remove os listeners.
   - Cada evento passa pelo `EventGuard`, que descarta `eventId` repetido e versão menor ou igual à conhecida. Assim, eventos duplicados ou atrasados nunca regridem o estado.
   - Na reconexão, o cliente não confia nos eventos que podem ter se perdido: pede o estado atual ao REST (reconciliação).
6. **Mock (`src/mocks`).** É o "backend".
   - O `db` é a fonte única de verdade, e as operações em `services.ts` gravam no db **e** emitem o evento correspondente. Por isso REST e Socket.IO nunca divergem.
   - O servidor Socket.IO simulado autentica a conexão antes de enviar qualquer coisa.
   - Os cenários (`scenarios.ts`) são dados, selecionados por `?scenario=`; `?reset=1` restaura o seed.
7. **Dinheiro (`src/lib/eth.ts`).** Valores trafegam como string ("1.19") e são convertidos para inteiros em wei (`bigint`) para as contas. Assim não existe erro de ponto flutuante: `0.1 + 0.2` dá exatamente `0.3`.
8. **Testes.** Cada teste abre um navegador limpo e restaura o seed. Para simular "o servidor mudou algo", o teste aciona `window.__kurioMock`, o lado servidor. A mudança só aparece na tela se atravessar o socket ou o Axios, e é exatamente isso que o teste verifica.

## 9. Fora do escopo do CP1 (conforme instrução)
Telas definitivas; as 12 auditorias Lighthouse oficiais (CP8); deploy e repositório remoto (requerem autorização).
