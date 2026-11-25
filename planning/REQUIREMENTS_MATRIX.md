# REQUIREMENTS_MATRIX — KURIO

Rastreabilidade: **Requisito (ID → `CHALLENGE.md`) → Implementação → Teste → Evidência → Status**.
IDs definidos em `CHALLENGE_REQUIREMENTS.md`. `D` = decisão do candidato ou técnica.

## Status (desde o CP1)
| Status | Significado |
|---|---|
| `PENDENTE` | Não implementado |
| `IMPLEMENTADO, NÃO VALIDADO` | Código existe, mas nenhum teste executado o comprova |
| `VALIDADO` | Teste executado com sucesso, com log versionado em `planning/evidence/` |
| `FALHOU` | Teste executado e reprovado (não corrigido) |

**Escopo da validação no CP1:** mecanismos provados na **prova de conceito**, cuja interface é temporária. Quando as telas definitivas forem construídas, a validação é repetida pelos testes do CP7 (coluna "Revalidar").

**Revisão integral no CP9 (25/11/2026):** cada requisito de `CHALLENGE.md` foi confrontado com o código e as evidências; os status antigos (§1, §3, §4, §5, §6) foram atualizados. Evidência final: `planning/evidence/cp9-tests/` (checkout limpo, suíte completa, auditoria de dependências) e `planning/evidence/cp9-perf/` (Lighthouse final). "VALIDADO" significa teste executado e aprovado; não significa conformidade plena com o Figma nem com a WCAG.

**Evidências do CP1** (`planning/evidence/cp1/`):
- `e2e-full-run-{1,2,3}.log`: 3 rodadas completas, 43/43 cada (11 unitários + 16 desktop + 16 mobile).
- `negative-controls.log`: portão do handshake e heartbeat desligados → os testes falham, como esperado.
- `reconnect-repeat-20x.log`: teste de reconexão 20× por viewport, 40/40.
- `e2e-desktop-first-run-FAILED.log`: primeira execução, 15/15 falhando (histórico da falha corrigida).
- `unit.log`, `typecheck.log`, `lint.log`, `build.log`, `lighthouse-smoke-*-NAO-OFICIAL.*`.

Abreviação: `T<n>` = teste `<n>.` de `e2e/poc.spec.ts`.

## Pendências registradas na aprovação do CP1
| ID | Pendência | Destino |
|---|---|---|
| PEND-01 | ~~Idempotência com a mesma chave e payload diferente~~ **RESOLVIDO (CP5)**: checkout.spec › API mesma chave + mesmo conteúdo = mesmo pedido (200); conteúdo diferente = 409 `IDEMPOTENCY_KEY_REUSED` | — |
| PEND-02 | ~~Timeout após a criação do pedido e recuperação por retry~~ **RESOLVIDO (CP5)**: cenários `order-timeout` e `order-lost-response`; o retry (inclusive pelo botão principal) recupera o MESMO pedido, 1 pedido no servidor | — |
| PEND-03 | ~~Consistência da persistência do mock entre abas~~ **RESOLVIDO (CP6)**: cluster de abas com líder único (Web Lock), RPC por BroadcastChannel e eventos entregues pelo Socket.IO de cada aba (tabs.spec, 6 casos × 2) | — |
| PEND-04 | Impacto do MSW na performance inicial (R-25): **MEDIDO no CP8 e no CP9, NÃO RESOLVIDO**. Performance mobile abaixo de 90; ver R-25 e `CP9_REPORT.md` | encerrado como limitação |
| PEND-05 | Revalidação integral do HEAD a cada checkpoint. CP1: `91380dc`. **CP2: `6ad49e0` validado em checkout limpo (126/126)** · **CP3: `2b2aa83` (199 passed / 2 skipped)** · **CP4: `ea6f60b` (295 / 5)** · **CP5: `18291bf` (376 / 5)** · CP6–CP8: suíte completa no diretório de trabalho · **CP9: checkout limpo final (`CP9_REPORT.md` §6)** | encerrado no CP9 |
| PEND-06 | Disco C: sem espaço; caches e temporários seguem em `D:\emprego\.cache` (R-23) | candidato |

## 0. Critérios eliminatórios

| ID | Critério | Como é garantido | Evidência | Status |
|---|---|---|---|---|
| ELIM-01 | Uso efetivo da stack | Cada tecnologia tem papel real (§1) | §1 abaixo | VALIDADO (CP7): ELIMINATORY_AUDIT.md §ELIM-01 |
| ELIM-02 | Fluxos principais não podem ser apenas visuais | Ações passam por Axios → MSW → db | PoC: login, pedido e reload persistem (T2, T3/4) | VALIDADO (CP7): todos os fluxos com efeito conferido no servidor (ELIMINATORY_AUDIT.md) |
| ELIM-03 | Compra confirmada só com resposta da simulação | A UI renderiza "confirmado" só com `status === 'confirmed'` vindo do REST/evento | T5, T5b, T7/8 | VALIDADO (CP7): criação retida sem confirmação; offline/terminal/recusa (ELIMINATORY_AUDIT.md) |
| ELIM-04 | Sem exposição de dados entre usuários | Query keys por `userId`; cache limpo no login/logout; socket por sessão; mock filtra por dono; cliente descarta evento alheio | T6, T6b, T6c; CP4: isolation.spec (respostas atrasadas, socket, API 404) | VALIDADO (CP7): isolation, orders, tabs, hardening (ELIMINATORY_AUDIT.md) |
| ELIM-05 | Sem eventos simulados na UI | Eventos só nascem em `src/mocks`; lint proíbe importar `src/mocks` fora de `main.tsx` | `lint.log` + sonda de lint (relatório CP1 §4) + T3/4..T9 | VALIDADO (CP7): eventos só pelo socket.io-client; barramento entre abas interno ao mock (ELIMINATORY_AUDIT.md) |
| ELIM-06 | Testes E2E executáveis | `npm run test:e2e` | `cp9-tests/checkout-limpo-*.log` | VALIDADO localmente em checkout limpo (CP9). CI (GitHub Actions) preparado, **não executado** (sem repositório remoto) |

## 1. Stack obrigatória

| Tecnologia | Papel efetivo | Evidência | Status |
|---|---|---|---|
| React 19.3.1 | UI de todas as telas | build + suíte completa | VALIDADO |
| TypeScript 5.9.3 (strict) | contratos tipados (zod → tipos) entre transporte, estado e UI | `typecheck` sem erros (CP9) | VALIDADO |
| TanStack Router 1.170.46 | rotas file-based com code splitting, `validateSearch` (catálogo na URL), `beforeLoad` (rotas privadas + retorno), `notFound`, 404 | catalog.spec (URL/histórico), auth.spec (guarda + redirect), nft-detail.spec (inexistente), design-system (404) | VALIDADO |
| TanStack Query 5.108.4 | queries, mutations, otimista com rollback, invalidação por evento, cancelamento, chaves por usuário | catalog, cart, checkout, races, isolation | VALIDADO |
| Axios 1.21.1 | cliente HTTP único (sessão, época da sessão, mapeamento de erros) | toda chamada REST; isolation (resposta de sessão anterior descartada) | VALIDADO |
| REST | contratos em `src/api/contracts.ts`, documentados em `API_CONTRACTS.md` | todos os recursos do §5 do enunciado exercitados pelos E2E | VALIDADO |
| socket.io-client 4.8.4 | tempo real | T3/4, T5, T6, T6b, T6c, T7/8, T9, heartbeat | VALIDADO |
| Tailwind CSS 4.3.5 | tokens `@theme` medidos do Figma, toda a estilização | build; contraste por teste; comparações com o Figma | VALIDADO |
| shadcn/ui (CLI 4.23.0, radix-ui 1.8.1) | Button, Dialog, Drawer, RadioGroup, Select, Tabs, Skeleton, Sonner… adaptados à identidade | design-system.spec (foco, drawer, axe) e telas | VALIDADO |
| MSW 2.15.0 + @mswjs/socket.io-binding 0.2.0 | REST + Socket.IO | toda a suíte, contra o build de produção | VALIDADO |
| Playwright 1.65.1 | E2E | `e2e-full-run-*.log` | VALIDADO |
| Lighthouse 13.6.0 | auditoria versionada (`scripts/lighthouse.mjs`) | 12 auditorias oficiais no CP8 e no CP9 (`cp8-perf/`, `cp9-perf/`) | VALIDADO (ferramenta). Meta de Performance mobile **não atingida** |

## 2. Validações críticas pedidas no CP1

| Validação | Teste | Status |
|---|---|---|
| REST via Axios e MSW | T1 (resposta `fromServiceWorker() === true`, 9 itens, preço string) | VALIDADO |
| TanStack Query e Router | T1, T2, T11 | VALIDADO |
| Comunicação real pelo socket.io-client | T3/4, T5 (sem polling; `rt-last = order.updated:apply`) | VALIDADO |
| Heartbeat e manutenção da conexão | teste heartbeat (65 s de relógio controlado, 0 reconexões) + controle negativo (sem heartbeat: 5 reconexões) | VALIDADO |
| Autenticação antes de subscriptions e dados privados | T6c (conexão sem CONNECT não recebe nada; ACK só após validar) + controle negativo (sem portão: ACK prematuro `40`) | VALIDADO |
| Rejeição de token inválido | T6b (stats `rejected = 1`, `accepted = 0`), T6c (`0{` → `44`, nunca `40`/`42`) | VALIDADO |
| Isolamento entre os 2 usuários | T6 (conexão só do usuário ativo; evento mal roteado descartado; REST 404 para pedido alheio) | VALIDADO |
| Descarte de eventos antigos e duplicados | T9 + 6 testes unitários do `EventGuard` | VALIDADO |
| Reconexão e reconciliação REST | T7/8 (3 rodadas + 20× por viewport) | VALIDADO |
| Logout e troca de usuário sem vazamento | T6 | VALIDADO |
| Idempotência de pedidos | T2b (clique duplo → 1 pedido); mesma chave com outro conteúdo → 409 implementado | VALIDADO (CP5): clique repetido, conflito 409, timeout e resposta perdida após a criação (checkout.spec) |
| Precisão decimal em ETH | 5 testes unitários de `lib/eth` | VALIDADO |
| Mocks no build de produção | toda a suíte roda em `vite build` + `vite preview` | VALIDADO |
| Reset integral dos cenários | T "reset integral" | VALIDADO (recursos da PoC) |

## 3. Critérios de avaliação (§11)

| ID | Critério | Pts | Status |
|---|---|---|---|
| AV-1 | Fidelidade visual e responsividade | 20 | EVIDENCIADO, COM LIMITAÇÕES: comparações na mesma escala (CP2–CP8), 8 baselines visuais, 3 larguras + 8 larguras sem overflow. Limitações: artes substitutas (VIS-03/06), galeria com 2 vistas (VIS-04), VIS-09/16 parciais |
| AV-2 | Fluxos e experiência | 20 | VALIDADO: compra e conta completas, validações e recuperação de erros (cart, checkout, orders, recovery, auth, account) |
| AV-3 | Integração e estado | 15 | VALIDADO: Router, Query, Axios e contratos (§1, §5); política de cache documentada em `ARCHITECTURE.md` |
| AV-4 | Tempo real | 10 | VALIDADO: eventos, duplicatas/antigos, reconexão e reconciliação, várias abas (races, recovery, tabs) |
| AV-5 | Mocking | 10 | VALIDADO: 29 cenários determinísticos em `src/mocks/scenarios.ts`, persistência, reset integral, controle do servidor simulado |
| AV-6 | Testes | 10 | VALIDADO localmente: 12 grupos E2E + regressão visual + a11y; CI preparado e não executado; baselines Linux não geradas |
| AV-7 | Acessibilidade | 5 | VALIDADO por testes automatizados (axe em 12 telas × 2 viewports, teclado, foco, reflow, alvos de toque). Sem leitor de tela real; sem declaração de conformidade WCAG |
| AV-8 | Performance | 5 | MEDIDO: desktop ≥ 90; **mobile abaixo de 90** (causas medidas e documentadas: CP8_REPORT §5, CP9_REPORT) |
| AV-9 | Arquitetura e documentação | 5 | DOCUMENTADO (CP9): `README.md`, `ARCHITECTURE.md`, `API_CONTRACTS.md`, `TECHNICAL_HANDOFF.md`; checkout limpo reproduzível |

## 4. Telas (§3)

Situação final (CP9). Detalhes por checkpoint nas seções 11, 13, 14 e 15.

| ID | Tela | Testes | Evidência visual | Status |
|---|---|---|---|---|
| TELA-01 | Início | catalog.spec, layout.responsive, visual (inicio) | `cp8/comparacao-inicio-*`, `cp8/inicio-{390,768,1440}` | VALIDADO |
| TELA-02 | Detalhes do NFT | nft-detail.spec, visual (detalhe) | `cp3/comparacao-detalhe-*`, `cp8/detalhe-*` | VALIDADO (galeria com 2 vistas: VIS-04) |
| TELA-03 | Carrinho | cart.spec, visual (carrinho) | `cp8/comparacao-carrinho-mobile` | VALIDADO |
| TELA-04 | Pagamento | checkout.spec, visual (pagamento) | `cp8/comparacao-pagamento-desktop` | VALIDADO |
| TELA-05 | Confirmação (sem frame no Figma) | orders.spec, recovery.spec, races.spec | `cp8/comparacao-recibo-desktop`, `cp8/confirmacao-*` | VALIDADO |
| TELA-06 | Login | auth.spec | `cp8/comparacao-login-desktop` | VALIDADO |
| TELA-07 | Cadastro | auth.spec | `cp4/comparacao-cadastro-*` | VALIDADO |
| TELA-08 | Perfil (mobile sem frame) | account.spec | `cp4/comparacao-perfil-desktop`, `cp8/perfil-*` | VALIDADO |
| TELA-09 | Carteiras (mobile sem frame) | account.spec | `cp8/comparacao-carteiras-desktop`, `cp8/carteiras-*` | VALIDADO |
| TELA-X | Páginas fora do escopo (Criadores, Aprenda, ações auxiliares) | design-system.spec (página "fora desta demonstração", ações indisponíveis sem aparentar sucesso) | — | VALIDADO |
| TELA-404 | Rota inexistente, NFT e pedido inexistentes | design-system, nft-detail, orders | — | VALIDADO |

As rotas internas `/demo/*` (PoC do CP1 e galeria do CP2) existem apenas no build dos testes (`VITE_DEMO_ROUTES=true`); no build público respondem 404 (`scripts/check-public-build.mjs`).

## 5. Requisitos funcionais, integração, API, mocking e tempo real

| ID | Status | Evidência / observação |
|---|---|---|
| CAT-01..05 | VALIDADO (CP3) | ver §11 |
| CART-01 (adicionar/alterar/remover por NFT e edição, estoque) | VALIDADO (CP5) | cart.spec › adicionar, quantidade e remoção (§14) |
| CART-02 (refresh; visitante preservado ao autenticar) | VALIDADO (CP5) | cart.spec › refresh; merge determinístico; unit › cart-model |
| CART-03 (cupom válido, inválido, expirado, remover) | VALIDADO (CP5) | cart.spec › cupons |
| CART-04 (valores coerentes com a API) | VALIDADO (CP5) | resumo = cotação da API; unit › pricing (wei) |
| CART-05 (preço e estoque em tempo real com o carrinho aberto) | VALIDADO (CP5) | cart.spec › tempo real no carrinho |
| CART-06 (precisão ETH) | VALIDADO | unit `lib/eth` |
| PAY-01 (validação; revisão antes do envio) | VALIDADO (CP5) | checkout.spec › validação |
| PAY-02 (carteiras cadastradas, rede, conexão/recusa/desconexão) | VALIDADO (CP5) | checkout.spec › carteiras e redes |
| PAY-03 (revalidar antes de confirmar; mudança exige nova confirmação) | VALIDADO (CP5) | checkout.spec › consistência financeira (preço, socket offline, estoque, cotação expirada) |
| PAY-07 (falha preserva itens; após confirmação, remover só o comprado) | VALIDADO (CP5) | checkout.spec › falha antes de gravar; recusado preserva carrinho e devolve estoque; confirmado tira só os itens comprados |
| PAY-04 (duplicidade) | VALIDADO (CP5) | checkout.spec › cliques repetidos; timeout e resposta perdida → mesmo pedido |
| PAY-05 (pendente/confirmado/recusado + recuperação) | VALIDADO (CP6, fluxo real) | orders.spec, recovery.spec (refresh, nova aba, offline confirmado/recusado, timeout, resposta perdida, sessão expirada) |
| PAY-06 (confirmação só se confirmada) | VALIDADO (CP6) | orders.spec (pendente sem "Compra confirmada"); recovery.spec (offline: nada presumido); races.spec (terminal não regride) |
| PAY-08 (snapshot + tx simulado) | VALIDADO (CP6) | orders.spec › recibo (hash, data, itens, edição, preços, valores, rede, carteira) e imutabilidade (preço, estoque, carteira e perfil alterados depois); explorador simulado |
| ACC-01 (login/logout/sessão/cadastro) | VALIDADO (CP4) | auth.spec › login, cadastro, logout (§13) |
| ACC-02 (rotas privadas) | VALIDADO (CP4) | auth.spec › /perfil, /perfil/carteiras, /favoritos com retorno |
| ACC-03 (sessão após refresh) | VALIDADO (CP4) | auth.spec › sessão sobrevive ao refresh |
| ACC-04 (expiração) | VALIDADO (CP4) | auth.spec › expiração (rota privada e página pública); isolation › intenção de favoritar retomada |
| ACC-05 (limpeza na troca) | VALIDADO (CP4) | isolation.spec › respostas retidas + MutationObserver; socket de Ana encerrado |
| ACC-06 (perfil) | VALIDADO (CP4) | account.spec › perfil, avatar, senha |
| ACC-07 (carteiras) | VALIDADO (CP4) | account.spec › carteiras |
| ACC-08 (senha não em claro) | VALIDADO (CP9) | PBKDF2 (100 mil iterações, sal) no mock; seed com hashes pré-calculados conferidos (unit › seed-hashes); auth.spec › conta nova: nenhuma senha (nova ou do seed) aparece em localStorage/sessionStorage; troca de senha invalida a antiga |
| INT-01, 02, 03, 04, 08, 10 | VALIDADO | PoC (T1, T2, T11) e telas finais (catalog, auth, checkout); lint impede importar `src/mocks` na aplicação |
| INT-05 (estados) | VALIDADO | carregamento (skeletons), vazio, erro + retry, sucesso e atualização em segundo plano: catalog, cart, checkout, account, orders |
| INT-07 (respostas obsoletas) | VALIDADO (CP3) | `out-of-order` + `stale-in-flight` (§11) |
| INT-11 (otimista + rollback) | VALIDADO (favoritos, CP3) | `favorite-fail` |
| INT-09 (idempotência) | VALIDADO (CP5) | checkout.spec › idempotência e falhas |
| INT-12 | DOCUMENTADO (CP9) | política de cache, retries e sincronização em `ARCHITECTURE.md` §Cache |
| INT-06 (invalidação após eventos) | VALIDADO | T3/4, T7/8; cart.spec e checkout.spec (nft.updated → cotação); orders.spec (order.updated) |
| API-01 | VALIDADO | todos os recursos mínimos (sessão e conta, NFTs, favoritos, carrinho, cotação, pedidos, perfil, carteiras) exercitados pelos E2E; contratos em `API_CONTRACTS.md` |
| API-02 | VALIDADO | 422 `VALIDATION_ERROR` (auth, account), 401 `UNAUTHORIZED`/sessão expirada (auth, isolation), 404 `NOT_FOUND` (isolation › API de outro usuário, nft-detail, orders), 409 (`CONFLICT`, `OUT_OF_STOCK`, `QUOTE_STALE`, `IDEMPOTENCY_KEY_REUSED`), 5xx/`TRANSIENT` e offline (catalog-error, cart-error, order-fail) |
| API-03 | VALIDADO (CP5) | mesma tentativa → mesmo pedido; mesma chave + outro conteúdo → 409 |
| MOCK-01, 02, 07, 08, 09, 10 | VALIDADO | lint, T3/4 (REST e evento coerentes após reload), suíte no build de produção |
| MOCK-03 (persistência e reset) | VALIDADO | refresh em todas as áreas (cart, account, orders); `?reset=1` e `__kurioMock.reset()` restauram o cenário (T "reset integral", cada teste parte de reset) |
| MOCK-04, 06 | VALIDADO | 29 cenários em `src/mocks/scenarios.ts` (lista no README), mais controles determinísticos (`hold`/`release`/`recover`, `expireSessions`, `expireQuotes`, `advanceClock`, `updateNft`, `settleOrder`); cobrem todos os casos do §6 do enunciado | ver README §Cenários |
| MOCK-05 (2 usuários) | VALIDADO | T6 |
| RT-01 (nft.updated) | VALIDADO (catálogo, detalhe, carrinho e pagamento) | T3/4 + §11 + cart.spec/checkout.spec (§14) |
| RT-02 (order.updated) | VALIDADO | T5, T5b |
| RT-03, RT-04 | VALIDADO | T9 + unitários |
| RT-05 | VALIDADO | T7/8 |
| RT-06 | VALIDADO | T6, T6b, T6c |
| RT-07 (listeners liberados) | VALIDADO | isolation › logout encerra o socket; tabs.spec; races (assinaturas por pedido liberadas) |
| RT-08 | VALIDADO (CP5) | checkout.spec › preço muda durante a revisão; estoque acaba; mudança não vista (socket offline) recusada pela API |
| RT-09 | VALIDADO (CP6, fluxo real) | races.spec (duplicado, antigo, terminal); unit › orders-events (4 casos) |

## 6. UI, acessibilidade, testes, Lighthouse e entrega

| ID | Status |
|---|---|
| UI-01 (tipografia, cores, espaçamentos, composição; shadcn adaptado) | EVIDENCIADO, COM LIMITAÇÕES: tokens medidos, comparações na mesma escala com o Figma (CP2–CP8), baselines visuais; desvios em `ARCHITECTURE.md` §Desvios do Figma |
| UI-02 (390/768/1440 e intermediárias) | VALIDADO: `layout.responsive.spec.ts` (8 larguras, todas as telas), reflow a 320 px (a11y.spec), capturas CP8 em 390/768/1440 |
| UI-03 (skeleton com shimmer, sem CLS, movimento reduzido) | VALIDADO (componente): mesmas dimensões do card (Δ ≤ 2 px), `aria-busy`, shimmer desligado com `reduced-motion`. Uso real em catálogo, detalhe e resumo: CP3/CP5 |
| UI-04 (assets do arquivo; substituições documentadas) | DOCUMENTADO: originais não exportáveis (Figma só visualização); artes substitutas derivadas das capturas, registradas em `ASSETS_MANIFEST.md` e `ARCHITECTURE.md` |
| A11Y-01 (teclado, foco visível) | VALIDADO: skip link, ordem de foco, teclado em filtros, galeria, carrinho, pagamento e diálogos |
| A11Y-02 (foco em diálogos e drawers) | VALIDADO: foco preso, Esc fecha e devolve o foco (Dialog e Drawer). **Defeito corrigido:** o vaul deixava o foco fora do drawer |
| A11Y-03 (semântica, labels, erros associados) | VALIDADO: axe WCAG 2.2 A/AA sem violações nas 12 telas (9 obrigatórias + Mercado, Favoritos, Meus pedidos; pedido pendente, confirmado e recusado) × desktop e mobile, + um `h1` por tela, títulos sem saltos, controles nomeados (`a11y.spec`, CP8). Defeitos corrigidos no CP8: `label-content-name-mismatch` em "Tornar principal" e modal de login sem `h1` |
| A11Y-04 (alternativas textuais) | VALIDADO: `alt` descritivo vindo da API; a11y.spec verifica `alt` em todas as imagens das 12 telas |
| A11Y-05 (contraste e não depender só de cor) | VALIDADO: 19 pares de token por teste + axe `color-contrast`; estados com indicador extra |
| A11Y-06 (feedback acessível) | VALIDADO: erros em `role=alert`, toasts com `aria-live`, estado do pedido em `aria-live`, alterações de preço anunciadas (cart/checkout) |
| A11Y-07 (sem overflow, zoom) | VALIDADO (CP8): reflow a 320 px (equivale a 400% de zoom em 1280 px) sem rolagem horizontal em 8 rotas; alvos de toque ≥ 24 px (WCAG 2.5.8, com a exceção de espaçamento) no mobile · `a11y.spec`. Zoom de texto isolado (200% só de fonte) não testado |
| E2E-01 | VALIDADO (CP3) |
| E2E-02 | VALIDADO (CP3) |
| E2E-03 | VALIDADO (CP4): auth.spec |
| E2E-04 | VALIDADO (CP3 + CP4: troca de usuário, expiração e retomada da intenção) |
| E2E-08 | VALIDADO (CP4): account.spec |
| E2E-11 | VALIDADO (CP4 + CP5: modal de login, validação de formulários, carrinho e pagamento por teclado, axe em /carrinho e /pagamento) |
| E2E-12 | VALIDADO (catálogo, detalhe; CP5: erro e retry do carrinho, cotação em andamento, falha de escrita) |
| E2E-05 | VALIDADO (CP5): cart.spec |
| E2E-06 | VALIDADO (CP6): orders.spec › compra completa até o recibo definitivo |
| E2E-07 | VALIDADO (CP5): checkout.spec › idempotência e falhas (recusa, clique repetido, timeout, resposta perdida) |
| E2E-09 | VALIDADO (CP5): checkout.spec › consistência financeira em tempo real |
| E2E-10 | VALIDADO (CP6): races.spec (eventos duplicados, antigos, terminais; REST antigo após evento novo) e recovery.spec (desconexão, retomada de pedido pendente) |
| TEST-01 (Chromium desktop + mobile) | VALIDADO (configuração) |
| TEST-02 (visual) | VALIDADO no Windows: 8 baselines; CP8 atualizou 6 (Início ×2, Carrinho mobile, Pagamento ×2, Detalhe mobile) após inspeção, com antes/depois/diff em `evidence/cp8-baselines/`. Baselines Linux ainda não geradas (teste ignorado no Linux com motivo). Limitação de sensibilidade: R-47 |
| TEST-03 (estado isolado) | VALIDADO: contexto novo + `?reset=1` por teste; 3 rodadas paralelas sem interferência |
| TEST-04 (HTML + traces) | VALIDADO (configuração): `reporter` HTML e `trace: retain-on-failure`; relatórios gerados nas rodadas locais |
| TEST-05 | VALIDADO (os testes acionam o servidor simulado; a UI muda via socket ou Axios) |
| LH-01..06 | MEDIDO, METAS PARCIALMENTE ATINGIDAS. Rodada oficial final (CP9, `a5aff5b`, `cp9-perf/oficial/`): A11y 100, BP 96, SEO 92 nos 4 perfis (atingidas); Performance desktop 97/98 (atingida); **Performance mobile 55 (Início) e 64 (Detalhe), não atingida**. LCP, CLS e TBT registrados; ambiente, versões e condições em `summary.md`. Rodadas anteriores preservadas (`cp8-perf/`, `cp9-perf/`) |
| DEL-01 (lockfile) | VALIDADO (`package-lock.json` gerado com `npm install`, sem force/legacy-peer-deps) |
| DEL-02, 03 (deploy) | PREPARADO (CP9): `vercel.json` (rewrites de SPA, headers do Service Worker); **publicação aguarda autorização** |
| DEL-04, 05 (README, ARCHITECTURE) | DOCUMENTADO (CP9) |
| DEL-06 (scripts) | VALIDADO: `dev`, `build`, `preview`, `typecheck`, `lint`, `test:e2e`, `audit:lighthouse` (`dev` não exercitado por teste automatizado) |
| DEL-07 (checkout limpo) | VALIDADO (CP9, `a5aff5b`): `git clone` → `npm ci` → typecheck → lint → build → `check:public-build` → suíte completa (4 workers) = **473 passed, 0 failed, 9 skipped** (`cp9-tests/checkout-limpo-*.log`). Navegadores do Playwright vindos do cache local (`npx playwright install chromium` é passo de setup) |

## 11. CP3: catálogo e detalhe (evidências em `planning/evidence/cp3/` e `planning/evidence/cp3-tests/`)

| ID | Requisito | Teste (arquivo › caso) | Status |
|---|---|---|---|
| TELA-01 | Início: destaques, catálogo, busca, filtros, ordenação, navegação | catalog.spec › todos; comparações `comparacao-inicio-*` | VALIDADO (funcional) · fidelidade: ver CP3_REPORT §6 |
| TELA-02 | Detalhe: galeria, informações, edição, quantidade, favoritos, compra | nft-detail.spec › todos; `comparacao-detalhe-*` | VALIDADO (funcional) · compra e carrinho: contrato sem sucesso simulado até o CP5 |
| CAT-01 | URL com busca/filtros/ordem/página; refresh e histórico | catalog › paginação + histórico + refresh; link compartilhável | VALIDADO |
| CAT-02 | Filtros combináveis; mudar filtro reinicia a página | catalog › filtros combinados; mudar um filtro volta para a página 1 | VALIDADO |
| CAT-03 | Consultas refletem parâmetros; vazio, falha, fora de ordem | catalog › busca sem resultados, erro HTTP, erro de conexão, respostas fora de ordem, resposta REST antiga após evento | VALIDADO |
| CAT-04 | Acesso direto, inexistente, edição indisponível, limite de quantidade | nft-detail › acesso direto, 404, edição esgotada, quantidade | VALIDADO |
| CAT-05 | Favoritos persistem para o usuário autenticado | catalog › visitante → login → favorito persiste após refresh | VALIDADO |
| — | Parâmetros inválidos e página além do fim | catalog › parâmetros inválidos; unit › catalog-search | VALIDADO |
| — | Imagem que falha ao carregar | catalog › fallback no mesmo espaço | VALIDADO |
| — | Teclado (filtros, drawer, edições) | catalog › teclado; nft-detail › setas | VALIDADO |
| — | Responsividade (8 larguras, novas rotas) | layout.responsive | VALIDADO |
| — | Acessibilidade (axe, novas rotas) | design-system › axe em /, /mercado, /nft/nft-001, /nft/nao-existe | VALIDADO |

## 12. Revisão visual final (registrada na aprovação do CP3; executar antes da entrega)
| ID | Item | Destino |
|---|---|---|
| VIS-01 | Reduzir a altura do hero mobile para aproximá-lo do Figma (~235 px → ~180 px) | CP8 · FEITO: hero mobile ≈ 190 px (antes ≈ 235 px; Figma ≈ 180 px). `comparacao-inicio-mobile` |
| VIS-02 | Revisar o espaçamento entre hero e catálogo no desktop | CP8 · FEITO: espaçamento vertical da Início no desktop 56 → 40 px. `comparacao-inicio-desktop` |
| VIS-03 | Melhorar a variedade visual das artes | CP8 · LIMITAÇÃO (não feito): sem artes oficiais novas; o enunciado proíbe inventar assets. Mantidas as artes do manifesto (`ASSETS_MANIFEST.md`) |
| VIS-04 | Revisar as miniaturas da galeria (hoje 2 vistas; Figma mostra 4) | CP8 · LIMITAÇÃO (não feito): a galeria continua com 2 vistas reais; 4 miniaturas exigiriam recortes derivados apresentados como vistas novas |
| VIS-05 | Garantir que a barra fixa de compra (mobile) não oculte conteúdo | CP8 · FEITO E TESTADO: o fim da página fica acima da barra fixa (detalhe, carrinho, pagamento) · `a11y.spec › VIS-05`. **Defeito encontrado pelo teste novo** (rodapé do detalhe 28 px sob a barra de compra) e corrigido no `index.css` |
| VIS-06 | Melhorar a variedade visual dos NFTs relacionados | CP8 · LIMITAÇÃO (não feito): mesma causa de VIS-03 |
| VIS-07 | (registrado no CP5) Aproximar a tela de Carteiras do formulário original do Figma (hoje: resumo + "Editar"), preservando os rótulos acessíveis | CP8 · FEITO: carteira principal como formulário persistente (campos do Figma, rótulos preservados); a secundária segue como resumo + Editar. `comparacao-carteiras-desktop` |
| VIS-08 | (registrado no CP5) Posição do modal de login/cadastro no desktop (Figma: perto do topo do hero; hoje: centralizado) | CP8 · FEITO: modal ancorado a 144 px do topo no desktop (Figma: perto do topo do hero). `comparacao-login-desktop` |
| VIS-09 | (CP5) Carrinho mobile: linha "Total + Remover" e título "Resumo da carteira" não existem no Figma | CP8 · PARCIAL: linha "Total + Remover" removida (lixeira no canto do card, total da linha só no desktop). O título "Resumo da carteira" foi mantido (estrutura de títulos) |
| VIS-10 | (registrado no CP6) Aproximar o formulário de pagamento desktop do Figma | CP8 · FEITO: grade de 2 colunas (nome de exibição, nome de usuário, rede, e-mail), carteiras lado a lado, observação por último. Validação inalterada. `comparacao-pagamento-desktop` |
| VIS-11 | (registrado no CP6) Revisar a altura dos cards do carrinho mobile | CP8 · FEITO: card do carrinho mobile com a altura da imagem (≈ 82 px; antes ≈ 130 px). `comparacao-carrinho-mobile` |
| VIS-12 | (registrado no CP6) Garantir que o CTA fixo do mobile não impeça a visualização do total | CP8 · FEITO E TESTADO: total na barra fixa ao lado do CTA (carrinho e pagamento) · `data-testid="mobile-total"` |
| VIS-13 | (registrado no CP6) Preservar requisitos funcionais e de acessibilidade durante VIS-10..12 (rodar a suíte completa após os ajustes) | CP8 · FEITO: axe em 12 telas × 2 viewports, suíte completa no fim do CP8 (CP8_REPORT §6) |
| VIS-14 | (CP7) Hierarquia visual do recibo (título, total e hash; densidade da lista de dados no mobile) | CP8 · FEITO: estado em painel com cor + ícone + texto; total maior. `comparacao-recibo-desktop` |
| VIS-15 | (CP7) Toasts não podem encobrir ações (CTA fixo do mobile, botões de quantidade) | CP8 · FEITO E TESTADO: toasts no topo, abaixo do header · `a11y.spec › notificação não cobre a ação fixa` |
| VIS-16 | (CP7) Espaçamentos e tipografia: revisão geral contra as capturas do Figma na mesma escala | CP8 · PARCIAL: ajustes pontuais (nome no card do carrinho, espaçamentos da Início, recibo). Sem revisão tipográfica global além disso |

## 13. CP4: autenticação, perfil e carteiras (evidências em `planning/evidence/cp4/` e `planning/evidence/cp4-tests/`)

Todos os casos rodam em `desktop-chromium` (1440) e `mobile-chromium` (390), salvo os marcados como específicos de dispositivo.

| ID | Requisito | Teste (arquivo › caso) | Status |
|---|---|---|---|
| TELA-06 | Login: modal no desktop, tela cheia no mobile; e-mail e senha; mostrar/ocultar; social indisponível | auth › login (8 casos) + apresentação; `comparacao-login-*` | VALIDADO |
| TELA-07 | Cadastro: campos do Figma, obrigatórios, e-mail, requisitos de senha, confirmação, conflitos, entra após criar | auth › cadastro (3 casos); `comparacao-cadastro-*` | VALIDADO |
| TELA-08 | Perfil: avatar, nome de exibição, usuário, e-mail, apelido da carteira, senha | account › perfil, avatar, senha (9 casos); `comparacao-perfil-desktop` | VALIDADO |
| TELA-09 | Carteiras: principal/secundária, adicionar, editar, rede, validação, conflito, trocar principal | account › carteiras (5 casos); `comparacao-carteiras-desktop` | VALIDADO |
| — | Credenciais inválidas, falha de conexão, envio duplicado | auth › credenciais inválidas; falha de conexão (`auth-offline`); envio duplicado (`slow`, 1 POST) | VALIDADO |
| — | Redirecionamento seguro (sem open redirect) | auth › redirect externo ignorado; unit › AuthSearch | VALIDADO |
| — | Rotas protegidas + retorno à rota | auth › /perfil, /perfil/carteiras, /favoritos | VALIDADO |
| — | Expiração: rota privada → login com aviso e retorno; página pública → visitante com aviso; ação → retomada | auth › expiração (2 casos); isolation › intenção retomada | VALIDADO |
| — | Logout limpa sessão e armazenamento; troca de usuário | auth › logout; troca de usuário | VALIDADO |
| — | Resposta privada atrasada após logout/troca (favoritos e carteiras) | isolation › `slow-private` + MutationObserver (nenhum dado de Ana renderizado em nenhum instante) + requisição de Ana abortada | VALIDADO |
| — | Isolamento na API (carteira de outro usuário) | isolation › PUT/primary em carteira de Ana → 404 | VALIDADO |
| — | Socket.IO: conexão de Ana encerrada no logout; nova para Bruno | isolation › socket | VALIDADO |
| — | Sucesso só após a API; dados temporários × persistidos | account › "Salvando…" sem toast antes da resposta; falha mantém o digitado sem persistir; "Descartar" volta ao salvo | VALIDADO |
| — | Upload simulado de avatar (tipo, tamanho, falha) | account › avatar (3 casos) | VALIDADO |
| — | Contratos (mesmo schema no cliente e no mock) | unit › account-contracts (7 casos) | VALIDADO |
| — | Modal: foco preso, Esc, retorno do foco; abas preservam destino | auth › apresentação (desktop) | VALIDADO |
| — | Mobile: tela cheia sem rodapé/bottom nav | auth › apresentação (mobile) | VALIDADO |
| — | Acessibilidade (axe, com erros visíveis) | auth › axe /login, /cadastro; account › axe perfil e carteiras | VALIDADO |
| — | Responsividade (8 larguras; menu da conta sem corte no tablet) | layout.responsive › /login, /cadastro; conta sem overflow e menu utilizável | VALIDADO |
| — | Contrato de carteiras para o checkout (CP5) | `useWallets` + `sortWallets` (principal primeiro); `PendingIntent.checkout` | IMPLEMENTADO, NÃO VALIDADO (uso real no CP5) |

## 14. CP5: carrinho e checkout (evidências em `planning/evidence/cp5/` e `planning/evidence/cp5-tests/`)

Todos os casos rodam em `desktop-chromium` (1440) e `mobile-chromium` (390), com tráfego real UI → TanStack Query → Axios → MSW e eventos pelo socket.io-client.

| ID | Requisito | Teste (arquivo › caso) | Status |
|---|---|---|---|
| TELA-03 | Carrinho (Figma desktop e mobile) | cart.spec (13 casos); `comparacao-carrinho-*`; baseline visual | VALIDADO (funcional) · diferenças em VISUAL_ANALYSIS §13 |
| TELA-04 | Pagamento (Figma desktop e mobile) | checkout.spec (17 casos); `comparacao-pagamento-*`; baseline visual | VALIDADO (funcional) · diferenças em VISUAL_ANALYSIS §13 |
| — | Adicionar pelo card do catálogo e pelo detalhe (edição + quantidade); mesma linha soma | cart.spec › card; detalhe; nft-detail › adicionar/comprar (adaptado) | VALIDADO |
| — | Quantidade, limite de estoque, remoção, carrinho vazio | cart.spec › quantidade/remoção; além do estoque (409) | VALIDADO |
| — | Persistência (refresh) e merge determinístico | cart.spec › refresh; merge (soma, estoque, ordem); unit › cart-model (2 casos) | VALIDADO |
| — | Isolamento entre usuários e visitante após logout | cart.spec › isolamento | VALIDADO |
| — | Cupons válido, inválido, expirado, remover | cart.spec › cupons | VALIDADO |
| — | Precisão financeira (wei/bigint, cotação da API) | unit › pricing (3 casos, inclui o carrinho do Figma 26.83 → 26.846); E2E conferem `data-value` exato | VALIDADO |
| — | Estados: carregamento da cotação, erro + recuperação, falha de escrita | cart.spec › estados e falhas | VALIDADO |
| — | Dados do colecionador, validação, carteira externa | checkout.spec › validação | VALIDADO |
| — | Carteiras cadastradas (`useWallets` + `sortWallets`), rede compatível, taxa por rede | checkout.spec › carteiras e redes | VALIDADO |
| — | Conexão simulada: recusa, nova tentativa, desconexão, troca desconecta | checkout.spec › conexão | VALIDADO |
| — | Preço muda na revisão: alerta antes → depois, bloqueio, aceite explícito | checkout.spec › preço muda | VALIDADO |
| — | Mudança não vista pelo cliente (socket offline): API recusa cotação antiga | checkout.spec › socket offline | VALIDADO |
| — | Estoque acaba durante a revisão | checkout.spec › estoque acaba | VALIDADO |
| — | Cotação expirada | checkout.spec › cotação expirada | VALIDADO |
| — | Idempotência (PEND-01) e timeout/resposta perdida (PEND-02) | checkout.spec › idempotência e falhas (4 casos) | VALIDADO |
| — | Falha antes de gravar preserva dados e carrinho | checkout.spec › falha antes de gravar | VALIDADO |
| — | Pagamento recusado: sem confirmação, carrinho preservado, estoque devolvido | checkout.spec › recusado | VALIDADO |
| — | Confirmação só com status da API (pendente → confirmado via socket) | checkout.spec › fluxo principal | VALIDADO |
| — | Expiração da sessão ao confirmar: login, volta com rascunho, nada reenviado sozinho | checkout.spec › expiração | VALIDADO |
| — | Teclado, foco e axe | cart.spec › acessibilidade; checkout.spec › acessibilidade | VALIDADO |
| — | Responsividade (8 larguras) + placeholder do cupom sem corte | layout.responsive › carrinho e pagamento | VALIDADO |
| — | Recibo imutável, tela de confirmação final, recuperação avançada | — | PENDENTE (CP6) |

## 15. CP6: pedidos, confirmação, recuperação e tempo real (evidências em `planning/evidence/cp6/` e `planning/evidence/cp6-tests/`)

| ID | Requisito | Teste (arquivo › caso) | Status |
|---|---|---|---|
| TELA-05 | Confirmação / recibo definitivo (sem frame no Figma; derivado do design system) | orders.spec › compra completa; capturas `recibo-confirmado-*` | VALIDADO |
| — | Recibo: id, status, hash simulado, data e hora, NFTs, edições, quantidades, preços congelados, subtotal, desconto, taxa, total, rede, carteira, explorador simulado, ações | orders.spec › compra completa | VALIDADO |
| — | Recibo imutável (preço, estoque, carteira e perfil mudam depois) | orders.spec › recibo imutável | VALIDADO |
| — | Histórico de pedidos (privado, mais recentes primeiro, tempo real) | orders.spec › histórico; responsivo | VALIDADO |
| — | Pedido de outro usuário: tela e API "não encontrado" | orders.spec › outro usuário; tabs.spec › isolamento | VALIDADO |
| — | Recusa: sem confirmação, carrinho preservado, reserva liberada uma vez | orders.spec › recusa | VALIDADO |
| R-40 | Reserva com prazo (10 min, relógio controlável); vencimento libera uma vez; confirmação atrasada não confirma | orders.spec › reserva vence; confirmação após o prazo | VALIDADO |
| — | Confirmação remove só o comprado; itens adicionados depois permanecem | orders.spec › itens adicionados depois | VALIDADO |
| — | Recuperação: refresh, nova aba/URL direta, offline confirmado e recusado, timeout, resposta perdida, sessão expirada, novo login | recovery.spec (7 casos × 2) | VALIDADO |
| R-42 | REST antigo após evento novo (pedido): teste determinístico + controle negativo | races.spec › R-42; `R-42-SEM-PROTECAO-controle-negativo.log` (falha sem a proteção) | VALIDADO |
| R-44 | Primeira adição do visitante: teste determinístico + controles | races.spec › R-44; `R-44-SEM-PROTECAO-*.log` (falha), `R-44-SO-GUARDA-DE-VERSAO.log` (passa) | VALIDADO |
| — | Eventos duplicados, antigos, fora de ordem e terminais | races.spec; unit › orders-events | VALIDADO |
| PEND-03 | Várias abas: catálogo/estoque, carrinho concorrente sem perda, idempotência, isolamento, failover, reconciliação | tabs.spec (6 casos × 2) | VALIDADO |
| — | Carregamento, erro e recuperação da tela do pedido | orders.spec › carregamento, erro e recuperação | VALIDADO |
| — | Responsividade (8 larguras) e acessibilidade da confirmação | layout.responsive › pedidos e recibo; orders.spec › axe | VALIDADO |
