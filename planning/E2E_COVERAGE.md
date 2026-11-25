# KURIO · Cobertura dos 12 grupos obrigatórios de E2E (CHALLENGE §9)

Projetos Playwright: **D** = `desktop-chromium` (1440×900), **M** = `mobile-chromium` (390×844, toque), **R** = `responsive` (8 larguras, 360–1440), **U** = `unit`. Todo E2E roda contra o **build de produção** (`vite build` + `vite preview`) com MSW ativo; tráfego real UI → TanStack Query → Axios → MSW e eventos pelo socket.io-client. Evidências por checkpoint em `planning/evidence/cp*/`.

| # | Grupo | Arquivos › testes principais | Disp. | Evidências |
|---|---|---|---|---|
| 1 | Busca, filtros combinados, ordenação, paginação e histórico | `catalog.spec`: busca com debounce e sem resultados; filtros combinados com contagens; faixa de preço + ordenação; paginação + voltar/avançar + refresh; mudar filtro volta à página 1; link compartilhável; parâmetros inválidos; respostas fora de ordem. `unit/catalog-search` | D, M, U | `evidence/cp3` |
| 2 | Detalhe por URL direta e 404 | `nft-detail.spec`: acesso direto e refresh; NFT inexistente (404); edição na URL; catálogo → detalhe → catálogo. `poc.spec` (rotas no build) | D, M | `evidence/cp3` |
| 3 | Cadastro, login, expiração, logout e troca de usuário | `auth.spec` (20 testes: login válido/inválido/offline, envio duplicado, cadastro e conflitos, rotas protegidas, expiração privada e pública, logout, troca de usuário, modal, axe). `isolation.spec`. `unit/account-contracts` | D, M, U | `evidence/cp4` |
| 4 | Favoritos e rollback | `catalog.spec`: visitante → login → favorito aplicado e persistido; falha → rollback + aviso. `isolation.spec`: favoritos isolados com resposta atrasada; intenção retomada após expiração | D, M | `evidence/cp3`, `cp4` |
| 5 | Carrinho, quantidade, remoção, cupom, persistência e merge | `cart.spec` (13 testes: adicionar pelo card e pelo detalhe, quantidade/remoção/estoque, preço e estoque ao vivo, cupons, merge determinístico, isolamento, erro/recuperação, axe). `unit/commerce` (merge e precificação). `tabs.spec` + `hardening.spec` (mesmo carrinho em duas abas) | D, M, U | `evidence/cp5` |
| 6 | Compra completa até o recibo | `orders.spec` › pendente → confirmado → recibo (snapshot, hash, explorador, histórico); recibo imutável. `checkout.spec` › fluxo principal (visitante → login/merge → pagamento → pedido) | D, M | `evidence/cp6` |
| 7 | Falhas, submissão repetida e recuperação após timeout | `checkout.spec` › idempotência e falhas (cliques repetidos, mesma chave/conteúdo diferente = 409, timeout, resposta perdida, 503 antes de gravar). `recovery.spec` › timeout e resposta perdida até o recibo. `hardening.spec` › timeout + refresh / fechar a aba (recuperação pela chave). `tabs.spec` › idempotência entre abas | D, M | `evidence/cp5-tests`, `cp6-tests` |
| 8 | Perfil, avatar, senha e carteiras | `account.spec` (14 testes: perfil, conflitos, falha ao salvar, validação, avatar válido/inválido/falha, senha errada/troca, carteiras principal/secundária/adicionar/editar/conflito, axe) | D, M | `evidence/cp4` |
| 9 | Mudanças de preço e estoque durante o checkout | `checkout.spec` › consistência financeira (preço muda na revisão → alerta e aceite; mudança não vista com socket offline → 409; estoque acaba; cotação expirada). `cart.spec` › tempo real no carrinho | D, M | `evidence/cp5` |
| 10 | Eventos duplicados, antigos, desconexão e recuperação | `races.spec` (R-42 determinístico + eventos duplicados/antigos/terminais; R-44). `recovery.spec` (offline confirmado/recusado, refresh, nova aba, sessão expirada). `poc.spec` (T6–T9). `catalog.spec` › REST antigo após evento. `unit/eventGuard`, `unit/orders-events` | D, M, U | `evidence/cp6-tests` (controles negativos) |
| 11 | Teclado, foco e validação acessível | `design-system.spec` (skip link, diálogo e drawer com foco preso/Esc/retorno, slider, rádio por setas, axe em 6 rotas + controle negativo). `auth.spec` (modal), `catalog.spec`/`nft-detail.spec` (teclado), `cart.spec`/`checkout.spec`/`account.spec`/`orders.spec` (axe com erros visíveis, foco no primeiro inválido) | D, M | `evidence/cp2`, `cp4`, `cp5` |
| 12 | Skeletons, lentidão, falhas e retry | `catalog.spec` › skeletons (resposta retida), erro HTTP e de conexão com retry, vazio, imagem quebrada. `nft-detail.spec` › erro e retry. `cart.spec` › erro/recuperação e cotação em andamento. `orders.spec` › carregamento, erro e recuperação do pedido. `account.spec` › falha ao salvar. `auth.spec` › envio duplicado com `slow` | D, M | `evidence/cp3`, `cp5`, `cp6` |

Transversais: **responsividade** (`layout.responsive.spec`: 8 larguras × início, mercado, detalhe, login, cadastro, conta, carrinho, pagamento, pedidos, recibo, explorador) e **regressão visual** (`visual.spec`: Início, Detalhe, Carrinho e Pagamento × D/M).

## Lacunas encontradas no CP7 e o que foi feito
| Lacuna | Ação |
|---|---|
| Duas abas **visíveis** do mesmo usuário: o carrinho só atualizava ao voltar à aba | Evento `cart.updated` (privado) pela camada de transporte existente (Socket.IO simulado → socket.io-client). `hardening.spec` (2 casos) |
| Timeout + refresh ou fechamento da aba podia levar a um 2º pedido | Tentativa persistida por usuário (localStorage) e consulta `GET /orders/by-key/:key` (não cria nada) ao entrar no pagamento. `hardening.spec` (3 casos) |
| Troca de líder durante requisição e liquidação | Promoção falha na hora as RPCs pendentes (retry atendido pela nova líder); liquidação retomada. `hardening.spec` (2 casos) |
| Navegador sem Web Locks | Modo de aba única com aviso. `hardening.spec` |
| Explorador: provar ausência de dados privados | Teste do contrato (chaves exatas; sem e-mail, nome, itens, ids). `hardening.spec` |
| Asserção de "sem confirmação antes da API" dependia de janela de tempo | `checkout.spec`: criação retida no servidor; sem pedido, sem navegação e sem texto de confirmação enquanto retida |
| Esperas arbitrárias (450 ms / 1,5 s) no teste de respostas fora de ordem | Substituídas por espera da requisição e do seu desfecho (entregue ou cancelada) |

Nenhum grupo estava sem cobertura; não foram criados testes só para aumentar números.
