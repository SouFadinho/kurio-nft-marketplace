# KURIO · Auditoria dos critérios eliminatórios (CP7)

Verificação direta no código e nos testes. Cada linha aponta a evidência concreta.

## ELIM-01 · Uso efetivo de toda a stack obrigatória
| Tecnologia | Papel real | Evidência no código |
|---|---|---|
| React 19 + TypeScript strict | toda a UI; `tsc -b` sem erros | `tsconfig.app.json` (`strict`), `typecheck-lint-build.log` |
| TanStack Router | rotas por arquivo, `validateSearch` (estado do catálogo na URL), `beforeLoad` (rotas privadas), loaders | 54 arquivos importam `@tanstack/react-router`; `src/routes/*`, `features/auth/guards.ts`, `features/catalog/search.ts` |
| TanStack Query | todo estado de servidor: listas, detalhe, carrinho, cotação, pedidos, conta; mutações; cancelamento; invalidação por eventos | 17 arquivos; `api/queryKeys.ts` (cache privado sob `['me', userId]`) |
| Axios | único cliente HTTP (interceptors de token, época da sessão, erros tipados, timeout por requisição) | `src/api/http.ts`; nenhum `fetch` direto no código da aplicação (só nos testes) |
| REST | contratos zod compartilhados com o mock | `src/api/contracts.ts`, `planning/API_CONTRACTS.md` |
| Socket.IO | `nft.updated`, `order.updated`, `cart.updated` pelo socket.io-client autenticado | `src/realtime/RealtimeProvider.tsx` (`io(...)`), `applyEvent.ts`, `eventGuard.ts` |
| MSW (+ @mswjs/socket.io-binding) | toda a API REST e o servidor Socket.IO simulados na camada de transporte | `src/mocks/browser.ts` (`setupWorker`), `handlers/*`, `realtime/server.ts` (`ws.link` + binding) |
| Tailwind 4 | todos os estilos e tokens do design system | `vite.config.ts` (`@tailwindcss/vite`), `src/index.css` |
| shadcn/ui (Radix) | 19 componentes adaptados (dialog, drawer, radio-group, select, slider, tabs, sonner…) | `src/components/ui/*` (38 arquivos de app os importam) |
| Playwright | unit + E2E desktop/mobile/responsivo + visual + axe | `playwright.config.ts`, `e2e/*` |
| Lighthouse | script de auditoria (12 execuções; oficial no CP8) | `scripts/lighthouse.mjs` |
| Vite | dev, build e preview (os testes usam o build) | `vite.config.ts`, `playwright.config.ts` (`webServer`) |

**Status: VALIDADO.**

## ELIM-02 · Fluxos principais realmente funcionais
Todos passam por UI → TanStack Query → Axios → MSW → "banco", e persistem após refresh. Os testes conferem o efeito no servidor (`mock.orders()`, `cartQuantity()` lendo a API, `readOrder()`):
- **Login e cadastro:** `auth.spec`.
- **Perfil, avatar, senha e carteiras:** `account.spec`.
- **Favoritos:** `catalog.spec`.
- **Carrinho:** `cart.spec`.
- **Pagamento:** `checkout.spec`.
- **Pedido e recibo:** `orders.spec`, `recovery.spec`.

Ações fora do escopo informam indisponibilidade sem simular sucesso (`design-system.spec`).

**Status: VALIDADO.**

## ELIM-03 · Confirmação de compra só após a resposta da API
- **Código:**
  - `OrderStatusPage` deriva o título de `order.status` vindo do REST ou do `order.updated`;
  - o pagamento só navega com o `Order` devolvido por `POST /orders`;
  - nenhum estado "confirmado" é criado no cliente.
- **Testes:**
  - `checkout.spec` › fluxo principal, com a criação **retida** no servidor: sem pedido, sem navegação e sem "Compra confirmada"/"Pedido recebido" enquanto a API não responde;
  - pendente sem confirmação até `settleOrder`;
  - `recovery.spec` › offline: nada é presumido até reconectar;
  - `races.spec` › terminal não regride;
  - `orders.spec` › recusa e reserva expirada sem confirmação; confirmação atrasada não confirma.

**Status: VALIDADO.**

## ELIM-04 · Sem vazamento de dados privados
- Cache privado sob `['me', userId]`. Em toda troca de sessão as consultas privadas são canceladas e removidas, e o Axios descarta respostas de sessão antiga (`STALE_SESSION`).
- A API filtra pelo dono: 404 para pedido e carteira de outro usuário.
- Socket.IO autenticado: eventos privados só para o dono, e o cliente descarta eventos alheios.
- Explorador só com dados públicos (`hardening.spec` confere as chaves exatas e a ausência de e-mail, nome, itens e ids).
- **Testes:** `isolation.spec` (respostas retidas + MutationObserver), `orders.spec` (pedido de outro usuário), `tabs.spec` (Ana e Bruno em abas diferentes), `hardening.spec` (`cart.updated` não chega a outro usuário), `poc.spec` T6.

**Status: VALIDADO.**

## ELIM-05 · Eventos de domínio pelo Socket.IO; mocks na camada de transporte
- Eventos nascem só em `src/mocks` (`services.ts`, `makeEvent`) e chegam à UI pelo socket.io-client (`RealtimeProvider`).
- Entre abas, o barramento `BroadcastChannel` é interno ao mock: leva o evento ao servidor Socket.IO simulado de cada aba, nunca ao cache.
- Nenhum código de mock importa o QueryClient nem toca no cache (`grep setQueryData|queryClient src/mocks` → vazio).
- O lint proíbe importar `src/mocks` fora de `main.tsx`.
- Os testes acionam o "servidor" por `window.__kurioMock`, que altera o banco e emite eventos, sem tocar em cache ou componente.

**Status: VALIDADO.**

## ELIM-06 · Suíte E2E executável e reproduzível
- `npm run test:e2e` roda tudo: build de produção, `retries: 0` e um contexto novo por teste.
- Cada teste começa com `?reset=1` (seed determinístico).
- Cenários e controles de mock são determinísticos: retenção, relógio da simulação, falhas injetadas.
- A fixture `failOnPageError` reprova qualquer exceção na página.
- Suíte completa do CP7: ver `CP7_REPORT.md` §6.
- Reprodução em checkout limpo: CP4 e CP5 validados (`clean-checkout.log`); a do HEAD final fica para o CP9.
- CI preparado (`.github/workflows/ci.yml`), mas **não executado** (sem remoto).

**Status: VALIDADO localmente; CI pendente de execução real.**

## Reverificação final (CP9, commit `a5aff5b`, checkout limpo)

Execução: `planning/evidence/cp9-tests/checkout-limpo-preparacao.log` e `checkout-limpo-suite.log` (`git clone` → `npm ci` → typecheck → lint → build → `check:public-build` → suíte completa, 4 workers, `retries: 0`): **473 passed, 0 failed, 9 skipped** (por dispositivo).

| Critério | Verificação no código final | Resultado |
|---|---|---|
| ELIM-01 Stack | imports no código da aplicação: TanStack Router (53 arquivos), TanStack Query (17), Axios (cliente único), socket.io-client (1, sob demanda), radix-ui/shadcn (15/38), MSW na camada de mocks; Tailwind e Playwright/Lighthouse na configuração | MANTIDO |
| ELIM-02 Fluxos funcionais | suíte completa no checkout limpo; os testes conferem o efeito no servidor simulado | MANTIDO |
| ELIM-03 Confirmação só com resposta | orders, recovery e races no checkout limpo | MANTIDO |
| ELIM-04 Isolamento | isolation, tabs, hardening no checkout limpo; ACC-08 agora também verifica a ausência de senha em claro no armazenamento | MANTIDO |
| ELIM-05 Eventos pelo Socket.IO | busca estática fora de `src/mocks`: 0 imports de mocks, 0 usos de `__kurioMock`, 0 `fetch` direto, 0 `emit`/`publish`; regra de lint ativa (lint sem erros) | MANTIDO |
| ELIM-06 E2E executáveis | suíte completa em checkout limpo; CI preparado e **não executado** (sem remoto) | MANTIDO localmente |

As rotas internas `/demo/*` saíram do build público (CP9), mas continuam no build dos testes: a contagem de testes não mudou (482).
