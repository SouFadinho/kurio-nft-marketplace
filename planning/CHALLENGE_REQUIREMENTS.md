# CHALLENGE_REQUIREMENTS — KURIO (Jungle Gaming · Frontend Developer)

> **Fonte oficial:** [`CHALLENGE.md`](../CHALLENGE.md), na raiz do projeto. Ele foi extraído **literalmente** (linhas 73–296) do texto que o candidato colou neste arquivo em 2026-11-24. Uma cópia do arquivo colado foi guardada no scratchpad da sessão.
> O enunciado prevalece sobre qualquer hipótese do CP0. Este documento **resume e indexa** o enunciado. Ele não o substitui: em caso de dúvida, vale o `CHALLENGE.md`.
> Figma oficial (somente visualização): https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1

Convenção: `§n` = seção do `CHALLENGE.md`. IDs são usados na `REQUIREMENTS_MATRIX.md`.

## 1. Critérios eliminatórios (§11)
| ID | Critério eliminatório |
|---|---|
| ELIM-01 | Ausência de uso efetivo da stack obrigatória |
| ELIM-02 | Fluxos principais apenas visuais |
| ELIM-03 | Compra confirmada sem resposta da simulação |
| ELIM-04 | Exposição de dados entre usuários |
| ELIM-05 | Eventos simulados diretamente na UI |
| ELIM-06 | Ausência de testes E2E executáveis |

## 2. Critérios de avaliação (§11) — 100 pontos
| ID | Critério | Pontos | Evidência esperada |
|---|---|---|---|
| AV-1 | Fidelidade visual e responsividade | 20 | Aderência ao Figma e consistência entre tamanhos de tela |
| AV-2 | Fluxos e experiência de uso | 20 | Compra e conta completas, validações e recuperação de erros |
| AV-3 | Integração e estado | 15 | Router, Query, Axios, contratos e cache coerentes |
| AV-4 | Tempo real | 10 | Eventos, reconexão, ordenação e sincronização com REST |
| AV-5 | Mocking | 10 | MSW, cenários determinísticos, persistência e reset |
| AV-6 | Testes | 10 | Cobertura dos fluxos e falhas com Playwright |
| AV-7 | Acessibilidade | 5 | Operação por teclado, semântica, foco e feedback |
| AV-8 | Performance | 5 | Resultados e análise das auditorias Lighthouse |
| AV-9 | Arquitetura e documentação | 5 | Tipagem, responsabilidades e execução reproduzível |

## 3. Stack obrigatória (§2)
React · TypeScript · TanStack Router · TanStack Query · Axios · REST APIs · Socket.IO · Tailwind CSS · shadcn/ui · MSW · Playwright · Lighthouse. Todas devem "participar efetivamente". Build e libs complementares ficam a critério do candidato (Vite foi aprovado).

## 4. Escopo (§1, §3)
- Fluxos de descoberta, compra e conta, em desktop e mobile, com dados simulados. Blockchain, extensões de carteira e gateways reais estão fora do escopo.
- O Figma define a identidade e a composição; o enunciado define comportamentos. Estados não desenhados seguem o padrão visual.
- Fora da entrega: páginas editoriais, suporte, atividade, ofertas e downloads. As ações fora do escopo **não devem aparentar sucesso**.
- Perfil, carteiras e confirmação devem funcionar em mobile, mesmo sem frame.

### 4.1 Telas obrigatórias (§3)
| ID | Tela | Funcionalidades obrigatórias |
|---|---|---|
| TELA-01 | Início | Destaques, catálogo, busca, filtros, ordenação, navegação para o NFT |
| TELA-02 | Detalhes do NFT | Galeria, informações, edição, quantidade, favoritos, compra |
| TELA-03 | Carrinho | Edição de quantidades, remoção, cupom, resumo de valores |
| TELA-04 | Pagamento | Dados do colecionador, seleção de carteira e rede, revisão e envio |
| TELA-05 | Confirmação de pedido | Resultado, identificação da transação, itens, taxas, total |
| TELA-06 | Login | Autenticação, validação, retorno ao fluxo anterior |
| TELA-07 | Cadastro | Criação de conta, validação, tratamento de conflito |
| TELA-08 | Perfil | Edição de dados, avatar, alteração de senha |
| TELA-09 | Carteiras | Cadastro e edição das carteiras principal e secundária |

## 5. Requisitos funcionais (§3)
**Catálogo e detalhe**
- CAT-01: busca, filtros, ordenação e paginação na URL; sobrevivem a refresh e ao histórico.
- CAT-02: filtros combináveis; mudar um filtro reinicia a paginação.
- CAT-03: consultas refletem os parâmetros enviados; tratam vazio, falha e respostas fora de ordem.
- CAT-04: detalhe com acesso direto, NFT inexistente, edição indisponível e limite de quantidade.
- CAT-05: favoritos persistem para o usuário autenticado.

**Carrinho**
- CART-01: adicionar, alterar e remover itens respeitando a disponibilidade por NFT e edição.
- CART-02: carrinho mantido após refresh; itens do visitante preservados ao autenticar.
- CART-03: aplicar e remover cupom; tratar código inválido ou expirado.
- CART-04: subtotal, desconto, taxa de rede e total coerentes com a API.
- CART-05: refletir mudanças de preço e disponibilidade recebidas com o carrinho aberto.
- CART-06: ETH como string decimal com precisão; quantidades inteiras; a cotação da API é a referência.

**Pagamento e confirmação**
- PAY-01: validar campos do layout; revisão antes do envio.
- PAY-02: usar carteiras cadastradas; seleção de rede; simular conexão, recusa e desconexão.
- PAY-03: revalidar preço, disponibilidade, cupom e taxas antes de confirmar; mudanças exigem nova confirmação.
- PAY-04: impedir duplicidade em cliques repetidos e em reenvios após timeout.
- PAY-05: estados pendente, confirmado e recusado; recuperação após refresh ou reconexão.
- PAY-06: confirmação exibida **somente** para pedido confirmado na simulação.
- PAY-07: falha preserva os itens; após a confirmação, remover apenas os itens e quantidades comprados.
- PAY-08: recibo = snapshot imutável do pedido; tx hash e links de explorer simulados.

**Conta e sessão**
- ACC-01: cadastro, login, logout e sessão integrados à API simulada.
- ACC-02: checkout, perfil, carteiras, favoritos e pedidos exigem autenticação.
- ACC-03: sessão recuperável após refresh.
- ACC-04: expiração durante a navegação e durante o checkout, preservando o contexto para retomada.
- ACC-05: logout e troca de usuário limpam dados privados do cache e subscriptions.
- ACC-06: validar cadastro, perfil, senha e carteiras, incluindo erros da API.
- ACC-07: alterações confirmadas persistem após refresh.
- ACC-08: credenciais fictícias; senhas nunca em claro.

## 6. Integração e estado (§4)
- INT-01: Router nas rotas, search params e proteção de fluxos privados.
- INT-02: Query em consultas, mutations e sincronização do cache.
- INT-03: todas as chamadas REST passam pelo Axios.
- INT-04: contratos tipados entre transporte, estado e interface.
- INT-05: estados de loading, vazio, erro, sucesso e atualização em background.
- INT-06: invalidação coerente após mutations e eventos.
- INT-07: cancelamento ou descarte de respostas obsoletas.
- INT-08: isolamento por usuário e por parâmetros de consulta.
- INT-09: recuperação de falhas sem duplicar operações.
- INT-10: rotas inexistentes e acesso direto a qualquer tela.
- INT-11: pelo menos uma atualização otimista com rollback.
- INT-12: documentar a política de cache, retries e sincronização.

## 7. Contratos REST (§5)
- API-01: recursos mínimos: sessão e conta (cadastro, login, sessão, logout, expiração); NFTs (lista com busca, filtros, ordenação e paginação; detalhe); favoritos (consulta, inclusão, remoção); carrinho (consulta, inclusão, alteração, remoção); cotação (cupom, disponibilidade, descontos, taxas, total); pedidos (criação idempotente, estado e recibo); perfil (consulta, dados e avatar, senha); carteiras (consulta, cadastro, atualização).
- API-02: erros de validação, sessão inválida, falta de permissão, recurso inexistente, conflito de disponibilidade e falha transitória.
- API-03: idempotency key; mesma tentativa → mesmo pedido; mesma chave com conteúdo diferente → conflito.
- API-04: contratos definidos e documentados.

## 8. Mocking com MSW (§6)
- MOCK-01: mocks na camada de rede; nada de respostas fictícias em componentes, hooks ou Axios.
- MOCK-02: estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos.
- MOCK-03: persistência local permitida; o **reset restaura integralmente** um cenário conhecido.
- MOCK-04: simular lentidão, latência variável, timeouts, falta de conexão e erros HTTP; configurável e reproduzível.
- MOCK-05: fixtures variadas para filtros e paginação; **pelo menos dois usuários**.
- MOCK-06: cenários determinísticos: (a) sucesso e vazio; (b) latência variável e fora de ordem; (c) falha de conexão e 4xx/5xx; (d) sessão expirada e não autorizado; (e) conflito de cadastro e validação; (f) cupom inválido ou expirado; (g) preço alterado ou edição esgotada durante a compra; (h) timeout após criar o pedido, com recuperação por idempotência; (i) pagamento confirmado e recusado.
- MOCK-07: eventos via MSW com integração compatível com o protocolo Socket.IO; documentar o transporte e suas limitações.
- MOCK-08: os cenários exercitam o `socket.io-client`; proibido usar setters, callbacks ou o cache diretamente.
- MOCK-09: mocks ativados por configuração e disponíveis no build de demonstração.
- MOCK-10: mudanças nos dados simulados aparecem no REST **e** nos eventos.

## 9. Tempo real (§7)
- RT-01: `nft.updated` atualiza preço e disponibilidade no catálogo, no detalhe e no carrinho.
- RT-02: `order.updated` atualiza o estado do pedido e mostra confirmação ou recusa.
- RT-03: eventos com identidade estável, recurso afetado e versão.
- RT-04: tolerar duplicatas e eventos antigos sem regredir nem reaplicar efeitos.
- RT-05: reconciliar com o REST após a reconexão.
- RT-06: eventos de uma sessão anterior não atualizam dados de outro usuário.
- RT-07: listeners e subscriptions liberados ao fim do ciclo de vida.
- RT-08: cenário: NFT no carrinho → preço ou disponibilidade muda → a UI informa e atualiza o resumo → o checkout bloqueia a cotação desatualizada.
- RT-09: queda de conexão com pedido pendente → reconectar ou recarregar recupera o estado sem nova compra; confirmado e recusado são terminais.

## 10. Interface, responsividade e acessibilidade (§8)
- UI-01: preservar tipografia, cores, espaçamentos, hierarquia, imagens, proporções e composição; adaptar o shadcn à identidade.
- UI-02: desktop, tablet e mobile; avaliar **390, 768 e 1440 px**.
- UI-03: skeletons com shimmer (catálogo, detalhe, resumo do carrinho); preservar dimensões (sem CLS); respeitar `prefers-reduced-motion`.
- A11Y-01: teclado e foco visível. A11Y-02: foco em diálogos e drawers. A11Y-03: semântica, labels e erros associados. A11Y-04: alternativas textuais. A11Y-05: contraste e estados que não dependem só de cor. A11Y-06: feedback acessível para mutations e tempo real. A11Y-07: sem overflow horizontal nem perda de conteúdo com zoom.
- UI-04: usar os assets do arquivo quando disponíveis; imagens e fontes acessíveis localmente; documentar substituições e ajustes.

## 11. Testes Playwright (§9)
Doze grupos obrigatórios:
| ID | Grupo |
|---|---|
| E2E-01 | Busca, filtros combinados, ordenação, paginação, restauração pelo histórico |
| E2E-02 | Acesso direto ao detalhe e recurso inexistente |
| E2E-03 | Cadastro, login, expiração de sessão, logout, troca de usuário |
| E2E-04 | Favoritos, falha de mutation e recuperação do estado |
| E2E-05 | Carrinho, quantidades, remoção, cupom, persistência após refresh e login |
| E2E-06 | Compra completa, do catálogo ao recibo confirmado |
| E2E-07 | Falha de pagamento, clique repetido, timeout com recuperação do mesmo pedido |
| E2E-08 | Perfil, avatar, senha e carteiras, com erros de validação |
| E2E-09 | Alteração de preço ou disponibilidade via Socket.IO durante o checkout |
| E2E-10 | Eventos duplicados ou antigos, desconexão, retomada de pedido pendente |
| E2E-11 | Teclado, foco de diálogos, validação de formulários |
| E2E-12 | Skeletons em carregamento lento, feedback de falha, recuperação após retry |

- TEST-01: Chromium, viewports desktop e mobile.
- TEST-02: regressão visual de **Início, Detalhe, Carrinho e Pagamento**, com baselines versionadas e dados estáveis.
- TEST-03: estado isolado por teste; relógio, latência e eventos controlados.
- TEST-04: relatório HTML e traces de falha.
- TEST-05: verificar a UI e os resultados das operações; tempo real via `socket.io-client`; REST via handlers MSW.

## 12. Lighthouse (§10)
- LH-01: Início e Detalhe × mobile e desktop; build otimizado; cenário padrão.
- LH-02: metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- LH-03: **3 medições por página e perfil = 12 execuções**; reportar a mediana por categoria.
- LH-04: versionar a configuração; relatórios HTML e JSON; versões das ferramentas, ambiente e condições.
- LH-05: registrar LCP, CLS e TBT; justificar o que ficar abaixo da meta, com as causas.
- LH-06: sem simplificações exclusivas para pontuar (carregar imagens, fontes e funcionalidades reais).

## 13. Entrega (§12)
- DEL-01: código, lockfile, assets, mocks, fixtures, testes e configurações de auditoria.
- DEL-02: **deploy obrigatório** (Vercel recomendado); link do repositório + URL pública.
- DEL-03: a versão publicada corresponde ao código; acessível durante a avaliação; mocks e tempo real funcionando; acesso direto e refresh funcionando.
- DEL-04: `README.md` com setup, variáveis de ambiente, credenciais fictícias, seleção e reset de cenários, comandos e reprodução de falhas.
- DEL-05: `ARCHITECTURE.md` com contratos REST e eventos, política de sessão, estado do carrinho, estratégia de cache, reconciliação REST × Socket.IO, limitações, decisões de UX e desvios do Figma.
- DEL-06: comandos de dev com mocks, build, preview, typecheck, lint, testes Playwright e Lighthouse.
- DEL-07: executa a partir de um checkout limpo, sem serviços privados.

## 14. Decisões aprovadas pelo candidato (CP0.1)
- Criadores, Aprenda e páginas fora do escopo: coerência visual, sem simular funcionalidade.
- Login social visível, com mensagem clara de indisponibilidade na demo.
- Confirmação de pedido: usar a referência original quando estiver disponível; perfil, carteiras e confirmação mobile são derivados do design system.
- Fonte monoespaçada semelhante, caso a original não seja identificada (substituição documentada).
- Preservar a paleta medida.
- ETH como string decimal no transporte e `bigint` em wei internamente; a cotação da API é a autoridade financeira.
- Não reproduzir as inconsistências matemáticas do Figma.
- Vite aprovado; Vercel preferencial; **nada é publicado antes de autorização**.

## 15. Pendências
1. Assets do Figma: o acesso é só de visualização. Tentar exportar pelos mecanismos permitidos ao viewer no CP2 (painel Export / "Copy as PNG", se o dono não tiver desabilitado). Não usar token da API do Figma sem autorização.
2. Referência visual da tela de Confirmação de pedido: não está nas capturas; verificar no Figma durante o CP2.
3. Repositório remoto e deploy: dependem de autorização (CP9).
