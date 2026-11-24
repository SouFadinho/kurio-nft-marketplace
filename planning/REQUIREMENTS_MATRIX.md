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
| PEND-01 | Idempotência com a mesma chave e payload diferente (409 implementado, não testado) | CP5 · E2E-07 |
| PEND-02 | Timeout após a criação do pedido e recuperação por retry | CP5 · E2E-07 |
| PEND-03 | Consistência da persistência do mock entre abas | CP6 |
| PEND-04 | Impacto do MSW na performance inicial (R-25) | CP8 |
| PEND-05 | Revalidação integral do HEAD a cada checkpoint (o checkout limpo do CP1 foi feito no `91380dc`) | todo CP · CP9 |
| PEND-06 | Disco C: sem espaço; caches e temporários seguem em `D:\emprego\.cache` (R-23) | candidato |

## 0. Critérios eliminatórios

| ID | Critério | Como é garantido | Evidência | Status |
|---|---|---|---|---|
| ELIM-01 | Uso efetivo da stack | Cada tecnologia tem papel real (§1) | §1 abaixo | IMPLEMENTADO, NÃO VALIDADO (falta a solução final; a stack em si está VALIDADA na PoC) |
| ELIM-02 | Fluxos principais não podem ser apenas visuais | Ações passam por Axios → MSW → db | PoC: login, pedido e reload persistem (T2, T3/4) | PENDENTE (fluxos finais) |
| ELIM-03 | Compra confirmada só com resposta da simulação | A UI renderiza "confirmado" só com `status === 'confirmed'` vindo do REST/evento | T5, T5b, T7/8 | VALIDADO (PoC) · revalidar no CP6/CP7 |
| ELIM-04 | Sem exposição de dados entre usuários | Query keys por `userId`; cache limpo no login/logout; socket por sessão; mock filtra por dono; cliente descarta evento alheio | T6, T6b, T6c | VALIDADO (PoC) · revalidar no CP4/CP7 |
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
| Idempotência de pedidos | T2b (clique duplo → 1 pedido); mesma chave com outro conteúdo → 409 implementado | VALIDADO (clique repetido) · conflito 409 e timeout: IMPLEMENTADO, NÃO VALIDADO (E2E-07, CP5) |
| Precisão decimal em ETH | 5 testes unitários de `lib/eth` | VALIDADO |
| Mocks no build de produção | toda a suíte roda em `vite build` + `vite preview` | VALIDADO |
| Reset integral dos cenários | T "reset integral" | VALIDADO (recursos da PoC) |

## 3. Critérios de avaliação (§11)

| ID | Critério | Pts | Status |
|---|---|---|---|
| AV-1 | Fidelidade visual e responsividade | 20 | IMPLEMENTADO, NÃO VALIDADO (design system e estrutura global prontos e comparados; telas no CP3–CP6) |
| AV-2 | Fluxos e experiência | 20 | PENDENTE |
| AV-3 | Integração e estado | 15 | IMPLEMENTADO, NÃO VALIDADO (base validada na PoC) |
| AV-4 | Tempo real | 10 | IMPLEMENTADO, NÃO VALIDADO (mecanismos validados; cenário RT-08 pendente) |
| AV-5 | Mocking | 10 | IMPLEMENTADO, NÃO VALIDADO (3 de 21 cenários) |
| AV-6 | Testes | 10 | PENDENTE (0 de 12 grupos E2E finais) |
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
| CAT-01..05 | PENDENTE | — |
| CAT-04 (parcial: acesso direto e inexistente) | VALIDADO (PoC) | T11 |
| CART-01..05 | PENDENTE | — |
| CART-06 (precisão ETH) | VALIDADO | unit `lib/eth` |
| PAY-01..03, PAY-07 | PENDENTE | — |
| PAY-04 (duplicidade) | VALIDADO (clique repetido) / IMPLEMENTADO, NÃO VALIDADO (timeout) | T2b |
| PAY-05 (pendente/confirmado/recusado + recuperação) | VALIDADO (PoC) | T5, T5b, T7/8, T7b |
| PAY-06 (confirmação só se confirmada) | VALIDADO (PoC) | T5b |
| PAY-08 (snapshot + tx simulado) | IMPLEMENTADO, NÃO VALIDADO | as linhas do pedido são gravadas na criação; a mudança de preço posterior ainda não foi testada |
| ACC-01 (login/logout/sessão) | VALIDADO (login/logout) · cadastro PENDENTE | T2, T6, login inválido |
| ACC-02 (rotas privadas) | VALIDADO (PoC) | T11 |
| ACC-03 (sessão após refresh) | VALIDADO (PoC) | T7b (reload mantém a sessão) |
| ACC-04 (expiração) | IMPLEMENTADO, NÃO VALIDADO | 401 → sessão limpa (T6b cobre token inválido, não expiração) |
| ACC-05 (limpeza na troca) | VALIDADO (PoC) | T6 |
| ACC-06, ACC-07 | PENDENTE | — |
| ACC-08 (senha não em claro) | IMPLEMENTADO, NÃO VALIDADO | PBKDF2 no mock; sem teste automatizado |
| INT-01, 02, 03, 04, 08, 10 | VALIDADO (PoC) | T1, T2, T11, lint |
| INT-05, 07, 09, 11, 12 | PENDENTE / IMPLEMENTADO, NÃO VALIDADO | INT-07: `signal` repassado ao Axios, sem teste de corrida ainda |
| INT-06 (invalidação após eventos) | VALIDADO (PoC) | T3/4, T7/8 |
| API-01 | IMPLEMENTADO, NÃO VALIDADO (parcial) | auth, nfts, orders; faltam favoritos, carrinho, cotação, perfil, carteiras |
| API-02 | IMPLEMENTADO, NÃO VALIDADO (parcial) | 401, 404, 409, 422 nos handlers |
| API-03 | VALIDADO (mesma tentativa) / IMPLEMENTADO, NÃO VALIDADO (conflito) | T2b |
| MOCK-01, 02, 07, 08, 09, 10 | VALIDADO | lint, T3/4 (REST e evento coerentes após reload), suíte no build de produção |
| MOCK-03 (persistência e reset) | VALIDADO (PoC) | T3/4 (reload), T "reset integral" |
| MOCK-04, 06 | IMPLEMENTADO, NÃO VALIDADO (3 cenários) | `default`, `manual-settlement`, `payment-rejected` |
| MOCK-05 (2 usuários) | VALIDADO | T6 |
| RT-01 (nft.updated) | VALIDADO (lista + detalhe) · carrinho PENDENTE | T3/4 |
| RT-02 (order.updated) | VALIDADO | T5, T5b |
| RT-03, RT-04 | VALIDADO | T9 + unitários |
| RT-05 | VALIDADO | T7/8 |
| RT-06 | VALIDADO | T6, T6b, T6c |
| RT-07 (listeners liberados) | VALIDADO (PoC) | T6: a conexão de Ana desaparece do servidor após logout |
| RT-08 | PENDENTE | E2E-09 (CP5/CP6) |
| RT-09 | VALIDADO (PoC) | T7/8, T7b, T5b (terminal) |

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
| A11Y-06 (feedback acessível) | IMPLEMENTADO, NÃO VALIDADO para mutations reais (toast em região `aria-live` validado no componente) |
| A11Y-07 (sem overflow, zoom) | VALIDADO para overflow (8 larguras). Zoom de 200% não testado ainda (CP8) |
| E2E-01..12 | PENDENTE (a infraestrutura de teste está VALIDADA) |
| TEST-01 (Chromium desktop + mobile) | VALIDADO (configuração) |
| TEST-02 (visual) | PENDENTE |
| TEST-03 (estado isolado) | VALIDADO: contexto novo + `?reset=1` por teste; 3 rodadas paralelas sem interferência |
| TEST-04 (HTML + traces) | IMPLEMENTADO, NÃO VALIDADO (`trace: retain-on-failure`; relatório HTML gerado) |
| TEST-05 | VALIDADO (os testes acionam o servidor simulado; a UI muda via socket ou Axios) |
| LH-01..06 | IMPLEMENTADO, NÃO VALIDADO: script validado em modo não oficial (1 medição) · auditoria oficial no CP8 |
| DEL-01 (lockfile) | VALIDADO (`package-lock.json` gerado com `npm install`, sem force/legacy-peer-deps) |
| DEL-02, 03 (deploy) | PENDENTE (requer autorização) |
| DEL-04, 05 (README, ARCHITECTURE) | PENDENTE |
| DEL-06 (scripts) | VALIDADO: `dev`, `build`, `preview`, `typecheck`, `lint`, `test:e2e`, `audit:lighthouse` (`dev` não exercitado por teste automatizado) |
| DEL-07 (checkout limpo) | VALIDADO (CP1): `git clone` + `npm ci` + typecheck + lint + build + `test:e2e` = 43/43 (`clean-checkout.log`). Ressalva: os navegadores do Playwright vieram do cache em D: (`npx playwright install chromium` é um passo de setup a documentar no README) |
