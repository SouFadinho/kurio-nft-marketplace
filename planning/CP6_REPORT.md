# CP6 — Pedidos, confirmação, recuperação e tempo real · Relatório

Data: 2026-11-25. Resultados de execuções reais. Logs em `planning/evidence/cp6-tests/`; capturas em `planning/evidence/cp6/`. Contratos REST, eventos e recuperação documentados em `planning/API_CONTRACTS.md`.

## 1. Resumo
- **Recibo definitivo** com snapshot imutável:
  - id, status, hash simulado, data e hora;
  - NFTs, edições, quantidades, preços congelados;
  - subtotal, desconto, taxa e total; rede e carteira usadas;
  - explorador simulado identificado como demonstração.

  Mudanças posteriores de preço, estoque, carteira ou perfil não alteram o recibo (teste).
- **Histórico de pedidos** privado, mais recentes primeiro, atualizado em tempo real.
- **Ciclo de vida consolidado**: a API é a única autoridade; estados terminais não regridem; eventos duplicados, antigos ou terminais são ignorados; nenhuma confirmação antes da API.
- **Reserva de estoque com prazo (R-40)**:
  - 10 min no relógio da simulação, controlável nos testes;
  - recusa ou vencimento liberam o estoque uma única vez;
  - confirmação atrasada não confirma; pedidos abandonados não prendem estoque.
- **Recuperação no fluxo real**: refresh, nova aba, URL direta, offline (confirmado e recusado), reconexão, timeout, resposta perdida, sessão expirada e novo login. Sempre um único pedido.
- **Várias abas (PEND-03)**:
  - um único "servidor" lógico por origem (aba líder eleita por Web Lock);
  - as demais encaminham REST e controle por BroadcastChannel;
  - eventos entregues pelo Socket.IO simulado de cada aba;
  - failover quando a aba líder fecha.
- **R-42 e R-44 resolvidos com testes determinísticos** e controles negativos (o teste falha sem a proteção).
- **Testes:** 443 aprovados · 0 reprovados · 6 ignorados (específicos de dispositivo) na suíte completa final (`full-run-1.log`, 10,9 min). Typecheck, lint e build aprovados.

## 2. Funcionalidades
**Pedido e recibo (`/pedidos/:id`, privado)**
- *Pendente*: "Pedido recebido · aguardando a confirmação da rede", prazo da reserva e "Atualizar status".
- *Confirmado*: "Compra confirmada" e o **recibo**:
  - pedido, status, criado em, confirmado em;
  - transação (simulada) com link "Ver no explorador simulado";
  - rede e carteira ("Principal · 0xA91F…E82C · via MetaMask");
  - itens com miniatura, edição e "quantidade × preço" congelados;
  - subtotal, desconto (com cupom), taxa de rede e total;
  - ações "Continuar explorando" e "Ver meus pedidos".
- *Recusado*: "Pagamento recusado" ou "Reserva expirada", "Nenhum valor foi cobrado" e link para o carrinho (os itens continuam lá).
- Estados de carregamento, erro com "Tentar novamente" e "não encontrado" (inclusive pedido de outro usuário).
- Datas no fuso de Brasília.

**Histórico (`/pedidos`, privado; "Meus pedidos" no menu de conta)**: id, selo de status, data, itens e total. Lista vazia com convite a explorar.

**Explorador simulado (`/explorador/tx/:hash`, público)**: hash, status, rede, bloco, endereço, valor e data, com aviso permanente de demonstração. Só dados públicos.

**Reconciliação ao voltar à aba**: `visibilitychange`/`pageshow` reconectam o socket se preciso e refazem as consultas pelo REST.

## 3. Mock (MSW)
- **Ciclo de vida** (`services.ts`):
  - `settleOrder` só age sobre pedido pendente e confere o prazo da reserva antes de confirmar;
  - grava `settledAt` e `failureReason` (`payment_rejected` | `reservation_expired`);
  - a devolução de estoque acontece só na transição para recusado;
  - `expireReservations` vence as reservas (varredura do líder a cada 1 s, antes de cada requisição e a cada `advanceClock`).
- **Snapshot na criação** (`commerce.ts`): edição, arte, apelido da carteira e provedor da conexão gravados no pedido; `reservedUntil`.
- **`order.updated`** passa a levar `settledAt` e `failureReason` (opcionais); o recibo não espera o REST.
- **Novas rotas**: `GET /api/explorer/tx/:hash`; `GET /api/orders` ordenado. Leituras de pedido e carrinho podem ser retidas sob demanda (`hold`), com a resposta **fotografada antes** de reter (corridas determinísticas).
- **Novos controles**: `hold(rota)`, `advanceClock(ms, sweep?)`, `available(nft, edição)`, `emitOrderEvent(id, status, versão)`, `role()`.
- **Novos cenários**: `hold-order-read`, `order-read-error`.
- Persistência: `kurio:mock:db:v6` (com `clockOffsetMs`).
- **Cluster de abas** (`cluster.ts` + `browser.ts`): ver API_CONTRACTS §9.
  - Com uma aba só, ela é o líder e responde com os mesmos handlers (via `getResponse`).
  - Os 376 testes anteriores continuaram passando sem alteração por causa disso (apenas 3 textos "Pagamento confirmado" viraram "Compra confirmada", ver §5).

## 4. Corridas: evidência determinística
| Corrida | Teste | Sem a proteção | Com a proteção |
|---|---|---|---|
| R-42 (REST antigo do pedido após evento novo) | races.spec › R-42 | falha: "confirmed" volta para "pending" (`R-42-SEM-PROTECAO-controle-negativo.log`, 2/2 falhas) | passa |
| R-44 (primeira adição do visitante) | races.spec › R-44 | falha: badge "Carrinho" sem itens (`R-44-SEM-PROTECAO-controle-negativo.log`) | passa; e passa **só com a guarda de versão**, sem o cancelamento (`R-44-SO-GUARDA-DE-VERSAO.log`) |
| Eventos de pedido duplicados, antigos e terminais | races.spec (2 casos) + unit › orders-events (4 casos) | — | passa |

Como os controles negativos foram feitos: a proteção foi removida temporariamente, o teste foi rodado e o log salvo, e o arquivo foi restaurado do backup. Conferido: o arquivo ficou idêntico ao commitado.

## 5. Defeitos encontrados e corrigidos
1. **Recibo incompleto logo após o evento**: o `order.updated` só trazia status e hash; "Confirmado em" e "Reserva expirada" dependiam do próximo REST. O evento passou a levar `settledAt` e `failureReason`.
2. **Teste do CP5 com texto antigo**: "Pagamento confirmado" virou "Compra confirmada" (título do recibo). As 3 ocorrências foram atualizadas, inclusive 2 verificações de ausência que ficariam vazias com o texto antigo (`full-run-pre-a.log`: 2 falhas).
3. **Evidências**: o script recriava o carrinho depois de uma recusa, mas a recusa mantém o carrinho (PAY-07) e a soma excedia o estoque. Ajustado no script; o comportamento do app estava correto.
4. **Teste de "confirmação após o prazo"**: a primeira versão não testava o que dizia. Foi reescrita com `advanceClock(ms, false)`, que avança o relógio sem varrer, para provar que o próprio `settleOrder` recusa.

## 6. Resultados dos testes
**Verificações estáticas** (`typecheck-lint-build.log`): `tsc -b` sem erros · ESLint sem avisos · `vite build` ok.

**Suíte completa** (build de produção + MSW; 4 workers), conforme a orientação do CP6 (uma suíte completa após estabilizar; testes direcionados durante a implementação):

| Rodada | Aprovados | Reprovados | Ignorados | Duração | Observação |
|---|---|---|---|---|---|
| `full-run-pre-a.log` | 441 | 2 | 6 | 10,7 min | texto "Pagamento confirmado" do CP5 (§5.2) |
| **`full-run-1.log`** | **443** | **0** | 6 | 10,9 min | final |

**Por projeto (449 testes):** unit 59 · desktop-chromium 177 · mobile-chromium 177 · responsive 36.

**Novos no CP6 (68):**
- orders.spec: 20 (10 × 2);
- recovery.spec: 14 (7 × 2);
- tabs.spec: 12 (6 × 2);
- races.spec: 8 (4 × 2, 1 ignorado no mobile);
- unit orders-events: 4;
- responsivo: 8 (pedidos e recibo em 8 larguras);
- auth.spec: 2 (`/pedidos` protegido).

**Ignorados (6):** os 5 anteriores + R-44 no mobile (o badge do header só existe no desktop; o mesmo fluxo no mobile é coberto pelos testes de carrinho via API).

**Testes direcionados durante a implementação** (desktop + mobile): orders 10/10 → 20/20; races 7/7 + 1 ignorado; recovery 14/14; tabs 12/12; regressão de PoC/checkout/carrinho/catálogo com o novo despachante: 65/65.

**Controles negativos:** `R-42-SEM-PROTECAO-controle-negativo.log` (2 falhas, esperado), `R-44-SEM-PROTECAO-controle-negativo.log` (1 falha, esperado), `R-44-SO-GUARDA-DE-VERSAO.log` (1 aprovado).

**Cobertura anterior preservada; nenhum teste desativado.** Única adaptação: o texto do título do recibo no checkout.spec.

**Evidências:** `EVIDENCE=1 npx playwright test e2e/cp6.evidence.spec.ts --project=evidence` (3 aprovados).

**Checkout limpo:** não executado neste CP, conforme a orientação (auditoria final no CP9).

## 7. Evidências visuais (`planning/evidence/cp6/`, 390/768/1440)
`pedido-pendente-*`, `pedido-recusado-*`, `pedido-reserva-expirada-*`, `recibo-confirmado-*` (página inteira), `explorador-simulado-*`, `historico-*`. Sem frame no Figma: decisões em VISUAL_ANALYSIS §14. Na captura de página inteira do mobile, a navegação inferior fixa e um toast aparecem no meio da imagem; é artefato da captura de página inteira, não do layout.

## 8. Situação dos requisitos
**Validados (com teste):**
- TELA-05;
- PAY-05, PAY-06, PAY-08 (fluxo real);
- RT-09;
- E2E-06, E2E-10;
- PEND-03; R-40, R-42, R-44, R-13.

A situação completa por teste está na matriz §15.

**Limitações:**
- Troca de líder: RPC em trânsito para a aba que fechou expira em 20 s (R-45).
- Sessão por aba: reabrir a aba pede login (decisão mantida).
- Tempo real entre abas do carrinho: o carrinho não tem evento próprio. A outra aba atualiza ao voltar a ficar visível, ou no próximo refetch.
- Prazo da reserva fixo (10 min).
- O explorador é simulado e público (R-46).

**Pendências:**
- Revisão visual final: VIS-01..13.
- CP7: baselines Linux e CI.
- CP8: Lighthouse oficial.
- CP9: auditoria em checkout limpo, remoção de `/demo/*`, README e deploy (com autorização).

## 9. Commit
COMMIT_INFO
