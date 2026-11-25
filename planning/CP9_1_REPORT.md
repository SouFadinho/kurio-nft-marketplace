# CP9.1 — Publicação e validação do ambiente público

Data: 25/11/2026. **A candidatura NÃO foi enviada** (aguarda o CP10).

## 1. Endereços públicos

| Item | URL |
|---|---|
| Repositório (público) | https://github.com/SouFadinho/kurio-nft-marketplace |
| Aplicação (Vercel, produção) | **https://kurio-nft-marketplace-flax.vercel.app** |
| CI (GitHub Actions) | https://github.com/SouFadinho/kurio-nft-marketplace/actions |

Atenção: `kurio-nft-marketplace.vercel.app` (sem `-flax`) pertence a **outro** projeto da Vercel; não é este app (R-53).

## 2. Auditorias antes do merge (pedidas na aprovação do CP9.2)

### 2.1 Substituição da biblioteca de cookies do MSW

**Achado.** O substituto do próprio `tough-cookie`, feito no CP9.2, tinha incompatibilidades com o uso do MSW:

- **`toString()` ausente:** o MSW o chama ao anexar cookies guardados ao header `cookie` (`getRequestCookies.mjs`).
- **Ordem da RFC 6265 ausente:** o `tough-cookie` real devolve os cookies por comprimento de caminho.

Nenhuma das duas rodava no KURIO (o jar fica vazio), mas a superfície de compatibilidade era grande: ordem, serialização, expiração e formato de persistência.

**Decisão: reversão isolada.** O MSW voltou a usar o `tough-cookie` real. Ficou só o substituto do `tldts`: uma função, `getDomain()`, usada pelo `tough-cookie` nas regras de sufixo público. Esse substituto é o que remove a Public Suffix List (251 kB) do chunk do MSW.

**Impacto medido da reversão** (A/B intercalado, 8 pares; `evidence/cp9-1/ab-hn-*.log`):

| Página | Antes (substituto do tough-cookie) | Depois (tough-cookie real) |
|---|---|---|
| Início mobile | 91 | 91 |
| Detalhe mobile | 90,5 | 88 |

**O que não é afetado.** Os contratos REST e a autenticação (header `Authorization`, não cookie) não passam pelo cookie jar. O isolamento (dados por usuário no banco simulado, epoch da sessão) e a persistência do banco simulado também não. Nada exigido pelo desafio depende de cookies, e nenhuma funcionalidade foi desativada: o jar do MSW continua funcionando com o `tough-cookie` original.

**Diferença que resta.** Em sufixos públicos de vários níveis (`vercel.app`, `github.io`, `co.uk`), o substituto usa os dois últimos rótulos. Ex.: `kurio-nft-marketplace-flax.vercel.app` → `vercel.app` (o real devolve o host inteiro). Efeito possível: um cookie SIMULADO com `Domain=vercel.app` seria aceito.

**Garantias** (`src/mocks/vendor/tldts-lite.ts` documenta tudo isso):

- `e2e/unit/tldts-lite.spec.ts`:
  - contrato: o `tough-cookie` importa do `tldts` só `getDomain`, nos builds ESM e CJS; quebra se uma atualização mudar isso;
  - diferencial com o `tldts` real em localhost, IPs e domínios comuns;
  - diferenças conhecidas listadas explicitamente.
- `e2e/hardening.spec.ts` › cookie jar do MSW: app completo (catálogo, login, dados privados, socket) com o jar persistido PREENCHIDO; sem erro de página.
- **Manutenção:** se o contrato quebrar numa atualização do MSW ou do tough-cookie, basta remover o alias (custo conhecido: ~111 kB gzip).

**Regressão encontrada durante a auditoria.** A suíte do mock acusou 1 falha em `recovery.spec` › sessão. A causa foi uma busca PRIVADA extra que a reconciliação do CP9.2 passou a fazer na 1ª conexão; ela disputava o 401 de expiração com a ação do usuário.

- **Correção:** dados privados voltaram ao comportamento do CP9; só consultas públicas de NFT em primeira busca são refeitas.
- **Resultado:** expiração (isolation e recovery) 48/48; corridas de tempo real e estados de erro 64/64 (`evidence/cp9-2-tests/*cp91*`).

### 2.2 Falha isolada de contraste no recibo

Não reproduziu: 50 execuções sob carga (a11y.spec inteiro, desktop e mobile, 5×, 4 workers), além de 36 anteriores. São 86 execuções sem reincidência desde a única ocorrência. A mensagem do teste agora mostra o seletor e o motivo de cada nó, se voltar.

Nessa repetição houve 5 falhas, todas **timeouts de 30 s** dos testes com 4 a 5 auditorias axe de página inteira, quando repetidos em paralelo. Não foram contraste. Nas suítes normais (3 seguidas) eles passam.

O teste não foi alterado, mascarado nem excluído. **Causa não identificada.**

## 3. Publicação

- **Merge:** `perf/cp9.2-mobile` → `main` por fast-forward (histórico preservado).
- **Autoria:** os 39 commits passaram a usar `182376837+SouFadinho@users.noreply.github.com` (`git filter-branch --env-filter`; conteúdo, mensagens e datas iguais).
  - Verificado: o e-mail pessoal não aparece em nenhuma versão de arquivo nem em mensagem.
  - Os identificadores mudaram: `planning/MAPA_DE_COMMITS.md`. Relatórios e logs anteriores mantêm os antigos.
  - A configuração local do Git usa o noreply.
- **Histórico:** revisado contra segredos e dados pessoais (CP9 §2; reverificado: 0 ocorrências do e-mail, 0 caminhos absolutos fora das evidências).
- **Ferramentas:** GitHub CLI 2.105.0 (winget) e Vercel CLI 66.6.0 (npm). O login nos dois foi feito pelo candidato.
- **Vercel:**
  - projeto `kurio-nft-marketplace`, ligado ao repositório pelo candidato; cada push na `main` gera o deploy de produção;
  - `vercel.json` aplicado: rewrites de SPA exceto `/api/*`, headers do Service Worker, cache imutável só dos assets com hash;
  - o vínculo local (`.vercel/`) e o token do CLI (`.env.local`) são ignorados pelo Git.

**Correspondência commit publicado ↔ código:**

1. A Vercel registra no GitHub um status `success` no commit publicado (ex.: `4cf4628`, deploy `kurio-nft-marketplace-hmmlffzr0`).
2. Build público local do mesmo commit × HTML publicado: 12 de 14 chunks com o **mesmo hash de conteúdo**. Os 2 restantes (entrada e CSS) diferem só em **6 linhas de arredondamento numérico** de cores `oklab` no CSS (compilador nativo Lightning CSS, Windows × Linux). Sem os números, os CSS são idênticos.

## 4. GitHub Actions (execuções reais)

| Run | Commit | Evento | Testes (job quality) | Lighthouse | Baselines Linux |
|---|---|---|---|---|---|
| 45672977911 | `1d30726` | push | **407 passed, 2 failed**, 17 skipped | (job ainda não existia) | — |
| 45676825374 | `4cf4628` | push | 65 unitários + **409 passed, 0 failed**, 17 skipped | falhou ao abrir o Chrome (AppArmor do Ubuntu 24.04) | — |
| 45679085901 | `f88f676` | push | sucesso | **sucesso** (rodada 1) | — |
| 45679106866 | `f88f676` | manual | sucesso | **sucesso** (rodada 2) | **geradas** |
| 45681329772 | `27fa582` | push | 65 unitários + **417 passed, 0 failed**, 9 skipped; **regressão visual 8/8 comparada no Linux** | **sucesso** (rodada 3) | comparadas no Linux |

**Falhas da 1ª execução, corrigidas sem mascarar:**

- **`layout.responsive`:** o placeholder do cupom tinha 196 px para 195 px de espaço no Linux (fonte 1 px mais larga). Correção real: `px-2` no mobile.
- **`tabs.spec`:** a outra aba buscava o preço novo pelo REST antes de ficar offline. É o comportamento correto, mas não o cenário do teste. Ganhou a pré-condição explícita: dado antigo na tela e rede assentada.

**Lighthouse no Ubuntu 24.04:** em vez de abrir o Chrome com `--no-sandbox` (flag diferente da auditoria local), o runner libera a restrição do AppArmor. As flags do Chrome ficam idênticas às locais.

**Baselines Linux:**

- 8 imagens geradas no container oficial `mcr.microsoft.com/playwright:v1.65.1-noble`.
- Inspecionadas antes de versionar, lado a lado com as do Windows (`evidence/cp9-1/baselines-linux-x-windows.png`): mesmo conteúdo, imagens e fontes carregadas. Única diferença esperada: a métrica de fonte (Início desktop 3.348 × 3.366 px).
- A partir do run 45681329772, a regressão visual compara no Linux em vez de ser ignorada.

## 5. Lighthouse independente na CI × local

3 rodadas (commits `f88f676` e `27fa582`, que diferem só em baselines e documentação). Mesmo script oficial (`npm run audit:lighthouse`) e mesmas versões: lockfile, Node 26.13.1 (`.nvmrc`), Lighthouse 13.6.0, Chromium do Playwright 1.65.1 (HeadlessChrome 159). Mesma configuração (mobile padrão: 4G lento simulado + CPU 4×; desktop padrão), 3 execuções por página e perfil. O script passou a registrar o índice de CPU de cada execução e o hardware.

**Relatórios HTML/JSON completos:** `planning/evidence/cp9-1/lighthouse-ci-run-45679085901/`, `…-run-45679106866/` e `…-run-45681329772/`.

| Página | Perfil | CI rodada 1 (Intel Xeon 6973P-C) | CI rodada 2 (AMD EPYC 9V45) | CI rodada 3 (AMD EPYC 9V74) | Local oficial CP9.2 (i5-1235U) | Local repetição CP9.2 |
|---|---|---|---|---|---|---|
| Início | mobile | **92** (92 · 92 · 92) | **93** (93 · 93 · 93) | **93** (93 · 93 · 53*) | 70 (59 · 92 · 70) | 76 (60 · 91 · 76) |
| Início | desktop | 98 | 99 | 98 | 98 | 98 |
| Detalhe | mobile | **91** (91 · 91 · 91) | **92** (92 · 92 · 92) | **91** (91 · 91 · 91) | 65 (65 · 64 · 70) | 89 (91 · 89 · 85) |
| Detalhe | desktop | 100 | 100 | 100 | 100 | 100 |

\* Rodada 3, Início mobile, execução 3: **53**, mantida e não descartada. Nesta execução, o documento HTML levou 2,2 s em localhost (normal: ≈ 7 ms); nada aconteceu até 11,2 s; depois, uma única tarefa de 5,7 s. FCP 10,6 s; TBT 168 ms. É compatível com a VM do runner parada (CPU compartilhada), não com um padrão do código: as outras 2 execuções da rodada deram 93 e o comportamento não se repetiu nas outras 35 execuções da CI. A mediana da combinação continua 93.

Accessibility 100, Best Practices 96 e SEO 92 em todos os perfis e ambientes.

| Métrica (mobile, mediana) | CI rodada 1 | CI rodada 2 | Local oficial |
|---|---|---|---|
| LCP Início / Detalhe | 3.161 / 3.167 ms | 3.148 / 3.170 ms | 3.149 / 3.101 ms |
| TBT Início / Detalhe | 136 / 181 ms | 89 / 126 ms | 1.127 / 2.549 ms |
| CLS | 0 | 0 | 0 |
| Índice de CPU do Lighthouse (faixa) | 1.814–2.553 | 3.585–3.932 | 1.479–2.115 |

**Leitura:**

- O **LCP é praticamente igual** nos três ambientes (≈ 3,1–3,2 s); o ganho do CP9.2 se confirma.
- A diferença está toda no **TBT**. Na máquina local aparece, em parte das execuções, uma tarefa sem atribuição no início do carregamento: o Chrome headless emulando a GPU na CPU. Ela chega a 2,7 s simulados. Nos runners da CI ela não aparece: em 35 das 36 execuções, cada combinação varia no máximo 1 ponto (a exceção está explicada abaixo da tabela).
- **Metas atingidas no ambiente independente; não atingidas de forma estável na máquina local.** Os resultados locais anteriores não foram substituídos.

**Limites de comparabilidade:**

- **Hardware:** sistemas operacionais e CPUs diferentes; o runner é uma VM compartilhada com 4 vCPUs.
- **Índice de CPU diferente:** a rodada 2 teve um índice mais alto que a rodada 1 e marcou 1 ponto a mais.
- **Throttling simulado (Lantern):** amplia diferenças de CPU real.
- **Rede local:** nos dois ambientes o servidor é o `vite preview` local da própria máquina, não a Vercel.

Uma auditoria na URL pública (CDN, HTTP/2, brotli) mediria outra coisa e não foi usada como resultado oficial.

## 6. Validação da aplicação publicada

`e2e/public.smoke.ts` (`playwright.smoke.config.ts`, `SMOKE_URL`), em desktop e mobile, contra **https://kurio-nft-marketplace-flax.vercel.app**:

| Verificação | Resultado |
|---|---|
| HTTPS; `mockServiceWorker.js` com `Content-Type` JS, `Cache-Control: no-cache, no-store`, `Service-Worker-Allowed: /` | ok |
| Assets com hash `immutable`; imagens dos NFTs sem cache imutável | ok |
| Deep links e refresh (`/mercado`, `/nft/nft-001`, `/pedidos/…`, `/perfil/carteiras`, rota inexistente) → 200 com o app; `/api/*` fora do Service Worker → 404 (sem fallback de SPA) | ok |
| Service Worker do MSW controlando a página; `/demo/*` → 404 do app | ok |
| Catálogo com filtro na URL, refresh, **Socket.IO sobre página HTTPS (wss)**: preço alterado no servidor simulado chega ao card | ok |
| Credencial errada recusada; login, logout; **isolamento** (favorito de Ana não aparece para Bruno) | ok |
| Perfil e carteiras com os dados da conta | ok |
| **Compra completa:** carrinho, cupom KURIO10, pagamento com carteira simulada, recibo confirmado pelo `order.updated` (total 1.087 ETH) | ok |
| Pagamento recusado; pedido pendente com queda de conexão, reconciliado ao reconectar e após refresh | ok |
| Sem exceção na página nem erro no console. Só são ignoradas as linhas "Failed to load resource" que o navegador registra para respostas 4xx esperadas da API | ok |

**Resultado: 14/14 em duas rodadas** (`evidence/cp9-1/smoke-publico-1.log`, `-2.log`).

## 7. Documentação atualizada

| Documento | O que mudou |
|---|---|
| README | URLs públicas, telas reais (`docs/screenshots/`, das capturas do build de produção), resultados Lighthouse local × CI, comando do smoke, limitações (cookies simulados, domínio) |
| ARCHITECTURE | performance do CP9.2/CP9.1 e a correção de tempo real |
| `REQUIREMENTS_MATRIX` | ELIM-06, AV-6, AV-8, TEST-02, LH-01..06, DEL-02/03 |
| `RISK_REGISTER` | R-25 e R-48 atualizados; novos R-50 a R-54 |
| Outros | `MAPA_DE_COMMITS.md` |

## 8. Limitações restantes

- **Performance local:** mobile ≥ 90 não é estável na máquina local (CI: 91–93).
- **Acessibilidade:** sem leitor de tela; sem declaração WCAG.
- **Contraste no recibo:** a falha única não teve causa identificada.
- **Assets:** artes substitutas; galeria com 2 vistas.
- **Simulação no navegador:** banco por visitante, sem backend compartilhado.
- **Vercel:** o identificador do time aparece nas URLs de preview (R-52); o domínio sem `-flax` é de outro projeto (R-53).

## 9. Commits

Na `main` pública (autoria noreply), deste checkpoint:

- `27fa582` CP9.1: baselines visuais Linux (geradas na CI, inspecionadas) e Lighthouse independente da CI
- `f88f676` CP9.1: Lighthouse na CI com sandbox do Chrome liberado; concorrência por evento; ARCHITECTURE
- `4cf4628` CP9.1: Lighthouse independente na CI, smoke da URL pública e correções da 1ª CI real
- `1d30726` CP9.1: mapa de commits após a troca de autoria para o noreply do GitHub

(e o commit deste relatório).
