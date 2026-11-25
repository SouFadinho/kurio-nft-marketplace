# KURIO — Handoff técnico (preparação para a avaliação)

Objetivo: permitir explicar e defender cada decisão com o código aberto. As referências apontam para arquivos reais. Documentos complementares: `ARCHITECTURE.md` (visão completa), `planning/API_CONTRACTS.md` (contratos), `planning/RISK_REGISTER.md` (problemas e mitigações).

## 1. A arquitetura em poucas frases

- É uma SPA React. Não existe backend: o **MSW** roda no navegador e faz o papel do servidor.
  - REST: um Service Worker intercepta `/api/*` e executa handlers que leem e gravam um "banco" no `localStorage`.
  - Socket.IO: o MSW intercepta o `WebSocket` da página, e o `@mswjs/socket.io-binding` fala o protocolo Socket.IO. O app usa o `socket.io-client` de verdade, sem saber que o servidor é simulado.
- A aplicação segue um caminho único: **componente → hook do TanStack Query → Axios → MSW**. Os eventos fazem **servidor simulado → socket.io-client → cache do Query**. A UI nunca escreve "sucesso" por conta própria: ela mostra o que a API ou o evento disseram.
- O código da simulação (`src/mocks/`) só é importado por `src/main.tsx`. Uma regra de lint (`eslint.config.js`) proíbe a UI de importar os mocks.

## 2. Decisões principais e por quê

| Decisão | Por quê | Onde |
|---|---|---|
| Schemas zod como fonte única dos contratos | o mesmo schema valida a resposta no cliente e o corpo no mock; tipos derivados, sem duplicação | `src/api/contracts.ts` |
| Query keys privadas sob `['me', userId]` | isolar o cache por usuário e limpar a sessão inteira com um prefixo | `src/api/queryKeys.ts` |
| Época da sessão no Axios | descartar respostas que saíram numa sessão anterior (logout/troca durante a requisição) | `src/api/http.ts`, `features/auth/sessionStore.ts` |
| Dinheiro em `bigint` de wei | strings decimais exatas; `0.1 + 0.2` não vira `0.30000000000000004` | `src/lib/eth.ts` |
| Cotação da API como única fonte dos valores | o enunciado manda; a UI não soma preços | `features/cart/QuoteSummary.tsx`, `mocks/pricing.ts` |
| Chave de idempotência por tentativa, salva no `localStorage` | timeout, clique duplo e refresh recuperam o mesmo pedido | `features/checkout/queries.ts` |
| Recibo como snapshot gravado na criação do pedido | alterações posteriores no catálogo não mudam o recibo | `mocks/handlers/commerce.ts`, `features/orders/OrderStatusPage.tsx` |
| Guarda de eventos por `eventId` + `version` | tolerar duplicatas e eventos antigos sem regredir o estado | `src/realtime/eventGuard.ts` |
| Leituras REST monotônicas (carrinho e pedido) | uma resposta antiga em trânsito não sobrescreve um evento mais novo | `features/orders/queries.ts`, `features/cart/queries.ts` |
| Líder único entre abas (Web Lock + BroadcastChannel) | duas abas gravando no mesmo `localStorage` perderiam atualizações | `src/mocks/cluster.ts` |
| Testes contra o build de produção | testar o mesmo artefato que vai para o deploy, com o MSW ativo | `playwright.config.ts` (`webServer`) |
| Cenários como dados | falhas determinísticas e reproduzíveis por URL, sem `if (cenário)` na UI | `src/mocks/scenarios.ts`, `src/mocks/failures.ts` |

## 3. Problemas reais encontrados e como foram diagnosticados

1. **O WebSocket ia para a rede real (CP1).** Sintoma: "Unexpected response code: 200". Ao ler o código do MSW 2.15, descobri que ele remove `/socket.io/` do caminho antes de comparar, então o handler nunca casava. Solução: RegExp que aceita as duas formas (`mocks/realtime/server.ts`). Havia uma segunda causa: o `engine.io-client` guarda `globalThis.WebSocket` ao ser avaliado, então o cliente precisa ser carregado **depois** do MSW (`main.tsx`, `RealtimeProvider.tsx`).
2. **Handshake confirmado antes da autenticação (CP1).** O binding enviava o ACK do CONNECT (`40`) antes de o servidor validar o token. Um "portão" segura o ACK até a validação. O teste T6c tem controle negativo: sem o portão, ele detecta o `40` prematuro.
3. **Preço voltava ao valor antigo de forma intermitente (CP3, R-29).** Uma resposta REST que saiu antes de um `nft.updated` chegava depois e regredia o preço. Diagnóstico: cenário `stale-in-flight`, que retém a resposta e libera depois do evento, tornando a corrida determinística. Correção: memorizar o último evento por NFT e reaplicar de forma monotônica.
4. **Pedido continuava "pendente" após refresh (CP3, R-30).** O evento era emitido antes de o socket autenticar e se perdia. Correção: reconciliar pelo REST também na primeira conexão, se já houver dados em cache.
5. **Dado de um usuário aparecendo para outro (CP4, R-34).** Uma resposta atrasada de Ana podia chegar depois de Bruno entrar. Teste: o cenário `slow-private` retém as leituras e um `MutationObserver` registra se o dado aparece por um único frame. Correção: cancelar e remover `['me']` na troca de sessão e descartar respostas de outra época.
6. **Segundo pedido após timeout (CP5, R-38).** Com a cotação renovada, o retry gerava chave e corpo novos. Correção: uma tentativa sem desfecho conhecido fica **congelada** (mesma chave, mesmo corpo) até o resultado ser conhecido.
7. **Leitura antiga do pedido sobrescrevendo o evento terminal (CP5 → CP6, R-42).** Teste determinístico em `races.spec`: retém a leitura (v1), entrega o evento (v2), libera a leitura e exige v2. O controle negativo (sem a escrita monotônica, o teste falha) está em `planning/evidence/cp6-tests/`.
8. **CLS de 0,31 no Detalhe (CP8).** Medido no Lighthouse: a fonte mono entrava e mudava as métricas do texto. Correção: `@font-face` de fallback com `ascent/descent-override` (`src/index.css`); CLS passou a 0.
9. **Rodapé escondido sob a barra de compra no mobile (CP8).** Encontrado por um teste novo de acessibilidade (VIS-05), não por inspeção. A barra do detalhe é mais alta que a navegação inferior para a qual o rodapé reservava espaço.

## 4. Condições de corrida corrigidas: exemplos para mostrar

- **REST × evento no pedido:** `e2e/races.spec.ts` › leitura antiga do pedido. Mostre `mock.hold('orders.read')`, o evento e o `release`.
- **Carrinho do visitante na primeira adição (R-44):** o mesmo arquivo. A leitura do carrinho vazio é liberada depois do POST; sem as proteções, o badge zerava.
- **Troca de usuário com resposta retida:** `e2e/isolation.spec.ts` (MutationObserver + `requestfailed` mostrando o cancelamento).
- **Clique repetido e timeout:** `e2e/checkout.spec.ts` › idempotência. Ao final, `mock.orders()` tem exatamente 1 pedido.

## 5. Como funciona a idempotência

1. Antes de enviar, o pagamento grava `{ key, payload }` em `kurio:checkout-attempt:<userId>`.
2. `POST /api/orders` leva o header `Idempotency-Key`. O mock guarda o hash do corpo por chave:
   - mesma chave + mesmo corpo → devolve **o mesmo pedido**;
   - mesma chave + corpo diferente → `409 IDEMPOTENCY_KEY_REUSED`.
3. Se a resposta se perde ou estoura o timeout, o pedido **já pode existir**. O reenvio usa a mesma chave e o mesmo corpo (congelado), e o servidor devolve o pedido existente.
4. Após refresh ou em outra aba, `GET /api/orders/by-key/:key` (não cria nada) descobre se a tentativa virou pedido. Se sim, a UI vai para ele.
5. A tentativa é apagada quando o desfecho é conhecido. A garantia está no **servidor**: o botão desabilitado é só conforto.

Cenários para demonstrar: `order-timeout`, `order-lost-response`, `slow-order` (cliques repetidos).

## 6. Como o Socket.IO funciona com o MSW

- `ws.link(RegExp)` intercepta a conexão WebSocket da página. `toSocketIo(connection)` do binding codifica e decodifica os pacotes Socket.IO. O servidor simulado (`src/mocks/realtime/server.ts`):
  - valida o token do handshake antes de confirmar o CONNECT;
  - mantém o heartbeat;
  - entrega eventos públicos a todos e privados só ao dono;
  - simula queda e volta (`realtime.setOnline`).
- Só transporte WebSocket: o MSW não intercepta o long-polling HTTP do Engine.IO.
- Os eventos nascem de mudanças no banco simulado (`services.ts`: `updateNft`, `settleOrder`…), nunca da UI. Os testes de tempo real passam pelo `socket.io-client`.
- Com várias abas, o líder publica os eventos num barramento interno, e cada aba os entrega às próprias conexões Socket.IO.

## 7. Limitações de segurança e performance (dizer claramente)

**Segurança:**
- Tudo é simulado e visível no navegador do usuário: o banco simulado, os tokens e as regras podem ser alterados pelo DevTools.
- O hash PBKDF2 só existe para não guardar senha em claro, como pede o enunciado; não é proteção real.
- A sessão fica no `sessionStorage`; em produção seria um cookie `httpOnly`.
- Não há CSRF, rate limiting nem auditoria real.

**Performance:**
- Desktop ≥ 97.
- **Mobile abaixo de 90** (Início ~54–70, Detalhe ~64). A imagem principal depende da cadeia JS → MSW (175 kB transferidos) → Service Worker → App → API simulada, sob 4G lento e CPU 4×.
- Tentativas medidas e revertidas: renderizar antes do MSW (piorou o TBT) e reduzir imagens (LCP inalterado).
- Resolver exigiria uma mudança estrutural (pré-renderização ou API fora do navegador).

**Acessibilidade:** auditoria automatizada sem violações. Sem teste com leitor de tela; não há declaração de conformidade WCAG.

## 8. Perguntas prováveis do avaliador

1. **Por que o MSW não atrapalha a produção?**
   Ele só é carregado com `VITE_ENABLE_MOCKS=true` e por import dinâmico em `main.tsx`; com a variável desligada, não entra no bundle. Na demonstração ele **é** o backend, por isso fica ligado no deploy.
2. **Como você garante que a UI não simula sucesso?**
   - O lint proíbe a UI de importar `src/mocks`.
   - "Compra confirmada" só aparece com `status === 'confirmed'` vindo da API.
   - Os testes conferem o efeito no servidor (`mock.orders()`, `mock.available()`), não só na tela.
3. **O que acontece com dois cliques rápidos em "Confirmar compra"?**
   As duas requisições levam a mesma chave e o mesmo corpo, e o servidor devolve o mesmo pedido. `checkout.spec` exige 1 pedido no servidor.
4. **E se a resposta do pedido se perder?**
   O pedido pode existir. O reenvio com a mesma chave e o corpo congelado recupera o mesmo pedido; depois de um refresh, `orders/by-key` encontra a tentativa. Cenários `order-timeout` e `order-lost-response`.
5. **Como você evita mostrar dados de Ana para Bruno?**
   - Chaves `['me', userId]` no cache.
   - Cancelamento e remoção do cache na troca de sessão (`SessionEffects.tsx`).
   - Época da sessão no Axios, para respostas atrasadas.
   - Socket destruído e recriado com o novo token.
   - O mock filtra por dono (404) e entrega eventos privados só ao dono.
   
   Teste: `isolation.spec`.
6. **E um evento duplicado ou antigo?**
   O `eventGuard` descarta `eventId` repetido e `version <=` a conhecida (o máximo entre o último evento e o cache). Estados terminais nunca regridem. Testes: `races.spec` e unitários.
7. **O que acontece na reconexão?**
   O `RealtimeProvider` reconcilia os recursos ativos pelo REST no reconnect, no `visibilitychange` e no `pageshow`. Leituras monotônicas impedem que essa reconciliação regrida algo.
8. **Por que `bigint` e não `number` ou `decimal.js`?**
   `number` perde precisão em decimais. `bigint` de wei é exato, nativo e fácil de explicar, sem dependência. O arredondamento só acontece na exibição.
9. **Quem calcula o total?**
   A API (cotação). A UI só exibe. O pedido referencia a cotação aceita; se algo mudou, `409 QUOTE_STALE` e a UI exige nova confirmação mostrando antes → depois.
10. **Como o preço muda durante o checkout?**
    `__kurioMock.updateNft` altera o banco e emite `nft.updated`. O `socket.io-client` recebe o evento, o cache é atualizado e a cotação é refeita. A compra fica bloqueada até o usuário aceitar. Teste: `checkout.spec` › consistência financeira.
11. **E se o socket estiver offline quando o preço mudar?**
    A UI não vê a mudança, mas a API recusa o pedido com a cotação velha (`QUOTE_STALE`). A defesa está no servidor, não no evento.
12. **Por que um líder entre abas?**
    Cada aba roda o próprio MSW. Duas escrevendo no mesmo `localStorage` perderiam atualizações e a idempotência não valeria entre abas. Com o Web Lock há um único escritor, e as outras abas fazem RPC por `BroadcastChannel`.
13. **E se a aba líder fechar no meio de uma requisição?**
    A próxima da fila assume. RPCs pendentes são rejeitadas na hora, e o cliente trata como erro de rede; o reenvio idempotente recupera. Testes: `hardening.spec` e `tabs.spec`.
14. **Como o carrinho do visitante vira o do usuário?**
    O visitante tem um identificador aleatório; o carrinho fica na API. No login, `POST /cart/merge` soma as quantidades limitadas ao estoque e descarta o identificador.
15. **Por que o recibo não muda se o preço muda depois?**
    É um snapshot gravado na criação do pedido, e a tela lê só o pedido. `orders.spec` altera preço, estoque, carteira e perfil depois e confere o recibo.
16. **Onde está a atualização otimista?**
    Em favoritos: `onMutate` guarda o estado e aplica, `onError` restaura com o erro real. Cenário `favorite-fail`.
17. **Como os testes controlam o tempo?**
    - Relógio da simulação (`advanceClock`, para reservas).
    - Liquidação manual (`settleOrder`).
    - Retenção e liberação de rotas (`hold`/`release`).
    - `page.clock` nas baselines visuais.

    `retries: 0`, sem aumentar timeouts para esconder corridas.
18. **Por que a performance mobile não chegou a 90?**
    O LCP é a imagem do NFT, que só existe depois da API simulada, e a API depende de baixar e iniciar o MSW. Com 4G lento e CPU 4×, isso leva cerca de 5 s. Medi e corrigi o que dependia de mim: CLS, hash do seed, carregamento paralelo e socket sob demanda. Testei e reverti o que não ajudou. Não desliguei o MSW nem criei build especial, porque o enunciado proíbe.
19. **O que mudaria num produto real?**
    - API real com cookie `httpOnly`, CSRF e rate limit.
    - Idempotência persistida no servidor e eventos com fila e entrega garantida.
    - SSR ou pré-renderização do shell.
    - Imagens com CDN e `srcset`.
    - Testes também em Firefox e WebKit.
20. **Como reproduzir tudo do zero?**
    `npm ci`, `npm run build`, `npm run test:e2e` (sobe o preview sozinho), `npm run audit:lighthouse`. O checkout limpo do CP9 está documentado em `planning/CP9_REPORT.md`.
