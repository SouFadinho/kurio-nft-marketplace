# CP5 — Carrinho e checkout · Relatório

Data: 2026-11-24. Resultados de execuções reais. Logs em `planning/evidence/cp5-tests/` (inclusive as rodadas de desenvolvimento que falharam); capturas e comparações em `planning/evidence/cp5/`.

## 1. Resumo
- **Carrinho** completo na API simulada:
  - linhas por NFT + edição; adicionar pelo card do catálogo e pelo detalhe; quantidade, remoção e estoque validado pela API;
  - persiste no refresh; carrinho de visitante com merge determinístico após o login; isolamento entre usuários;
  - cupons válido, inválido e expirado.
- **Valores sempre da cotação da API** (subtotal, desconto, taxa de rede, total), calculada em wei/bigint e devolvida em strings decimais. O cliente não soma nada. O carrinho do Figma desktop (2 × 1.19 + 6 × 1.39 + 9 × 1.79) dá exatamente 26.83 → 26.846 ETH.
- **Pagamento** (Figma desktop e mobile):
  - dados do colecionador; carteiras cadastradas (`useWallets` + `sortWallets`) ou "outra carteira"; rede compatível com o endereço;
  - conexão simulada de WalletConnect, MetaMask e Coinbase Wallet, com recusa e desconexão.
- **Consistência em tempo real**: preço ou estoque que muda durante a revisão gera uma cotação nova. O valor aceito **nunca muda sozinho**: um alerta mostra antes → depois e a compra fica bloqueada até "Aceitar novos valores". Se o cliente não viu a mudança (socket offline), a API recusa a cotação antiga.
- **Pedidos idempotentes**: PEND-01 e PEND-02 resolvidos e testados (mesma chave + mesmo conteúdo = mesmo pedido; conteúdo diferente = 409; timeout e resposta perdida recuperam o mesmo pedido).
- **Confirmação só com status da API**: o pedido aparece como "recebido, aguardando a rede" e só vira "confirmado" quando o `order.updated` (ou o REST) diz isso.
- **Testes:** 376 aprovados · 0 reprovados · 5 ignorados (específicos de dispositivo), em **3 rodadas completas seguidas** (`full-run-1..3.log`). As 4 validações anteriores, cada uma com 1 falha, estão guardadas em `rodada-anterior*` e explicadas em §5: 3 defeitos reais corrigidos e 1 teste instável tornado determinístico.

## 2. Funcionalidades

**Carrinho (`/carrinho`, público)**
- Desktop: tabela NFTs · Preço · Edições · Total, lixeira por linha, "Resumo da carteira" à direita com cupom, "Conectar e finalizar" e "Continuar explorando". Abaixo, "Colecionadores também viram" (como no Figma desktop).
- Mobile: cards com arte, edição, preço e stepper; cupom em pílula; "Conectar e finalizar" fixo na base.
- Total por linha e resumo vêm da cotação (rede Ethereum como estimativa; a rede final é escolhida no pagamento).
- Problemas por linha, ao vivo: estoque abaixo da quantidade ("Só restam N", com "Ajustar para N"), edição esgotada, preço alterado ("era X, agora Y"). Com problema, o checkout fica bloqueado (e a API recusa a cotação).
- Estados: skeleton, vazio, erro com "Tentar novamente", cotação em andamento (resumo ocupado, checkout desabilitado), falha de escrita (o carrinho anterior é preservado).
- Feedback acessível: toasts em região `aria-live` para adicionar, alterar quantidade, remover e cupom; erros de linha em `role=alert`; erro do cupom no campo (`aria-describedby` + `role=alert`).

**Visitante e merge** (`features/cart/guestCart.ts`, `mocks/cart-model.ts`)
- O visitante tem um id aleatório em `localStorage`; o carrinho fica na API (`X-Cart-Id`).
- No login, o carrinho de visitante é mesclado no do usuário com uma regra determinística:
  - linhas do usuário mantêm a posição; linhas novas entram no fim;
  - quantidades da mesma linha somam;
  - o resultado é limitado ao estoque (linhas esgotadas saem), com aviso do que foi ajustado;
  - o cupom do usuário prevalece.
- Depois do merge, o id de visitante é descartado: ao sair, o próximo visitante começa vazio.

**Pagamento (`/pagamento`, rota privada)**
- Dados do colecionador vêm do perfil e podem ser ajustados para o pedido; há validação por campo e foco no primeiro inválido.
- Carteira: rádio com as cadastradas (principal primeiro) ou "Usar outra carteira" (tipo e endereço validados pela rede).
- Rede: só as compatíveis com o endereço (EVM → Ethereum/Polygon; base58 → Solana). A taxa muda com a rede (cotação nova).
- Conexão simulada (API do mock): "Conectar <provedor>" → "Conectada via …"; recusa (cenário `wallet-refused`) com nova tentativa; "Desconectar". Trocar carteira, rede ou provedor desconecta.
- "Confirmar compra" exige carteira conectada, cotação aceita e nenhuma mudança pendente. Se faltar algo, o botão explica o motivo em `role=alert`; ele não fica `aria-disabled` sem explicação.
- Rascunho (nome, e-mail, observação, carteira, rede) em `sessionStorage` por usuário. Se a sessão expira ao confirmar, o login volta para `/pagamento` com tudo preenchido. A compra **nunca** é reenviada sozinha: a conexão e a confirmação são refeitas pela pessoa.

**Pedido (`/pedidos/:id`, rota privada; base do CP6)**
- Mostra apenas o que a API afirma: pendente → "Pedido recebido · aguardando a confirmação da rede"; confirmado (via Socket.IO ou REST); recusado.
- Mostra subtotal, desconto, taxa e total congelados no pedido.

## 3. Mock (MSW)
- `handlers/commerce.ts`:
  - `GET /api/cart`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:lineId`
  - `POST/DELETE /api/cart/coupon`, `POST /api/cart/merge`, `POST /api/cart/quote`
  - `POST/DELETE /api/wallet-connections`
- `POST /api/orders` aceita o `CheckoutRequest`: cotação, rede, comprador, carteira e conexão. A ordem de verificação:
  1. idempotência;
  2. cotação existente, não consumida e não expirada;
  3. condições atuais iguais às da cotação (impressão digital de preços, quantidades, cupom e rede);
  4. estoque;
  5. carteira do usuário e rede compatível;
  6. conexão ativa.

  Depois, grava o pedido com os valores congelados (`pricing`), reserva o estoque (emite `nft.updated`) e agenda a liquidação. Pedidos da PoC (`{ items }`) continuam funcionando.
- **PAY-07** (`services.settleOrder`):
  - confirmado → o carrinho perde **apenas** os itens e quantidades comprados (o que foi adicionado depois fica) e o cupom usado;
  - recusado → o carrinho fica intacto e o estoque reservado volta.
- Precificação pura em `mocks/pricing.ts`. Taxas: Ethereum 0.016 (Figma), Polygon 0.002, Solana 0.001, todas expressas em ETH (R-41).
- Cupons: `KURIO10` (10%), `COLECAO5` (5%), `NATAL2024` (expirado em 31/12/2024). Cotação válida por 5 minutos.
- Cenários novos: `cart-error`, `cart-write-fail`, `hold-quote`, `wallet-refused`, `order-fail` (503 antes de gravar), `order-lost-response` (grava e a resposta se perde), `order-timeout` (grava e responde depois do timeout de 5 s do cliente), `slow-order`.
- Controles novos: `expireQuotes()` e `recover(rota)`.
- Persistência: `kurio:mock:db:v5`.

## 4. Consistência financeira e tempo real
| Situação | Comportamento | Teste |
|---|---|---|
| `nft.updated` de um item no carrinho | carrinho e cotação revalidados; linha mostra preço anterior ou falta de estoque | cart.spec › tempo real |
| Evento repetido ou antigo | descartado pelo EventGuard; o valor não regride | cart.spec › preço muda (replay + stale) |
| Preço muda na revisão do pagamento | alerta antes → depois; valor aceito intacto; compra bloqueada até aceitar; pedido com o novo valor | checkout.spec › preço muda |
| Mudança que o cliente não viu | API recusa (`QUOTE_STALE`); cotação refeita; aceite exigido | checkout.spec › socket offline |
| Estoque acaba | aviso no pagamento; compra bloqueada; carrinho mostra "esgotou" | checkout.spec › estoque acaba |
| Cotação expirada | API recusa (`QUOTE_EXPIRED`); nova cotação com os mesmos valores é adotada sem alarme; confirmação refeita | checkout.spec › cotação expirada |

## 5. Defeitos encontrados e corrigidos (com evidência)
1. **Retry podia criar um SEGUNDO pedido (R-38).**
   - Causa: depois de um timeout, a reserva de estoque gerava uma cotação nova com os mesmos valores, que era adotada (id novo). O retry enviava um conteúdo diferente, portanto com chave nova.
   - Encontrado: testes de timeout e resposta perdida (`dev-cp5-run6.log`: 4 falhas, URL de outro pedido).
   - Correção: uma tentativa sem desfecho conhecido fica congelada, e qualquer confirmação reenvia exatamente o mesmo corpo. O teste de timeout agora confirma pelo botão principal e exige 1 pedido no servidor.
2. **O formulário de pagamento sumia com o retry (R-39).**
   - Causa: com a resposta perdida, o servidor já tinha mexido no carrinho; o carrinho revalidado fazia a página trocar o formulário pelo estado vazio (`dev-cp5-run2.log`).
   - Correção: depois de exibido, o formulário não é mais desmontado; carrinho vazio ou sem estoque vira aviso dentro dele.
3. **PAY-07 violado na primeira versão.**
   - Causa: a criação do pedido esvaziava o carrinho inteiro. Um pagamento recusado perderia o carrinho, e itens adicionados depois seriam apagados.
   - Correção: os itens saem só na confirmação (apenas os comprados), e a recusa devolve o estoque. Há teste novo para a recusa.
4. **Placeholder do cupom cortado** (pedido da revisão visual).
   - O teste de responsividade passou a medir o texto do placeholder contra o espaço do campo; mediu 202 px de texto para 191 px de espaço no desktop e cortes em 360/390 px.
   - Correção: botão compacto, placeholder em 11 px, pílula no mobile e empilhamento abaixo de 375 px. Agora cabe de 360 a 1440 px.
5. **"Confirmar compra" com `aria-disabled`** sem explicação: leitores de tela e o Playwright o tratavam como desabilitado. Agora o botão fica ativo e explica o que falta em `role=alert`.
6. **Corrida antiga (CP1) no pedido (R-42).**
   - Sintoma: a 3ª rodada completa da primeira validação (`rodada-anterior/full-run-3.log`) falhou no teste da PoC "5b. pedido recusado": a tela ficou em "Aguardando" depois do evento de recusa. O mesmo teste já tinha falhado uma vez sob carga no CP4.
   - Causa: a criação do pedido invalidava `['me', user, 'orders']`, que por prefixo também invalidava o próprio pedido. Uma leitura REST em trânsito podia chegar depois do `order.updated` e trazer a versão anterior.
   - Correção: escrita monotônica do pedido (o REST nunca substitui uma versão maior) e invalidação exata da lista.
   - Limite: não há teste determinístico próprio desta corrida; a validação é a suíte completa repetida (3 rodadas novas, §6).
7. **Teste instável de expiração em página pública (R-43, teste do CP4).**
   - Sintoma: falhou em 2 das validações completas (`rodada-anterior-2/full-run-3.log` e a 1ª rodada seguinte): a sessão terminou, mas o aviso não apareceu.
   - Primeira hipótese (inscrição tardia no `sessionStore`): corrigida e **refutada**, porque a falha voltou. A mudança foi revertida.
   - Reprodução com log de depuração temporário (24 repetições, 7 falhas; `expiracao-publica-ANTES-24x.log`): em todas as falhas, quem detectou a expiração foi a página ANTIGA (uma leitura privada ainda em trânsito após o login recebeu o 401 entre "expirar no servidor" e o reload). O aviso apareceu na página que estava sendo descartada, e a nova já nascia deslogada. O app estava correto nas duas ordens.
   - Correção no teste: invalidar o token guardado na aba; só a página recarregada o usa. Resultado: 48/48 repetições (`expiracao-publica-DEPOIS-48x.log`).
8. **Primeira adição do visitante podia sumir do badge (R-44).**
   - Sintoma: 1 falha em `rodada-anterior-4/full-run-2.log`: o badge ficou em "Carrinho" depois de "adicionado ao carrinho".
   - Causa: a primeira adição cria o id de visitante, o que habilita a leitura do carrinho. Essa leitura corre junto do POST; se lê o servidor antes do commit e responde depois, sobrescreve o carrinho novo com o vazio.
   - Correção: leitura monotônica pela `version` do carrinho e cancelamento das leituras em trânsito antes de gravar o resultado de uma escrita.
   - Validação: 32/32 repetições do teste e 3 rodadas completas. Não medi a taxa de falha antes da correção isoladamente.
9. **Testes:**
   - o estado de erro do carrinho era mascarado pela reconciliação REST da primeira conexão (que reinicia a consulta). O cenário passou a falhar até `recover('cart.read')`: recuperação determinística sem aumentar retries;
   - um seletor do CP3 ficou ambíguo com o novo botão do card e foi tornado específico;
   - o teste do CP3 que garantia "compra não simula sucesso" foi **adaptado**: agora confere o efeito real na API.

## 6. Resultados dos testes
**Verificações estáticas** (`typecheck-lint-build.log`): `tsc -b` sem erros · ESLint sem avisos · `vite build` ok.

**Suíte completa** (`npx playwright test`; build de produção + MSW; 4 workers):

| Validação | Rodada 1 | Rodada 2 | Rodada 3 | Falha e destino |
|---|---|---|---|---|
| `rodada-anterior/` | 376 ✓ | 376 ✓ | 375 + 1 ✗ | PoC 5b → corrida do pedido (defeito 6, corrigido) |
| `rodada-anterior-2/` | 376 ✓ | 376 ✓ | 375 + 1 ✗ | expiração pública → teste instável (item 7; hipótese inicial refutada) |
| `rodada-anterior-3/` | 375 + 1 ✗ | 376 ✓ | 376 ✓ | a mesma (antes da reprodução) |
| `rodada-anterior-4/` | 376 ✓ | 375 + 1 ✗ | 376 ✓ | primeira adição do visitante (defeito 8, corrigido) |
| **final** (`full-run-1..3.log`) | **376 ✓** | **376 ✓** | **376 ✓** | — (7,0 a 8,8 min por rodada) |

Todas com 5 ignorados.

**Por projeto (381 testes):** unit 55 · desktop-chromium 149 · mobile-chromium 149 · responsive 28.

**Novos no CP5 (81):**
- cart.spec: 26 (13 × 2 viewports);
- checkout.spec: 34 (17 × 2);
- unit commerce: 9;
- responsivo: 8 (carrinho e pagamento em 8 larguras, com medição do placeholder do cupom);
- visual: 4 (baselines de Carrinho e Pagamento × 2).

**Ignorados (5):** os mesmos do CP4 (2 do CP3 + 3 específicos de dispositivo).

**Cobertura anterior preservada; nenhum teste desativado.** Adaptações justificadas:
- `nft-detail.spec`: "comprar/adicionar não simulam sucesso" virou "adicionar grava na API; comprar leva ao pagamento";
- `catalog.spec`: seletor do favoritar mais específico (o card ganhou o botão de carrinho);
- `auth.spec`: expiração pública determinística (item 7).

**Reproduções:** `expiracao-publica-ANTES-24x.log` (7 falhas) → `expiracao-publica-DEPOIS-48x.log` (48/48); `card-primeira-adicao-DEPOIS-32x.log` (32/32).

**Evidências:** `EVIDENCE=1 npx playwright test e2e/cp5.evidence.spec.ts --project=evidence` (5 aprovados).

## 7. Evidências visuais (`planning/evidence/cp5/`)
- `carrinho-{390,768,1440}.png`, `pagamento-{390,768,1440}.png` (página inteira), `pagamento-conectado-*`.
- Estados: `estado-carrinho-vazio-*`, `estado-carrinho-estoque-preco-cupom-*` (estoque insuficiente, preço alterado e cupom expirado juntos), `estado-pagamento-valores-mudaram-*`, `pedido-pendente-1440`.
- Comparações com o Figma **na mesma escala** (`scripts/evidence/compare-cp5.mjs`): `comparacao-carrinho-desktop`, `comparacao-pagamento-desktop`, `comparacao-carrinho-mobile`, `comparacao-pagamento-mobile`.
- Ajustes feitos a partir das comparações:
  - cupom em pílula no mobile, com o placeholder inteiro;
  - "Colecionadores também viram" no carrinho desktop;
  - valores do resumo com a mesma hierarquia do Figma.
- Baselines visuais (TEST-02): Carrinho e Pagamento adicionados; Início regenerado (botão de carrinho nos cards).

## 8. Diferenças em relação ao Figma (detalhe em VISUAL_ANALYSIS §13)
1. Carrinho no card sempre visível (canto inferior), favoritar no canto superior (CP3).
2. Carrinho mobile com "Total + Remover" por linha e título no resumo (VIS-09).
3. Pagamento: dados do colecionador simplificados (sem campos de carteira repetidos nem código de indicação); no mobile eles aparecem antes das carteiras.
4. Passo de conexão e alerta de valores alterados derivados (sem frame).
5. Registrados para a revisão visual final, conforme pedido: **VIS-07** (Carteiras mais próxima do formulário original do Figma, preservando os rótulos acessíveis) e **VIS-08** (posição do modal de login no desktop).

## 9. Situação dos requisitos
**Validados (com teste):**
- TELA-03, TELA-04 (funcional);
- CART-01..06;
- PAY-01, PAY-02, PAY-03, PAY-04, PAY-07;
- INT-09, API-03, RT-01 (carrinho/pagamento), RT-08;
- E2E-05, E2E-07, E2E-09, E2E-11, E2E-12;
- PEND-01, PEND-02.

**Parcialmente implementados:**
- PAY-05/PAY-06: estados pendente/confirmado/recusado vindos da API na tela do pedido; a recuperação após refresh/reconexão do pedido do checkout usa o mesmo mecanismo validado na PoC, mas o fluxo completo é do CP6;
- PAY-08: valores congelados no pedido, sem recibo nem explorer;
- E2E-06: até o pedido confirmado, sem o recibo final;
- E2E-10: eventos duplicados/antigos no carrinho; pedido pendente só na PoC.

**Pendentes do CP6:**
- recibo imutável (snapshot) com tx hash e explorer simulados;
- tela de confirmação final;
- histórico de pedidos;
- recuperação de pedido pendente após refresh/reconexão no fluxo real;
- prazo de reserva de estoque (R-40);
- consistência entre abas (PEND-03).

## 10. Limitações e decisões
- Taxas de Polygon e Solana fictícias e em ETH (R-41). Nenhuma carteira, blockchain ou pagamento real.
- O estoque é reservado na criação do pedido e só volta na recusa; pedidos pendentes abandonados mantêm a reserva (R-40, CP6).
- Uma conexão de carteira ativa por usuário (conectar outra substitui).
- A cotação do carrinho usa a rede Ethereum como estimativa; a rede final vem do pagamento.
- O rascunho do pagamento fica em `sessionStorage` (por aba), sem dados sensíveis.
- `/demo/*` continua no build até a entrega (PoC dos CPs anteriores).

## 11. Pendências
- CP6: recibo, confirmação final, histórico de pedidos e recuperação do pedido pendente no fluxo real; reserva com prazo; PEND-03.
- Revisão visual final: VIS-01..09.
- Baselines Linux (CP7) e Lighthouse oficial (CP8).

## 12. Commit e validação
COMMIT_INFO
