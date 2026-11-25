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
| PEND-04 | Impacto do MSW na performance inicial (R-25) | CP8 |
| PEND-05 | Revalidação integral do HEAD a cada checkpoint. CP1: `91380dc`. **CP2: `6ad49e0` validado em checkout limpo (126/126)** · **CP3: `2b2aa83` validado em checkout limpo (199 passed / 2 skipped)** · **CP4: `ea6f60b` validado em checkout limpo (295 passed / 5 skipped)** · **CP5: `18291bf` validado em checkout limpo (376 passed / 5 skipped)** | todo CP · CP9 |
| PEND-06 | Disco C: sem espaço; caches e temporários seguem em `D:\emprego\.cache` (R-23) | candidato |

## 0. Critérios eliminatórios

| ID | Critério | Como é garantido | Evidência | Status |
|---|---|---|---|---|
| ELIM-01 | Uso efetivo da stack | Cada tecnologia tem papel real (§1) | §1 abaixo | IMPLEMENTADO, NÃO VALIDADO (falta a solução final; a stack em si está VALIDADA na PoC) |
| ELIM-02 | Fluxos principais não podem ser apenas visuais | Ações passam por Axios → MSW → db | PoC: login, pedido e reload persistem (T2, T3/4) | PENDENTE (fluxos finais) |
| ELIM-03 | Compra confirmada só com resposta da simulação | A UI renderiza "confirmado" só com `status === 'confirmed'` vindo do REST/evento | T5, T5b, T7/8 | VALIDADO (PoC) · revalidar no CP6/CP7 |
| ELIM-04 | Sem exposição de dados entre usuários | Query keys por `userId`; cache limpo no login/logout; socket por sessão; mock filtra por dono; cliente descarta evento alheio | T6, T6b, T6c; CP4: isolation.spec (respostas atrasadas, socket, API 404) | VALIDADO (CP4) · revalidar no CP7 com carrinho e pedidos |
| ELIM-05 | Sem eventos simulados na UI | Eventos só nascem em `src/mocks`; lint proíbe importar `src/mocks` fora de `main.tsx` | `lint.log` + sonda de lint (relatório CP1 §4) + T3/4..T9 | VALIDADO |
| ELIM-06 | Testes E2E executáveis | `npm run test:e2e` | `e2e-full-run-{1,2,3}.log` | VALIDADO (PoC) · a suíte completa é do CP7 |

## 1. Stack obrigatória

| Tecnologia | Papel efetivo | Evidência | Status |
|---|---|---|---|
| React 19.3.1 | UI | build + E2E | VALIDADO |
| TypeScript 5.9.3 (strict) | contratos tipados | `typecheck.log` | VALIDADO |
| TanStack Router 1.170.46 | rotas file-based, `validateSearch`, `beforeLoad`, `notFound`, loader | T11 (acesso direto, refresh, 404, guard + redirect) | VALIDADO |
| TanStack Query 5.108.4 | queries, mutations, cache, reconciliação | T1, T2, T3/4, T7/8 | VALIDADO |
| Axios 1.21.1 | cliente HTTP único + interceptors | T1 (`fromServiceWorker`), login com erro (401 mapeado) | VALIDADO |
| REST | contratos em `src/api/contracts.ts` | T1, T2, T11 | VALIDADO (recursos da PoC) |
| socket.io-client 4.8.4 | tempo real | T3/4, T5, T6, T6b, T6c, T7/8, T9, heartbeat | VALIDADO |
| Tailwind CSS 4.3.5 | tokens `@theme` | build | VALIDADO (configuração) |
| shadcn/ui (CLI 4.23.0, radix-ui 1.8.1) | Button, Card | build + uso na PoC | VALIDADO (configuração) |
| MSW 2.15.0 + @mswjs/socket.io-binding 0.2.0 | REST + Socket.IO | toda a suíte, contra o build de produção | VALIDADO |
| Playwright 1.65.1 | E2E | `e2e-full-run-*.log` | VALIDADO |
| Lighthouse 13.6.0 | auditoria | `lighthouse-smoke-*-NAO-OFICIAL.*` (script) | IMPLEMENTADO, NÃO VALIDADO (auditoria oficial no CP8) |

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
| AV-1 | Fidelidade visual e responsividade | 20 | IMPLEMENTADO, NÃO VALIDADO (design system e estrutura global prontos e comparados; telas no CP3–CP6) |
| AV-2 | Fluxos e experiência | 20 | VALIDADO funcionalmente (CP3–CP6: catálogo, detalhe, conta, carrinho, pagamento, pedido e recibo); revisão visual final pendente |
| AV-3 | Integração e estado | 15 | IMPLEMENTADO, NÃO VALIDADO (base validada na PoC) |
| AV-4 | Tempo real | 10 | VALIDADO (CP5): catálogo, detalhe, carrinho e pagamento; RT-08 coberto |
| AV-5 | Mocking | 10 | IMPLEMENTADO, NÃO VALIDADO (3 de 21 cenários) |
| AV-6 | Testes | 10 | IMPLEMENTADO: 12 grupos E2E cobertos (ver §6); baselines Linux e CI no CP7 |
| AV-7 | Acessibilidade | 5 | IMPLEMENTADO, NÃO VALIDADO (base validada no CP2; revalidar nas telas e no CP8) |
| AV-8 | Performance | 5 | PENDENTE |
| AV-9 | Arquitetura e documentação | 5 | IMPLEMENTADO, NÃO VALIDADO |

## 4. Telas (§3)
Todas `PENDENTE` (TELA-01..09). Desde o CP2:
- A PoC do CP1 foi movida para `/demo/poc` (fora da navegação), sem mudar o código validado; os 43 testes do CP1 continuam passando.
- Rotas públicas (`/`, `/mercado`, `/carrinho`, `/favoritos`, `/nft/$nftId`, `/perfil`, `/perfil/carteiras`) existem como **placeholders temporários** dentro da estrutura global.
- `/criadores` e `/aprenda` são páginas **definitivas** "fora desta demonstração" (TELA-X → IMPLEMENTADO, VALIDADO por teste).
- TELA-404 continua VALIDADO.

**Evidências do CP2** (`planning/evidence/cp2/`): 18 capturas de viewport (PNG), 18 de página inteira (WebP), 6 recortes por elemento e 6 comparações com o Figma. Testes em `planning/evidence/cp2-tests/`.

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
| ACC-08 (senha não em claro) | VALIDADO (CP4, parcial) | PBKDF2 + sal aleatório no mock; troca de senha testada (a antiga deixa de funcionar). Não há teste que inspecione o storage em busca de texto puro |
| INT-01, 02, 03, 04, 08, 10 | VALIDADO (PoC) | T1, T2, T11, lint |
| INT-05 (estados) | VALIDADO (catálogo e detalhe, CP3) | §11 |
| INT-07 (respostas obsoletas) | VALIDADO (CP3) | `out-of-order` + `stale-in-flight` (§11) |
| INT-11 (otimista + rollback) | VALIDADO (favoritos, CP3) | `favorite-fail` |
| INT-09 (idempotência) | VALIDADO (CP5) | checkout.spec › idempotência e falhas |
| INT-12 | IMPLEMENTADO, NÃO VALIDADO | documentação de cache no CP9 |
| INT-06 (invalidação após eventos) | VALIDADO (PoC) | T3/4, T7/8 |
| API-01 | IMPLEMENTADO, NÃO VALIDADO (parcial) | auth (login, cadastro, sessão, logout), nfts, orders, favoritos, perfil, avatar, senha e carteiras (CP4, exercitados pelos E2E); carrinho, cupom, merge, cotação, conexão de carteira e pedido do checkout (CP5) |
| API-02 | IMPLEMENTADO, NÃO VALIDADO (parcial) | 401, 404, 409, 422 nos handlers |
| API-03 | VALIDADO (CP5) | mesma tentativa → mesmo pedido; mesma chave + outro conteúdo → 409 |
| MOCK-01, 02, 07, 08, 09, 10 | VALIDADO | lint, T3/4 (REST e evento coerentes após reload), suíte no build de produção |
| MOCK-03 (persistência e reset) | VALIDADO (PoC) | T3/4 (reload), T "reset integral" |
| MOCK-04, 06 | VALIDADO parcialmente (19 cenários; CP4: `auth-offline`, `avatar-fail`, `profile-save-fail`, `slow-private` + `expireSessions()`; conflitos e senha errada vêm dos dados; CP5: `cart-error`, `cart-write-fail`, `hold-quote`, `wallet-refused`, `order-fail`, `order-lost-response`, `order-timeout`, `slow-order` + `expireQuotes()` e `recover(rota)`; cupons inválido/expirado vêm dos dados) | `slow`, `hold-catalog`, `out-of-order`, `stale-in-flight`, `catalog-error`, `catalog-offline`, `detail-error`, `empty`, `broken-images`, `favorite-fail`… |
| MOCK-05 (2 usuários) | VALIDADO | T6 |
| RT-01 (nft.updated) | VALIDADO (catálogo, detalhe, carrinho e pagamento) | T3/4 + §11 + cart.spec/checkout.spec (§14) |
| RT-02 (order.updated) | VALIDADO | T5, T5b |
| RT-03, RT-04 | VALIDADO | T9 + unitários |
| RT-05 | VALIDADO | T7/8 |
| RT-06 | VALIDADO | T6, T6b, T6c |
| RT-07 (listeners liberados) | VALIDADO (PoC) | T6: a conexão de Ana desaparece do servidor após logout |
| RT-08 | VALIDADO (CP5) | checkout.spec › preço muda durante a revisão; estoque acaba; mudança não vista (socket offline) recusada pela API |
| RT-09 | VALIDADO (CP6, fluxo real) | races.spec (duplicado, antigo, terminal); unit › orders-events (4 casos) |

## 6. UI, acessibilidade, testes, Lighthouse e entrega

| ID | Status |
|---|---|
| UI-01 (tipografia, cores, espaçamentos, composição; shadcn adaptado) | IMPLEMENTADO, NÃO VALIDADO para as telas (CP3–CP6). Design system VALIDADO: tokens medidos, contraste por teste, comparações lado a lado com o Figma (`evidence/cp2/comparacao-*.png`) |
| UI-02 (390/768/1440 e intermediárias) | VALIDADO para a estrutura global e os layouts: 8 larguras sem overflow + troca de navegação por breakpoint (`layout.responsive.spec.ts`, 12 testes) e capturas `evidence/cp2/*-{390,768,1440}-*`. Revalidar com as telas finais |
| UI-03 (skeleton com shimmer, sem CLS, movimento reduzido) | VALIDADO (componente): mesmas dimensões do card (Δ ≤ 2 px), `aria-busy`, shimmer desligado com `reduced-motion`. Uso real em catálogo, detalhe e resumo: CP3/CP5 |
| UI-04 (assets do arquivo; substituições documentadas) | IMPLEMENTADO, NÃO VALIDADO: originais indisponíveis (Figma sem login); placeholders documentados em `ASSETS_MANIFEST.md` |
| A11Y-01 (teclado, foco visível) | VALIDADO (estrutura e componentes): skip link, nav com `aria-current`, slider por teclado, rádio por setas |
| A11Y-02 (foco em diálogos e drawers) | VALIDADO: foco preso, Esc fecha e devolve o foco (Dialog e Drawer). **Defeito corrigido:** o vaul deixava o foco fora do drawer |
| A11Y-03 (semântica, labels, erros associados) | VALIDADO (componentes): axe sem violações em 6 rotas × 2 viewports, com controle negativo |
| A11Y-04 (alternativas textuais) | VALIDADO (cards): `alt` descritivo vindo da API; axe `image-alt` |
| A11Y-05 (contraste e não depender só de cor) | VALIDADO: 19 pares de token por teste + axe `color-contrast`; estados com indicador extra |
| A11Y-06 (feedback acessível) | VALIDADO para as mutations da conta (CP4): erros em `role=alert` e associados ao campo, sucesso após a API (toast `aria-live` + `role=status`) |
| A11Y-07 (sem overflow, zoom) | VALIDADO para overflow (8 larguras). Zoom de 200% não testado ainda (CP8) |
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
| TEST-02 (visual) | IMPLEMENTADO: baselines de Início, Detalhe, Carrinho e Pagamento (desktop+mobile, Windows; CP5). Baselines Linux no CP7 |
| TEST-03 (estado isolado) | VALIDADO: contexto novo + `?reset=1` por teste; 3 rodadas paralelas sem interferência |
| TEST-04 (HTML + traces) | IMPLEMENTADO, NÃO VALIDADO (`trace: retain-on-failure`; relatório HTML gerado) |
| TEST-05 | VALIDADO (os testes acionam o servidor simulado; a UI muda via socket ou Axios) |
| LH-01..06 | IMPLEMENTADO, NÃO VALIDADO: script validado em modo não oficial (1 medição) · auditoria oficial no CP8 |
| DEL-01 (lockfile) | VALIDADO (`package-lock.json` gerado com `npm install`, sem force/legacy-peer-deps) |
| DEL-02, 03 (deploy) | PENDENTE (requer autorização) |
| DEL-04, 05 (README, ARCHITECTURE) | PENDENTE |
| DEL-06 (scripts) | VALIDADO: `dev`, `build`, `preview`, `typecheck`, `lint`, `test:e2e`, `audit:lighthouse` (`dev` não exercitado por teste automatizado) |
| DEL-07 (checkout limpo) | VALIDADO (CP1): `git clone` + `npm ci` + typecheck + lint + build + `test:e2e` = 43/43 (`clean-checkout.log`). Ressalva: os navegadores do Playwright vieram do cache em D: (`npx playwright install chromium` é um passo de setup a documentar no README) |

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
| VIS-01 | Reduzir a altura do hero mobile para aproximá-lo do Figma (~235 px → ~180 px) | revisão visual final |
| VIS-02 | Revisar o espaçamento entre hero e catálogo no desktop | revisão visual final |
| VIS-03 | Melhorar a variedade visual das artes | revisão visual final |
| VIS-04 | Revisar as miniaturas da galeria (hoje 2 vistas; Figma mostra 4) | revisão visual final |
| VIS-05 | Garantir que a barra fixa de compra (mobile) não oculte conteúdo | revisão visual final |
| VIS-06 | Melhorar a variedade visual dos NFTs relacionados | revisão visual final |
| VIS-07 | (registrado no CP5) Aproximar a tela de Carteiras do formulário original do Figma (hoje: resumo + "Editar"), preservando os rótulos acessíveis | revisão visual final |
| VIS-08 | (registrado no CP5) Posição do modal de login/cadastro no desktop (Figma: perto do topo do hero; hoje: centralizado) | revisão visual final |
| VIS-09 | (CP5) Carrinho mobile: linha "Total + Remover" e título "Resumo da carteira" não existem no Figma | revisão visual final |
| VIS-10 | (registrado no CP6) Aproximar o formulário de pagamento desktop do Figma | revisão visual final |
| VIS-11 | (registrado no CP6) Revisar a altura dos cards do carrinho mobile | revisão visual final |
| VIS-12 | (registrado no CP6) Garantir que o CTA fixo do mobile não impeça a visualização do total | revisão visual final |
| VIS-13 | (registrado no CP6) Preservar requisitos funcionais e de acessibilidade durante VIS-10..12 (rodar a suíte completa após os ajustes) | revisão visual final |

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
