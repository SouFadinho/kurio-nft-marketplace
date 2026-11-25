# CP4 — Autenticação, perfil e carteiras · Relatório

Data: 2026-11-24. Resultados de execuções reais. Logs em `planning/evidence/cp4-tests/` (inclusive as rodadas que falharam); capturas e comparações em `planning/evidence/cp4/`.

## 1. Resumo
- **Login e cadastro** como no Figma: modal sobre a Início no desktop (abas "Entrar | Criar conta") e tela cheia no mobile. Validação no cliente com o mesmo schema do mock, erros da API no campo certo, envio duplicado bloqueado e login social visível, avisando que não existe na demonstração.
- **Sessão completa:** persistência no refresh, rotas protegidas com retorno, expiração (rota privada → login com aviso e retorno; página pública → segue como visitante com aviso; ação em andamento → retomada após o novo login), logout e troca de usuário.
- **Isolamento de dados privados** provado com respostas **retidas** da API: a resposta de Ana chega depois que Bruno entrou, e um `MutationObserver` confirma que nenhum dado dela é renderizado em nenhum instante.
- **Perfil** (foto com upload simulado, dados, senha) e **Carteiras** (principal/secundária, adicionar, editar, trocar a principal), persistidos na API simulada.
- **Testes:** 295 aprovados · 0 reprovados · 5 ignorados (específicos de dispositivo, justificados), em **3 rodadas completas seguidas** (`full-run-3..5.log`). As rodadas anteriores, com falhas, estão registradas e explicadas em §5 e §6.

## 2. Funcionalidades

**Login (`/login`) e cadastro (`/cadastro`)**
- Desktop (≥ 1024 px): Radix Dialog sobre o conteúdo da Início. Foco preso, Esc fecha, o fundo fica inerte. Ao fechar, volta para a origem (ou para a Início, se a origem for privada) e o foco volta ao botão "Entrar" do header.
- Mobile: tela cheia sem rodapé nem navegação inferior (`staticData.mobileChrome = 'minimal'`).
- Campos com rótulo visível, `aria-invalid`, `aria-describedby` (erro e dica) e foco no primeiro inválido, inclusive para erros que chegam da API.
- Mostrar/ocultar senha (`aria-pressed`). "Esqueceu a senha?", Google e Facebook informam que não fazem parte da demonstração.
- Mensagens: credenciais inválidas (genérica, sem revelar qual campo errou), sem conexão, timeout, conflito de e-mail ou usuário (no campo).
- `redirect` só aceita caminhos internos (sem open redirect). `motivo=expirada` mostra o aviso de sessão expirada.
- Cadastro: usuário (3–24, `[a-z0-9._]`), e-mail, senha (8–72, letra e número) e confirmação. A conta é criada e a sessão já começa (segue para a origem).

**Sessão (`features/auth`)**
- `sessionStore`: token em memória, espelhado em `sessionStorage`; `epoch` muda a cada troca de sessão; `endReason` (`logout` | `expired`).
- Axios: cada requisição autenticada é carimbada com a época. Se a sessão mudou durante a requisição, a resposta é descartada (`STALE_SESSION`). Um 401 numa requisição autenticada expira a sessão; se a requisição carregava uma intenção (`kurioIntent`, ex.: favoritar), ela é guardada **antes** de encerrar a sessão.
- `SessionEffects`: em toda troca de sessão, cancela as consultas `['me']` (o Axios aborta o HTTP) e remove o cache privado e o da sessão. Decide o destino da expiração e retoma a intenção pendente depois do login.
- Socket.IO: a conexão é por sessão (CP1). No logout o servidor simulado encerra a conexão de Ana e Bruno recebe uma nova (teste).

**Perfil (`/perfil`)**
- Três formulários independentes: foto, dados (nome de exibição, usuário, e-mail, apelido da carteira) e senha (atual, nova, confirmação).
- Sem atualização otimista: o cache só muda com a resposta da API, e o sucesso (toast + `role=status`) só aparece depois dela.
- Dados temporários × persistidos: o formulário guarda o que está sendo digitado. Ele é remontado (key = `version`) apenas quando a API confirma uma nova versão. Uma falha mantém o digitado sem persistir, e "Descartar alterações" volta ao salvo.
- Foto: PNG/JPEG/WebP até 512 KB, validada no cliente e na API (data URL salva no mock). "Remover" volta às iniciais.
- Senha atual errada → erro no campo (422). Ao trocar, as outras sessões do usuário são encerradas no servidor; a senha antiga deixa de funcionar (teste).

**Carteiras (`/perfil/carteiras`)**
- "Carteira principal" e "Carteira secundária" (máx. 2). Resumo com apelido, tipo, rede, endereço abreviado (completo para leitores de tela) e ENS.
- Adicionar e editar inline: apelido, rede, tipo, endereço (EVM `0x` + 40 hex; Solana base58) e ENS opcional com sufixo `.eth`.
- Conflitos da API: endereço já cadastrado; limite de carteiras. "Tornar principal" troca as posições.
- Contrato pronto para o CP5: `useWallets()` + `sortWallets()` (principal primeiro) e a intenção `checkout` para retomar a compra após uma expiração.

**Favoritos (CP3 preservado e revalidado):** visitante → login → o favorito é aplicado automaticamente; a expiração durante a ação é retomada; o isolamento entre Ana e Bruno é testado com respostas atrasadas.

## 3. Mock (MSW)
- `handlers/account.ts`: `POST /auth/login`, `POST /auth/register` (409 com `details.email`/`details.username`), `GET /auth/session`, `POST /auth/logout`, `GET/PUT /me/profile` (409), `PUT/DELETE /me/avatar` (422 acima de 512 KB), `PUT /me/password` (422 senha atual), `GET/POST /me/wallets`, `PUT /me/wallets/:id` (404 para carteira de outro usuário), `POST /me/wallets/:id/primary`.
- Senhas: PBKDF2 com sal aleatório por usuário; nunca em texto puro no estado persistido.
- Persistência: `kurio:mock:db:v4` (usuários com username, apelido, avatar, versão; carteiras por usuário).
- Cenários novos: `auth-offline`, `avatar-fail`, `profile-save-fail`, `slow-private` (retém favoritos e carteiras até o teste liberar). `__kurioMock.expireSessions()` expira todas as sessões. Conflitos, senha errada e carteira inválida vêm dos próprios dados (determinísticos).

## 4. Isolamento: evidência
| Cenário | Como é provado |
|---|---|
| Ana sai com a leitura de favoritos pendente; Bruno entra; a resposta de Ana é liberada depois | `slow-private` + `release('favorites.read')`; `MutationObserver` instalado antes da liberação registra qualquer "Remover Sage Nomad #009 dos favoritos" (favorito só de Ana): **nenhum registro**; o favorito de Bruno aparece; a requisição de Ana foi **abortada** (`requestfailed`) |
| Ana sai durante o carregamento das carteiras | `slow-private` + `release('me.wallets.read')`; o observer procura "Reserva", "nova.kurio" e o endereço de Ana: **nenhum registro**; Bruno vê "Cofre" |
| Bruno tenta alterar carteira de Ana pela API | `PUT /me/wallets/wal_ana_1` e `POST …/wal_ana_2/primary` → **404**; a lista de Bruno só tem `wal_bruno_1` |
| Socket.IO | A conexão autenticada de Ana some do servidor no logout; Bruno recebe uma nova; nenhuma conexão de Ana permanece |
| Cache | Query keys privadas sempre em `['me', userId, …]`; cancelamento + remoção em toda troca de sessão; carimbo de época no Axios |

## 5. Defeitos encontrados e corrigidos (com evidência)
1. **Labels com asterisco quebravam a busca por rótulo.** O texto do `<label>` incluía " *", e `getByLabel('Senha', { exact: true })` (inclusive dos testes da PoC) não encontrava o campo: 74 dos 82 testes novos falharam na 1ª rodada parcial dos specs do CP4 (saída só no terminal; não preservada em `cp4-tests`). Correção: asterisco fora do `<label>` (decorativo, `aria-hidden`).
2. **Foco no primeiro campo inválido não acontecia para erros da API.** O `queueMicrotask` rodava antes do commit do React no callback assíncrono. Correção: `useFocusFirstInvalid` (efeito disparado pelo objeto de erros).
3. **Carteira nova salva sem toast e com o editor travado.** Ao atualizar o cache, o formulário desmontava, e os callbacks por chamada do `mutate` não rodam após desmontar (R-35). Correção: `mutateAsync` (a promise resolve mesmo assim). Aplicado também ao perfil (remontado por versão).
4. **axe: `link-in-text-block`** em "Já tem uma conta? Entre" (link distinguido só pela cor). Correção: sublinhado.
5. **Expiração derrubava a PoC para o login mesmo em página pública.** O teste "reset integral" da PoC falhou. Decisão: login só em rota privada ou com ação pendente; em página pública, aviso + "Entrar". Para a ação pendente funcionar, a intenção passou a viajar na requisição (`kurioIntent`) e é guardada pelo interceptor antes de encerrar a sessão. Antes, o `onError` da mutation rodava depois da decisão de redirecionar.
6. **Teste de expiração durante o favoritar era instável.** Qualquer requisição privada em segundo plano podia receber o 401 antes do clique. Correção no teste (não no app): expirar e clicar no mesmo tick.
7. **Timeouts sob carga (R-36).** Com ~4 GB de RAM livre, a suíte completa chegou a levar 15 min, com timeouts de 30 s. Os 6 primeiros testes de navegador, iniciados juntos pelos 6 workers, estouravam no arranque a frio (log `full-run-1.log`). Sem aumentar timeouts:
   - o paralelismo local passou a ser de 4 workers (`PW_WORKERS` sobrescreve);
   - a preparação do teste mais longo de isolamento passou a ser feita pela API simulada (o favoritar pela UI já é coberto no catalog.spec).

## 6. Resultados dos testes
**Verificações estáticas** (`typecheck-lint-build.log`): `tsc -b` sem erros · ESLint sem avisos · `vite build` ok.

**Suíte completa** (`npx playwright test`; build de produção + MSW; 4 workers):

| Rodada | Aprovados | Reprovados | Ignorados | Duração | Observação |
|---|---|---|---|---|---|
| `pre-run-a-poc-reset.log` | 291 | 2 | 5 | 6,6 min | PoC "reset integral": expiração em página pública levava ao login (defeito 5, corrigido) |
| `pre-run-b-sob-carga.log` | 279 | 16 | 5 | 15,3 min | Timeouts com ~4 GB livres (R-36); 6 workers |
| `pre-run-c.log` | 295 | 0 | 5 | 7,8 min | 6 workers |
| `full-run-1.log` | 287 | 8 | 5 | 7,9 min | 6 workers: os 6 primeiros testes de navegador estouram juntos no arranque a frio (defeito 7) |
| `full-run-2.log` | 294 | 1 | 5 | 6,3 min | 6 workers: liquidação automática da PoC (7b) atrasada sob carga |
| **`full-run-3.log`** | **295** | **0** | 5 | 5,1 min | **4 workers** |
| **`full-run-4.log`** | **295** | **0** | 5 | 5,3 min | 4 workers |
| **`full-run-5.log`** | **295** | **0** | 5 | 6,1 min | 4 workers |

**Por projeto (300 testes):** unit 46 · desktop-chromium 117 · mobile-chromium 117 · responsive 20.
**Novos no CP4 (99):** auth.spec 46 (23 × 2 viewports) · account.spec 28 (14 × 2) · isolation.spec 10 (5 × 2) · unit account-contracts 7 · responsivo 8 (conta em 8 larguras; `/login` e `/cadastro` entraram na varredura existente).
**Ignorados (5):** 2 do CP3 (já justificados) + 3 do CP4 específicos de dispositivo: modal com foco preso e abas (só existem no desktop) no projeto mobile; tela cheia mobile no projeto desktop.
**Cobertura anterior preservada:** nenhum teste desativado. Um teste do CP3 foi **adaptado**: `catalog.spec` "visitante ao favoritar…" não clica de novo em "Favoritar" após o login, porque a intenção agora é retomada automaticamente (comportamento pedido no CP4). O PoC continua usando o mesmo login (rótulos "E-mail"/"Senha", botão "Entrar").
**Evidências:** `npx playwright test e2e/cp4.evidence.spec.ts --project=evidence` com `EVIDENCE=1` (8 aprovados).

## 7. Evidências visuais (`planning/evidence/cp4/`)
- `login-{390,768,1440}.png`, `login-erros-*`, `login-expirada-{390,1440}`, `cadastro-{390,768,1440}`, `cadastro-conflito-1440`.
- `perfil-{390,768,1440}.png` e `carteiras-{390,768,1440}.png` (página inteira), `carteiras-edicao-erro-*`.
- Comparações com o Figma **na mesma escala** (`scripts/evidence/compare-cp4.mjs`): `comparacao-login-desktop`, `comparacao-cadastro-desktop`, `comparacao-login-mobile`, `comparacao-cadastro-mobile`, `comparacao-perfil-desktop`, `comparacao-carteiras-desktop`.
- Ajustes feitos a partir das comparações: largura do modal (416 → 496 px, como no Figma), fundo menos escurecido, respiro vertical e botão de 56 px no mobile, título do cadastro mobile "Criar perfil de colecionador" no tamanho do Figma.

## 8. Diferenças em relação ao Figma (detalhe em VISUAL_ANALYSIS §12)
1. Rótulos visíveis acima dos campos (o Figma usa só placeholder).
2. Modal centralizado (no Figma fica perto do topo do hero).
3. Perfil com três formulários em vez de um único "Salvar".
4. Carteiras: sem os campos de perfil repetidos; resumo com "Editar" em vez do formulário aberto; sem o atalho "Igual à carteira principal".
5. Foto de perfil, perfil/carteiras no mobile e no tablet: derivados (sem frame).
6. Glifos simplificados de Google e Facebook.

## 9. Requisitos validados
TELA-06..09, ACC-01..07, ACC-08 (parcial), ELIM-04 (revalidado), E2E-03, E2E-04, E2E-08, E2E-11 (parcial), A11Y-06 (conta), MOCK-04/06 (cenários do CP4). Detalhe por teste na matriz, §13.

## 10. Limitações e decisões
- Sessão em `sessionStorage` (por aba), não cookie httpOnly: toda a API é simulada no navegador (R-37). Uma aba nova pede login.
- A expiração é detectada pela API (401). Não há temporizador no cliente que antecipe o `expiresAt`.
- Upload de avatar simulado: a imagem vira data URL no estado do mock (limite de 512 KB para não estourar o `localStorage`).
- Sem recuperação de senha, login social ou verificação de e-mail (fora da demonstração; avisos explícitos).
- No desktop, o login renderiza a Início atrás do modal (fidelidade ao Figma). Isso custa uma renderização a mais da Início; avaliar no CP8 (Lighthouse).
- A carteira "Principal" de Ana tem o apelido "Principal" (dado do Figma), então o selo "Principal" aparece duas vezes nessa carteira.

## 11. Pendências
- CP5: usar `useWallets`/`sortWallets` no pagamento; intenção `checkout` após expiração; PEND-01/02 (idempotência).
- Revisão visual final: VIS-01..06 (matriz §12) e posição do modal de login.
- Avatar no header (hoje "Minha conta").
- Baselines visuais de login/perfil: não adicionadas (TEST-02 pede Início, Detalhe, Carrinho e Pagamento).

## 12. Commit e checkout limpo
COMMIT_INFO
