# CP10 — Auditoria final independente

Data: 25/11/2026. **A candidatura NÃO foi enviada.** Nenhum e-mail ou contato com a empresa foi feito.

Escopo: conferir a entrega contra cada requisito do `CHALLENGE.md`, revisar a aplicação publicada como um avaliador faria, investigar a falha intermitente de contraste no recibo e corrigir apenas problemas verificados.

## 1. Ponto de partida verificado

| Item | Evidência | Resultado |
|---|---|---|
| Run 45685790438 do GitHub Actions | commit `aebe686`, push, 19:30 → 19:41 UTC | **success**: job de qualidade com 65 unitários + **417 passed, 0 failed**, 9 skipped; job Lighthouse independente: success; baselines Linux (manual): skipped |
| Produção = commit final | alias `kurio-nft-marketplace-flax.vercel.app` → deploy `dpl_xshAKtKrF1rF31SSE2akyffB4Hf2`, o mesmo do status da Vercel no commit `aebe686`; `origin/main` = HEAD local = `aebe686` | confere |

## 2. Falha intermitente de contraste no recibo

**Histórico:** uma única violação `color-contrast (1)` na auditoria "recibo" (mobile, sob carga, CP9.2). Não se repetiu em 86 execuções. A mensagem do teste da época não registrava o nó.

### 2.1 O que foi descartado (medido)

As sondas foram temporárias e já foram apagadas. Todas rodaram com axe 4.14 nos projetos mobile e desktop.

| Hipótese | Medição | Resultado |
|---|---|---|
| Cor no limite do contraste | Razão de todos os textos do recibo: pendente, confirmado (na hora e após 1,5 s) e recusado | 0 violações. Menor razão **6,25:1** (botão "Atualizar status" pendente). Nada perto de 4,5:1 |
| Estado de hover | Os 24 a 26 elementos interativos visíveis, cada um em hover, auditados após 40 ms e 400 ms | 0 violações |
| Transição do painel de status | Animações ativas na troca pendente → confirmado (`document.getAnimations()`), auditoria com elas congeladas | Nenhuma animação nessa troca; 0 violações |
| Carga de CPU | Auditorias repetidas por 3 s após confirmar, com CPU 1×, 4× e 8× (CDP) | 0 violações |

### 2.2 Causa encontrada

O helper `placeOrder` conecta a MetaMask simulada, e isso exibe o toast "Carteira conectada via MetaMask" (`CheckoutPage.tsx:216`). O toast dura 4 s e continua na tela depois da navegação para `/pedidos/:id`: no instante da auditoria "recibo" ele estava visível, com opacidade 1.

A saída do toast é uma transição de opacidade de 400 ms. Com a animação congelada em pontos intermediários e uma auditoria restrita ao toast (rápida o bastante para caber na janela):

| Momento | Opacidade | Desktop | Mobile |
|---|---|---|---|
| Parado | 1 | ok, **15,57:1** | ok, 15,57:1 |
| Saída 15% | 0,81 | ok, 10,80:1 | incompleto (parcialmente encoberto) |
| Saída 30% | 0,49 | ok, 4,64:1 | incompleto |
| Saída 50% | 0,20 | **VIOLAÇÃO 1,74:1** (`#433c38` sobre `#170f0c`) | incompleto |
| Saída 70% | 0,06 | **VIOLAÇÃO 1,12:1** | incompleto |

Uma auditoria de página inteira leva cerca de 0,7 s. Se ela começa enquanto o toast está perto de expirar, o axe mede o título semitransparente e acusa exatamente 1 nó de `color-contrast`. A carga da máquina muda o tempo decorrido entre a conexão da carteira e a auditoria, por isso a falha só aparecia sob carga.

**Grau de certeza:** o mecanismo foi reproduzido de forma determinística no desktop. No mobile, a saída congelada deu "incompleto": durante a saída, o toast sobe e fica sob a barra superior. A ocorrência original foi no mobile e não registrou o nó. Por isso a atribuição dessa ocorrência específica é **muito provável, não comprovada**. Nenhuma outra fonte de violação foi encontrada no recibo.

**Avaliação do produto:** não é defeito de interface. É um estado transitório de 400 ms de uma notificação que, parada, tem contraste de 15,57:1. O defeito era do teste: ele auditava a página sem garantir um estado estável.

### 2.3 Correção (sem mascarar nem afrouxar)

Em `e2e/a11y.spec.ts`:

- **Auditoria em repouso.** As telas de pedido são auditadas depois que o toast sai (`expect(toast).toHaveCount(0)`, com o timeout padrão de 5 s, maior que os 4,6 s de vida do toast). Nenhuma regra foi desativada, nenhum elemento foi excluído do axe e nenhum timeout foi aumentado.
- **Teste dividido.** A espera alongou o fluxo, que chegou a 27–30 s sob 4 workers × 5 repetições, no limite do timeout de 30 s. Ele foi dividido em dois testes com as mesmas auditorias: pendente + recibo + Meus pedidos com a linha confirmada; recusado + Meus pedidos com a linha recusada. Agora a lista é auditada com os dois status, antes só com os dois juntos.
- **Cobertura nova.** O teste "notificação: contraste auditado com a mensagem parada" audita o próprio toast. Ele pausa a expiração com o ponteiro sobre a notificação, espera o fim da animação de entrada e exige que `color-contrast` conste entre as regras verificadas. Antes, o contraste do toast só era medido por acaso.

**Validação:** a11y.spec inteiro, desktop e mobile, 5 repetições com 4 workers: **75 passed, 0 failed**. Os dois testes de confirmação levaram 14–20 s (`evidence/cp10/a11y-repeat5.log`).

Uma rodada de estresse anterior (11 falhas) foi invalidada por um erro meu: rodei o smoke público ao mesmo tempo, ele limpou `test-results/` no meio da execução (ENOENT nos traces) e somou carga. Mesmo nela, nenhuma das falhas foi de contraste: todas foram timeouts ou ENOENT. A rodada seguinte, sem concorrência, revelou o teste no limite de 30 s, o que levou à divisão.

## 3. Cobertura dos requisitos (CHALLENGE.md)

Detalhe por requisito, teste e evidência: `planning/REQUIREMENTS_MATRIX.md`. Resumo conferido no CP10:

| § | Requisito | Situação | Evidência principal |
|---|---|---|---|
| 1 | Fluxos de descoberta, compra e conta, desktop e mobile, com dados simulados | Atendido | smoke público 14/14; suíte E2E |
| 2 | Stack obrigatória com uso efetivo | Atendido: React 19, TS strict, TanStack Router/Query, Axios, REST via MSW, socket.io-client + @mswjs/socket.io-binding, Tailwind 4, shadcn/ui, Playwright, Lighthouse | matriz §1 |
| 3 | 9 telas + perfil, carteiras e confirmação no mobile; ações fora do escopo sem aparentar sucesso | Atendido. Links fora do escopo marcados `unavailable` (`navigation.ts`) | matriz §4; capturas em 390/768/1440 |
| 3 | Catálogo na URL, filtros combináveis, respostas fora de ordem, detalhe com acesso direto e inexistente, favoritos persistentes | Atendido | catalog, nft-detail, favorites specs; produção: `/nft/nao-existe` mostra "NFT não encontrado" |
| 3 | Carrinho: estoque, refresh, merge visitante → login, cupons, precisão em ETH, eventos | Atendido | cart.spec; unit pricing/eth |
| 3 | Pagamento: revalidação, idempotência, pendente/confirmado/recusado, recuperação, recibo imutável | Atendido | checkout, orders, recovery, races specs |
| 3 | Conta e sessão: expiração, logout, troca de usuário, senhas sem texto claro | Atendido. Senhas com PBKDF2-SHA256 + salt (`src/mocks/crypto.ts`) | auth, isolation, account specs |
| 4 | Contratos tipados, estados, invalidação, descarte de obsoletas, isolamento, otimista com rollback, política de cache documentada | Atendido | `ARCHITECTURE.md`; favoritos otimistas com rollback |
| 5 | Contratos REST, erros, idempotência com conflito | Atendido | `planning/API_CONTRACTS.md`; checkout.spec |
| 6 | MSW na camada de rede, cenários configuráveis, reset, fixtures, Socket.IO pelo binding | Atendido (29 cenários) | `src/mocks/scenarios.ts`; README "Cenários" |
| 7 | `nft.updated`, `order.updated`, versão/duplicatas, reconexão + REST, isolamento, cenário do carrinho, pedido pendente offline | Atendido | races, recovery, tabs, realtime specs |
| 8 | Fidelidade ao Figma, 390/768/1440, skeletons, teclado, foco, contraste, reflow | Atendido, com desvios documentados (§6) | a11y.spec (axe WCAG 2.2 A/AA), layout.responsive, baselines |
| 9 | E2E com mocks, Chromium desktop e mobile, regressão visual versionada, relatório HTML e traces | Atendido | CI: 65 unitários + 417 E2E; baselines Windows e Linux |
| 10 | Lighthouse 3× por página e perfil, mediana, relatórios, LCP/CLS/TBT | Atendido na CI independente (mobile 91–93, desktop 98–100, A11y 100, BP 96, SEO 92). Local: mobile 70/65, abaixo da meta, causa ambiental documentada | `CP9_1_REPORT.md`, `CP9_2_REPORT.md` |
| 11 | Eliminatórios | Nenhum se aplica: stack efetiva, fluxos reais na simulação, confirmação só com resposta da API, isolamento testado, eventos pelo cliente Socket.IO, E2E executáveis | matriz §2–§3 |
| 12 | Código, lockfile, deploy público, README, ARCHITECTURE, comandos, checkout limpo | Atendido. CI instala com `npm ci` a partir do checkout | README; `.github/workflows/ci.yml` |

## 4. Revisão da produção (visão de avaliador)

| Área | Verificação | Resultado |
|---|---|---|
| Fluxos | smoke público (`e2e/public.smoke.ts`) no deploy de `aebe686`: HTTPS, cabeçalhos, rewrites, `/api` 404, Service Worker, `/demo` 404, catálogo + tempo real, auth e isolamento, perfil e carteiras, compra com cupom (total 1.087), pagamento recusado, pedido pendente com queda de conexão | **14/14** (`evidence/cp10/smoke-publico-aebe686.log`) |
| Rotas | acesso direto a `/rota-que-nao-existe` e `/nft/nao-existe` | 404 próprio e "NFT não encontrado", com ação de volta |
| Mobile | Início em 390 px no navegador | composição do Figma, barra inferior, sem overflow |
| Ações fora do escopo | links do rodapé e menu (Atividade, Ofertas, Suporte…) | marcados indisponíveis, sem aparentar sucesso |
| Acessibilidade | axe WCAG 2.2 A/AA em 12 telas × 2 viewports, teclado, foco, reflow 320 px, alvos de toque | sem violações (estresse 75/75) |
| Performance | CI independente, 4 rodadas | metas atingidas (§3, linha 10) |
| Erros | estados de erro, nova tentativa, timeouts e respostas fora de ordem | cobertos pela suíte; cenários selecionáveis por `?scenario=` |

## 5. Segurança, privacidade e higiene do repositório

| Verificação | Resultado |
|---|---|
| Segredos (tokens GitHub/Vercel/AWS/Slack, chaves privadas) em arquivos rastreados | nenhum |
| `.env` rastreado | só `VITE_ENABLE_MOCKS=true` e comentários (público, intencional) |
| Autoria dos commits | todos os commits do repositório com o e-mail noreply do GitHub |
| E-mail pessoal ou caminhos locais nos arquivos rastreados e nas evidências | nenhum, após a correção abaixo |
| Identificador do time na Vercel | **Corrigido:** o R-52 citava o identificador, que contém parte do e-mail pessoal; agora o omite. **Permanece no histórico** (commit `da4073a`). Removê-lo exige reescrever o histórico e fazer force-push, o que não fiz sem autorização |
| `npm audit` (produção e completo) | 0 vulnerabilidades |
| Dependências | todas usadas (vaul, sharp, chrome-launcher, tw-animate-css, cva, zod, fontsource etc. conferidos) |
| Artefatos de depuração | nenhum `console.log`/`debugger` em `src`; sondas do CP10 apagadas. `scripts/perf/` é ferramenta de diagnóstico versionada e documentada (CP9.2), não resíduo |
| XSS | nenhum `innerHTML`/`dangerouslySetInnerHTML` em `src` |
| Cabeçalhos em produção | HSTS (Vercel), `nosniff`, `Referrer-Policy`. **Sem CSP e sem `frame-ancestors`.** O R-09 afirmava "CSP no host", o que era falso; o texto foi corrigido. Adicionar CSP agora exigiria tratar o script inline de preload e o Service Worker do MSW; fica como limitação |

## 6. Código, arquitetura e documentação

- `npm run typecheck` e `npm run lint`: limpos.
- Arquitetura em camadas (api/contratos zod → queries/mutations → features → componentes), mocks isolados em `src/mocks`, sem caminhos de negócio falsos na UI. Descrita em `ARCHITECTURE.md`.
- Links do README conferidos: os arquivos locais existem, as 8 capturas em `docs/screenshots/` existem, os 12 scripts `npm run …` citados existem em `package.json`, e o repositório e a produção respondem 200.
- O README separa explicitamente simulação e realidade logo no início (§7 abaixo).
- Correções de documentação no CP10:
  - matriz: "2 rodadas" → 4 rodadas na CI;
  - matriz: duas linhas históricas que ainda diziam "PENDENTE"/"NÃO VALIDADO" para itens validados no CP5/CP6;
  - riscos: R-09 (CSP) e R-52 (identificador);
  - CP9_1_REPORT: aponta para a causa do contraste.

## 7. Simulado × real

| Real (código executando de verdade) | Simulado |
|---|---|
| SPA React, roteamento, cache do TanStack Query, cliente Axios, cliente socket.io-client, validação de formulários, cálculos de precisão, estado do carrinho | Backend REST inteiro (MSW no Service Worker do navegador) |
| Protocolo Socket.IO no cliente (handshake, eventos, reconexão) | Servidor Socket.IO (`@mswjs/socket.io-binding` intercepta o WebSocket na própria página; nenhum tráfego sai do navegador) |
| Persistência local para sobreviver a refresh (estado do mock no navegador) | Autenticação, sessões e expiração (tokens fictícios, senhas com hash só no mock) |
| Deploy estático na Vercel, CI no GitHub Actions | Carteiras (MetaMask etc.), redes, pagamentos, hash de transação e links de explorer |

Consequências: os dados de cada visitante ficam no navegador dele, não há servidor compartilhado, e a "segurança" da simulação não representa um backend.

## 8. Limitações remanescentes

1. **Lighthouse local abaixo da meta** (mobile 70/65 na rodada oficial do CP9.2) por uma tarefa ambiental do Chrome headless na máquina local. Na CI independente: 91–93 mobile em 4 rodadas, com 2 execuções atípicas em 48, explicadas e mantidas.
2. **Fidelidade visual:** artes substitutas (VIS-03/06), galeria com 2 vistas (VIS-04), VIS-09 e VIS-16 parciais. Documentado em `ARCHITECTURE.md`.
3. **Acessibilidade:** só testes automatizados e de teclado. Não houve leitor de tela real nem declaração de conformidade WCAG.
4. **Sem CSP nem proteção contra framing** no host.
5. **Identificador do time na Vercel no histórico Git** (commit `da4073a`) e nas URLs de preview. O domínio de produção não o contém.
6. **Atribuição da falha de contraste original:** mecanismo comprovado, atribuição daquela ocorrência muito provável, não comprovada (§2.2).
7. Tudo roda no navegador do visitante (§7); não há backend real.

## 9. Revalidação das mudanças

| Etapa | Commit | Resultado |
|---|---|---|
| CI, run 45692915418 | `ba89504` | **success** (concluída 20:25 UTC). Qualidade: 65 unitários + **421 passed, 0 failed**, 9 skipped (417 anteriores + 4: teste do toast e divisão da confirmação, × 2 projetos). Lighthouse independente (rodada 5): medianas Início 93/98, Detalhe 91/100 (mobile/desktop); A11y 100, BP 96, SEO 92; as 12 execuções ficam a no máximo 1 ponto da mediana da combinação (`evidence/cp10/lighthouse-ci-run-45692915418/`) |
| Deploy de produção | `ba89504` | alias `kurio-nft-marketplace-flax.vercel.app` → `dpl_GZb6evxYPk318qcKMTyXmmucsbJu` (production, Ready); status da Vercel no commit: success |
| Smoke público após o deploy | `ba89504` | **14/14** (`evidence/cp10/smoke-publico-ba89504.log`) |

Este relatório entra num commit só de documentação, depois de `ba89504`. Esse commit também passa pela CI e gera um deploy, com o mesmo código da aplicação.

## 10. Veredito de prontidão para envio

**PRONTO PARA ENVIO.** A decisão de enviar é do candidato; nada foi enviado.

Fundamentos:

- Todos os requisitos do `CHALLENGE.md` têm implementação e evidência executável (§3). Nenhum critério eliminatório se aplica.
- A produção corresponde ao código entregue e passa no smoke público completo (§9).
- A CI está verde no commit final da aplicação, e o Lighthouse independente atinge todas as metas pela 5ª rodada seguida.
- A única falha intermitente conhecida teve a causa identificada e corrigida no teste, sem enfraquecê-lo (§2).
- Não há segredos nem dados pessoais nos arquivos atuais (§5).

Antes de enviar, recomendo que o candidato decida sobre dois pontos que não exigem código:

1. **Identificador do time na Vercel no histórico Git** (contém parte do e-mail pessoal). Opções:
   - aceitar;
   - renomear o time na Vercel, o que também muda as URLs de preview;
   - reescrever o histórico com force-push. Neste caso os identificadores de commit citados nos relatórios mudam.
2. **Ausência de CSP:** aceitar como limitação documentada, ou pedir um ajuste dedicado e testado antes do envio.

As limitações do §8 estão documentadas e não impedem o envio.
