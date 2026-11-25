# KURIO · Contratos REST, eventos e recuperação (API simulada)

Fonte única dos tipos: `src/api/contracts.ts` (zod). O cliente e o mock usam os **mesmos** schemas. Valores em ETH são strings decimais; toda a conta é feita em wei (bigint) no "servidor" (`src/mocks/pricing.ts`). Erros seguem `ApiErrorBody = { code, message, details? }`.

## 1. Autenticação e sessão
| Método e rota | Auth | Resposta | Erros |
|---|---|---|---|
| `POST /api/auth/login` | — | `SessionResponse` (token, expiresAt, user) | 401 `UNAUTHORIZED` (genérico), 422 |
| `POST /api/auth/register` | — | 201 `SessionResponse` (entra direto) | 409 `CONFLICT` (`details.email`/`details.username`), 422 |
| `GET /api/auth/session` | Bearer | `{ user }` | 401 `SESSION_EXPIRED` |
| `POST /api/auth/logout` | Bearer | 204 (encerra as conexões Socket.IO do token em todas as abas) | — |

Sessão por aba (`sessionStorage`). Um 401 numa requisição autenticada expira a sessão no cliente: em rota privada ou com ação pendente, vai ao login com `?redirect=` e `motivo=expirada`; em página pública, segue como visitante com aviso.

## 2. Catálogo e favoritos
`GET /api/nfts` (busca, filtros, ordenação, paginação; 422 para parâmetros inválidos) · `GET /api/nfts/:id` · `GET /api/highlights` · `GET/PUT/DELETE /api/favorites[/:nftId]` (Bearer).

## 3. Conta
`GET/PUT /api/me/profile` (409 conflitos) · `PUT/DELETE /api/me/avatar` (422 > 512 KB) · `PUT /api/me/password` (422 senha atual) · `GET/POST /api/me/wallets` · `PUT /api/me/wallets/:id` (404 se não for do usuário) · `POST /api/me/wallets/:id/primary`.

## 4. Carrinho, cupom e cotação
Dono do carrinho: `Authorization: Bearer` (usuário) **ou** `X-Cart-Id: <uuid>` (visitante).

| Método e rota | Corpo | Resposta | Erros |
|---|---|---|---|
| `GET /api/cart` | — | `Cart` (linhas com estoque atual e `issue`) | 400 sem dono |
| `POST /api/cart/items` | `AddCartItem` (`editionId` opcional) | `Cart` | 404, 409 `OUT_OF_STOCK`, 422 |
| `PATCH /api/cart/items/:lineId` | `{ quantity }` | `Cart` | 404, 409 `OUT_OF_STOCK` |
| `DELETE /api/cart/items/:lineId` | — | `Cart` | 404 |
| `POST /api/cart/coupon` | `{ code }` | `Cart` | 422 `COUPON_INVALID`, 422 `COUPON_EXPIRED` |
| `DELETE /api/cart/coupon` | — | `Cart` | — |
| `POST /api/cart/merge` | `{ guestCartId }` (Bearer) | `{ cart, adjusted, merged }` | 401 |
| `POST /api/cart/quote` | `{ network }` | `Quote` (5 min de validade) | 409 `CART_EMPTY`, 409 `OUT_OF_STOCK` |

Merge determinístico (`src/mocks/cart-model.ts`): linhas do usuário mantêm a posição; quantidades somam; limite pelo estoque; cupom do usuário prevalece; o carrinho de visitante é apagado.

## 5. Checkout e pedidos
| Método e rota | Corpo / headers | Resposta | Erros |
|---|---|---|---|
| `POST /api/wallet-connections` | `{ provider, network, address }` | 201 `WalletConnection` | 403 `WALLET_REJECTED`, 422 rede incompatível |
| `DELETE /api/wallet-connections/:id` | — | 204 | — |
| `POST /api/orders` | `CheckoutRequest` + `Idempotency-Key` | 201 `Order` (pendente) · 200 mesmo pedido (mesma chave e mesmo conteúdo) | 409 `IDEMPOTENCY_KEY_REUSED`, 409 `QUOTE_STALE`/`QUOTE_EXPIRED`, 409 `OUT_OF_STOCK`, 409 `WALLET_DISCONNECTED`, 422 |
| `GET /api/orders` | Bearer | `OrderList` (do usuário, mais recentes primeiro) | 401 |
| `GET /api/orders/:id` | Bearer | `Order` | 404 se não existir **ou for de outro usuário** |
| `GET /api/explorer/tx/:hash` | — | `ExplorerTx` (`demo: true`; só dados públicos de transação confirmada) | 404 |

Ordem de verificação em `POST /api/orders`:
1. idempotência (antes de tudo: um retry sempre recebe o pedido original);
2. cotação do usuário, não consumida e não vencida;
3. condições atuais iguais às da cotação (impressão digital de preços, quantidades, cupom e rede);
4. estoque;
5. carteira do usuário e rede compatível;
6. conexão ativa.

**Snapshot do recibo** (`Order`): linhas com nome, edição, arte e preço unitário **congelados**; `pricing` com subtotal, desconto, taxa, rede, cupom, endereço, apelido da carteira e provedor; `createdAt`, `settledAt`, `txHash`, `failureReason`. O recibo nunca lê o catálogo, o perfil nem as carteiras depois da criação.

## 6. Ciclo de vida do pedido e reserva de estoque (R-40)
```
            criação (reserva o estoque, reservedUntil = agora + 10 min)
                │
             pending ──── confirmação da rede ───► confirmed  (consolida; o carrinho perde só o que foi comprado)
                │
                ├──────── recusa da rede ─────────► rejected (payment_rejected; devolve o estoque)
                └──────── prazo da reserva vence ─► rejected (reservation_expired; devolve o estoque)
```
- A API é a única autoridade. Estados terminais nunca mudam (servidor e cliente).
- A devolução do estoque acontece só na transição `pending → rejected`, que ocorre uma única vez.
- Uma confirmação que chega **depois** do prazo vira recusa por reserva vencida (`settleOrder` confere o prazo antes de confirmar).
- O relógio da simulação (`now()` = tempo real + `clockOffsetMs`) é controlável nos testes (`__kurioMock.advanceClock(ms, sweep?)`).
- A varredura das reservas roda no líder a cada 1 s, antes de cada requisição atendida e a cada `advanceClock`. Pedidos abandonados não prendem estoque.

## 7. Eventos Socket.IO
Envelope comum: `{ eventId, type, resource: { type, id }, version, occurredAt, userId?, data }`.

| Evento | Destino | `data` |
|---|---|---|
| `nft.updated` | todas as conexões aceitas | `{ price, available, editions[] }` |
| `order.updated` | só as conexões autenticadas do dono | `{ status, txHash, settledAt?, failureReason? }` |

Regras no cliente (`src/realtime/`):
- **EventGuard:** descarta duplicatas pelo `eventId` e versões antigas ou iguais às do cache.
- **Pedido:** estados terminais nunca são sobrescritos; eventos de outro usuário são descartados mesmo que o servidor erre o roteamento.
- **Leituras REST monotônicas:** pedido, carrinho e NFTs. Uma resposta antiga que chega depois de um evento mais novo não regride o cache (R-42, R-44 e CP3).
- **Reconciliação REST:** na reconexão, na primeira conexão com dados em cache e ao voltar a aba (`visibilitychange`/`pageshow`).

## 8. Recuperação do pedido (validada em `e2e/recovery.spec.ts`)
| Situação | Comportamento |
|---|---|
| Refresh com pedido pendente | o REST traz o estado; a liquidação continua (agendamento persistido e retomado pelo líder) |
| Fechar e reabrir a aba / acesso direto à URL | rota privada pede login (sessão é por aba) e volta ao pedido; o estado vem do REST |
| Desconexão durante a liquidação | nada é presumido; ao reconectar, a reconciliação REST traz confirmado ou recusado |
| Timeout ou resposta perdida após a criação | retry com a MESMA chave e o MESMO conteúdo devolve o pedido original |
| Sessão expira com o pedido pendente | login com aviso e retorno ao pedido |

Em nenhum caso a recuperação cria um novo pedido.

## 9. Várias abas (PEND-03)
- O cluster de abas (`src/mocks/cluster.ts`) elege um **líder** por Web Lock (`kurio-mock-leader`).
- O líder executa os handlers, o banco, os timers e a varredura. As demais abas encaminham REST e controle ao líder por `BroadcastChannel` (RPC).
- Eventos de domínio vão por um barramento interno até o servidor Socket.IO simulado de **cada** aba, e dali para o socket.io-client: o barramento não toca no cache da UI.
- Se o líder fechar, a próxima aba da fila assume, recarrega o estado persistido e retoma liquidações e reservas.
- Garantias:
  - escritas serializadas num único thread (sem perda de atualização);
  - idempotência entre abas;
  - isolamento por token e por usuário.
- Limites:
  - RPC em trânsito durante a troca de líder pode expirar (20 s) e virar erro de rede (o retry idempotente cobre);
  - a sessão continua por aba.
