# CP7 — Consolidação de testes, cobertura e CI · Relatório

Data: 2026-11-25. Separação obrigatória neste relatório: **EXECUTADO E COMPROVADO** (com log) × **PREPARADO** (sem execução real ainda).

## 1. Resumo
- **Cobertura:** os 12 grupos obrigatórios de E2E estão mapeados para arquivos, testes, dispositivos e evidências (`planning/E2E_COVERAGE.md`). Nenhum grupo estava descoberto, e nenhum teste foi criado só para aumentar números.
- **Critérios eliminatórios:** auditados no código e nos testes (`planning/ELIMINATORY_AUDIT.md`); ELIM-01..05 validados, ELIM-06 validado localmente (CI ainda não executado).
- **Lacunas técnicas do CP6 corrigidas com testes determinísticos** (`e2e/hardening.spec.ts`, 9 × 2):
  - carrinho em duas abas visíveis (`cart.updated` pelo Socket.IO);
  - timeout + refresh ou fechamento da aba (recuperação pela chave, sem novo pedido);
  - troca de líder durante requisição e liquidação;
  - navegador sem Web Locks;
  - explorador sem dados privados.
- **Um defeito real encontrado e corrigido** na própria recuperação (§3).
- **Qualidade dos testes:**
  - esperas arbitrárias substituídas por eventos;
  - asserção de "sem confirmação antes da API" tornada determinística;
  - pulos (`skip`) e esperas restantes justificados;
  - contraprovas de R-42 e R-44 preservadas.
- **Regressão visual:** relógio fixo, sem toasts, tolerância justificada; baselines Windows versionadas. **Baselines Linux não foram geradas** (sem Docker/Linux aqui): o teste é ignorado no Linux com motivo explícito, e o comando oficial ficou pronto para o CP9.
- **CI:** workflow do GitHub Actions **preparado, não executado** (sem remoto).
- **Suíte completa (executada):** 461 aprovados · 0 reprovados · 6 ignorados (12,1 min); typecheck, lint e build aprovados; relatório HTML gerado.

## 2. Executado e comprovado × preparado
| Item | Situação | Evidência |
|---|---|---|
| Typecheck, lint, build | EXECUTADO | `cp7-tests/typecheck-lint-build.log` |
| Suíte completa (unit + D + M + R + visual Windows) | EXECUTADO | `cp7-tests/full-run-1.log` |
| Relatório HTML do Playwright | EXECUTADO (gerado nesta rodada) | `cp7-tests/playwright-report/index.html` |
| Testes das lacunas (hardening) | EXECUTADO (direcionado + suíte completa) | `cp7-tests/dev-*.log`, `full-run-1.log` |
| Baselines visuais Windows (4 telas × D/M) | EXECUTADO (comparadas nesta rodada, sem regeneração) | `e2e/visual.spec.ts-snapshots/*-win32.png` |
| Baselines Linux | **PREPARADO** (`npm run test:visual:update:linux`, container oficial `mcr.microsoft.com/playwright:v1.65.1-noble`) | gerar e validar no CP9 |
| Workflow de CI | **PREPARADO** (`.github/workflows/ci.yml`); sintaxe revisada manualmente, sem parser YAML local | executar no CP9 após autorização de publicação |
| Lighthouse oficial (12 execuções) | **PREPARADO** (`npm run audit:lighthouse`) | CP8 |
| Checkout limpo do HEAD | não executado neste CP (orientação) | CP9 |

## 3. Pendências técnicas do CP6: investigação e correções
| Pendência | Achado | Correção | Teste |
|---|---|---|---|
| Duas abas visíveis, mesmo usuário e carrinho | A aba aberta só atualizava ao voltar a ficar visível | Evento privado `cart.updated` emitido pelo servidor simulado a cada mudança do carrinho do usuário (escrita, merge, confirmação), entregue pelo socket.io-client de cada aba. O cliente só revalida pelo REST (EventGuard por versão) | hardening › aba atualiza sozinha; evento não chega a outro usuário |
| Timeout + refresh ou fechar a aba antes da resposta | A tentativa ficava em `sessionStorage`, morria com a aba e era comparada pelo conteúdo exato. Depois de um refresh a cotação muda, e um novo "Confirmar" criaria um 2º pedido | Tentativa persistida por usuário em `localStorage`; ao entrar no pagamento, `GET /orders/by-key/:key` (nunca cria) encontra o pedido e leva a ele; se não existir, a tentativa é descartada | hardening › refresh; fechar a aba + novo login; tentativa que não chegou ao servidor |
| **Defeito encontrado na correção acima** | A consulta pela chave rodava a cada render e disparava na PRÓPRIA página durante o envio: chegava antes da gravação, recebia 404 e apagava a chave (falha intermitente: `dev-cp7-hard2.log`, `dev-cp7-hard3.log`; diagnosticado pelo trace de rede) | Só a tentativa existente ao ENTRAR na página é consultada; um 404 só apaga a mesma chave | `dev-cp7-hard4.log`: 36/36 (18 × 2 repetições) |
| Troca de líder durante requisições e liquidação | RPC para o líder que fechou esperava 20 s | Ao ser promovida, a aba falha na hora as próprias RPCs pendentes (o retry do Query é atendido por ela). A liquidação persistida é retomada pela nova líder | hardening › durante uma requisição (sem esperar 20 s); durante a liquidação (fechada antes dos 4 s, confirmada depois) |
| Compatibilidade de Web Locks e BroadcastChannel | Ambos existem nos navegadores atuais; Web Locks exige contexto seguro. **O próprio MSW exige BroadcastChannel** (sem ele a camada de mocks não sobe) | Sem Web Locks: modo de aba única, com aviso | hardening › sem Web Locks |
| Explorador sem dados privados | Contrato já era público, mas sem prova | Teste com as chaves exatas e a ausência de e-mail, nome, itens, ids e apelido | hardening › contrato público |

## 4. Auditoria da qualidade dos testes
| Verificação | Resultado |
|---|---|
| Asserções que passam sem provar | `checkout.spec` (fluxo principal): a ausência de confirmação dependia de uma janela de tempo. Agora a criação fica **retida** no servidor e o teste exige 0 pedidos, nenhuma navegação e nenhum texto de confirmação enquanto retida. As ausências do CP6 foram revisadas: todas vêm depois de um estado positivo observado (pendente na tela). |
| Esperas arbitrárias | `catalog.spec` (respostas fora de ordem): 450 ms e 1,5 s **substituídos** por espera da requisição lenta e do seu desfecho (entregue ou cancelada). **Restantes, justificadas:** 80 ms (Radix só seleciona com a seta ainda pressionada), 300 ms (janelas de asserção negativa DEPOIS de observar o evento ou a resposta antiga), 150 ms (quadro extra antes da captura visual). |
| Retries mascarando defeitos | `retries: 0` no Playwright. Retries do TanStack Query são do produto (falhas transitórias) e, quando atrapalhavam um cenário de erro, o cenário passou a falhar até `recover(rota)`. |
| Dependência e estado compartilhado | Cada teste: contexto novo + `?reset=1`. Estado de retenção/falhas fica no mock da página (zerado no reset). Sem ordem entre testes (`fullyParallel`). |
| Testes ignorados | 6 específicos de dispositivo (modal e abas só no desktop; tela cheia só no mobile; filtros por teclado no desktop e drawer no mobile; badge do header no R-44) + regressão visual no Linux sem baseline (motivo explícito). Todos com motivo no `test.skip`. |
| Mocks escrevendo no cache ou na UI | Nenhum: `src/mocks` não importa QueryClient nem componentes; o lint proíbe importar `src/mocks` fora de `main.tsx`; `__kurioMock` só altera o banco e emite eventos. |
| Contraprovas R-42/R-44 | Preservadas em `cp6-tests/*SEM-PROTECAO*.log` e `R-44-SO-GUARDA-DE-VERSAO.log`; os testes continuam na suíte. |

## 5. Regressão visual e Linux
- **Telas:** Início, Detalhe, Carrinho e Pagamento × desktop e mobile (8 baselines `-win32`, versionadas).
- **Determinismo:**
  - relógio fixo (`page.clock.setFixedTime`, que só fixa a data e não congela os timers do MSW);
  - seed com `?reset=1`;
  - fonte local carregada (`document.fonts.ready`);
  - imagens completas e decodificadas;
  - animações desligadas e `reducedMotion`;
  - nenhuma região `aria-busy`, skeleton ou animação rodando;
  - **nenhum toast na tela**.
- **Tolerância:** `maxDiffPixelRatio: 0.01`. Cobre o antialiasing de fonte e de bordas na mesma plataforma; mudanças de layout ou conteúdo passam muito disso. Na rodada do CP7, as 8 passaram sem regenerar.
- **Linux:** não gerei baselines Linux a partir das capturas do Windows. Sem baseline Linux, o teste é **ignorado no Linux com o motivo** (em vez de gravar a captura e passar sem comparar).
  - Para gerar no CP9: `npm run test:visual:update:linux` (Docker com a imagem oficial do Playwright 1.65.1);
  - depois, conferir as imagens e commitar.
  - Não há Docker nem Linux nesta máquina.

## 6. Resultados
**Verificações estáticas** (`cp7-tests/typecheck-lint-build.log`): `tsc -b` sem erros · ESLint sem avisos · `vite build` ok.

**Suíte completa** (`npx playwright test --reporter=line,html`; build de produção + MSW; 4 workers; Windows): **461 aprovados · 0 reprovados · 6 ignorados · 12,1 min** (`cp7-tests/full-run-1.log`; HTML em `cp7-tests/playwright-report/index.html`).

**Por projeto (467):** unit 59 · desktop-chromium 186 · mobile-chromium 186 · responsive 36.

**Novos no CP7 (18):** `hardening.spec` 9 × 2. Testes alterados sem perda de cobertura:
- `checkout.spec`: criação retida, asserção mais forte;
- `catalog.spec`: fora de ordem sem esperas arbitrárias;
- `visual.spec`: relógio fixo, sem toasts, guarda de Linux.

**Testes direcionados durante o CP7:**

| Teste | Resultado |
|---|---|
| hardening (1ª rodada) | 14/18: 2 erros de teste e 2 achados de compatibilidade do MSW |
| hardening (2ª rodada) | 16/18: o defeito da §3 |
| hardening após a correção (×2 repetições) | 36/36 |
| troca de líder durante a liquidação (×3) | 6/6 |
| catálogo fora de ordem (×3) | 6/6 |
| fluxo principal do checkout | 6/6 |
| regressão visual | 8/8 |

A primeira rodada completa do CP7 já foi a final: não houve falha na suíte completa.

## 7. CI e reprodução (preparado)
Workflow `.github/workflows/ci.yml` (ubuntu-24.04, Node pela `.nvmrc` = 26.13.1, cache npm):
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. `npx playwright install --with-deps chromium`
6. `npm run test:unit`
7. `npm run test:e2e:browsers` (desktop, mobile, responsivo e visual)

Por último, o upload de artefatos: o relatório HTML do Playwright sempre, e `test-results/` (traces, capturas e diffs) nas falhas. `PW_WORKERS=2` no CI.

**Não executado**: o repositório não tem remoto (publicação só com autorização, CP9). Não declaro o CI aprovado.

**Comandos locais:**

| Comando | O que faz |
|---|---|
| `npm ci` | instala pelo lockfile |
| `npx playwright install chromium` | instala o navegador dos testes |
| `npm run typecheck`, `npm run lint`, `npm run build` | verificações estáticas e build |
| `npm run test:unit` | testes unitários |
| `npm run test:e2e:browsers` | E2E desktop, mobile e responsivo |
| `npm run test:e2e` | tudo |
| `npm run test:visual` | só a regressão visual |
| `npm run test:e2e:report` | abre o relatório HTML |

## 8. Preparação para o CP8
### 8.1 Pendências visuais por impacto e prioridade (matriz §12)
| Prioridade | Itens | Por quê |
|---|---|---|
| **P1: telas com frame no Figma, maior distância** | VIS-10 formulário de pagamento desktop · VIS-07 formulário de carteiras · VIS-12 + VIS-05 CTA fixo mobile sem esconder o total ou o conteúdo · VIS-15 toasts sem encobrir ações | Fidelidade das telas avaliadas e risco de usabilidade no mobile |
| **P2: fidelidade perceptível** | VIS-01 altura do hero mobile · VIS-03 + VIS-06 variedade e qualidade das artes · VIS-11 + VIS-09 cards do carrinho mobile · VIS-08 posição do modal desktop · VIS-14 hierarquia do recibo | Primeira impressão e consistência entre telas |
| **P3: acabamento** | VIS-02 espaçamento hero → catálogo · VIS-04 miniaturas da galeria · VIS-16 espaçamentos e tipografia gerais | Ajustes finos após P1/P2 |
| **Processo** | VIS-13 | Suíte completa e axe depois de cada lote; baselines visuais atualizadas só para mudanças intencionais, com registro |

### 8.2 Lighthouse oficial (não executado)
- `npm run audit:lighthouse` (= `scripts/lighthouse.mjs`).
  - Faz o build de produção e sobe o `vite preview`.
  - Audita Início (`/`) e Detalhe (`/nft/nft-001`) nos perfis mobile (padrão do Lighthouse) e desktop (`desktop-config`), **3 execuções por combinação = 12**.
  - Grava a mediana por categoria em `lighthouse/summary.{md,json}` e os relatórios em `lighthouse/reports/`.
- Metas: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90.
- `LH_SKIP_BUILD=1` reaproveita o build; `LH_RUNS=1` é só uma rodada rápida e o relatório a marca como NÃO OFICIAL.
- No CP8, depois dos ajustes visuais: rodar com a máquina sem carga, manter os resultados tal como medidos (sem manipular) e registrar as condições.

## 9. Situação dos requisitos
- **Validados neste CP:**
  - ELIM-01..05;
  - ELIM-06 (local);
  - E2E grupos 1–12 (mapa);
  - correções e testes das pendências do CP6.
- **Preparados, não executados:** CI, baselines Linux, Lighthouse oficial.
- **Pendentes:**
  - CP8: VIS-01..16 e Lighthouse oficial;
  - CP9: checkout limpo, baselines Linux + execução do CI (com autorização de publicação), remoção de `/demo/*`, README e deploy.

## 10. Commit
COMMIT_INFO
