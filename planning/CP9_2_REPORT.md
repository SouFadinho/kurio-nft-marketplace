# CP9.2 — Engenharia de performance mobile

Data: 25/11/2026 · Branch: `perf/cp9.2-mobile` (a versão estável do CP9 continua em `main`, `b2f0bbe`). Nada publicado.
Ambiente: Windows 11, notebook Intel i5-1235U (2 núcleos P + 8 E), 16 GB (≈ 3 GB livres), Node 26.13.1, Lighthouse 13.6.0, Chromium do Playwright 1.65.1 (HeadlessChrome 159). Configuração oficial do Lighthouse inalterada (mobile padrão: 4G lento simulado + CPU 4×; desktop padrão).

## 1. Resultado

**Metas:** Performance ≥ 90 nos dois perfis mobile.
- **Não atingida** na rodada oficial final (Início 70, Detalhe 65), nem na repetição completa (76 e 89).
- Accessibility 100, Best Practices 96 e SEO 92 mantidos em todos os perfis.
- Desktop 98 / 100.
- **Zero regressões funcionais**: suíte completa 478 passed, 0 failed.

O LCP mobile caiu de ≈ 4,9 s para ≈ 3,1 s; esta parte é o ganho estrutural do CP9.2. O TBT não caiu de forma estável: nas execuções ruins ele é dominado por **uma única tarefa sem atribuição na inicialização** (≈ 250–680 ms reais), que não vem do código da página (§3, C9). As execuções em que essa tarefa é pequena chegam a 85–92 com o mesmo código.

### 1.1 Medianas: CP9 oficial × CP9.2 oficial × CP9.2 repetição

| Página | Perfil | CP9 oficial (`a5aff5b`) | CP9.2 oficial (execuções) | CP9.2 repetição (execuções) | LCP CP9 → CP9.2 | TBT CP9 → CP9.2 (oficial) | CLS |
|---|---|---|---|---|---|---|---|
| Início | mobile | 55 | **70** (59 · 92 · 70) | 76 (60 · 91 · 76) | 4.930 → 3.149 ms | 1.492 → 1.127 ms | 0.000 |
| Início | desktop | 97 | **98** (98 · 97 · 98) | 98 (98 · 98 · 97) | 1.266 → 1.176 ms | 18 → 0 ms | 0.000 |
| Detalhe | mobile | 64 | **65** (65 · 64 · 70) | 89 (91 · 89 · 85) | 4.736 → 3.101 ms | 649 → 2.549 ms | 0.000 |
| Detalhe | desktop | 98 | **100** (100 · 100 · 100) | 100 (100 · 100 · 100) | 1.076 → 714 ms | 40 → 0 ms | 0.000 |

Accessibility, Best Practices e SEO (mediana, todos os perfis, CP9.2 oficial): 100 · 96 · 92.

### 1.2 De onde vem o TBT nas rodadas oficiais (auditoria `long-tasks` do próprio Lighthouse)

| Execução | Perf | TBT | Maior tarefa sem atribuição no início (ms simulados) | `benchmarkIndex` |
|---|---|---|---|---|
| oficial detalhe-mobile-1 | 65 | 2.549 | 2.305 | 1867 |
| oficial detalhe-mobile-2 | 64 | 2.878 | 2.572 | 1479 |
| oficial detalhe-mobile-3 | 70 | 1.120 | 994 | 1612 |
| oficial inicio-mobile-1 | 59 | 4.014 | 2.727 | 2007 |
| oficial inicio-mobile-2 | 92 | 131 | 52 | 1709 |
| oficial inicio-mobile-3 | 70 | 1.127 | 1.086 | 1784 |
| repetição detalhe-mobile-1 | 91 | 215 | 147 | 1737 |
| repetição detalhe-mobile-2 | 89 | 241 | 243 | 1743 |
| repetição detalhe-mobile-3 | 85 | 343 | 243 | 2012 |
| repetição inicio-mobile-1 | 60 | 3.507 | 2.351 | 2115 |
| repetição inicio-mobile-2 | 91 | 154 | 111 | 1846 |
| repetição inicio-mobile-3 | 76 | 731 | 561 | 1872 |

A tarefa aparece antes de qualquer script do app (≈ 0,6–1,5 s simulados) e não tem script associado. Os traces de diagnóstico mostram, no mesmo intervalo, o processo de GPU do Chrome headless inicializando (SwiftShader). O tamanho dela variou de ≈ 110 a 2.727 ms com o mesmo build.

**O que isso permite afirmar:**
- o CP9.2 reduziu de verdade bytes, LCP e o trabalho atribuível ao código;
- nesta máquina, a meta mobile depende de uma parcela ambiental que o app não controla.

**O que não permite afirmar:** que a meta foi atingida.

A/B intercalado (8 pares, mesmas condições da auditoria, fora da rodada oficial): o código do fim do CP9.2 chegou a medianas de 90–92 (Início) e 89,5–90,5 (Detalhe) com a máquina menos carregada (logs em `planning/evidence/cp9-2-perf/ab/`, resumidos no §4).

## 2. Método

- **Base reproduzível:** diagnósticos com a mesma configuração do `scripts/lighthouse.mjs`, mas guardando o trace completo (`scripts/perf/lh-trace.mjs`). O relatório oficial não traz o trace.
- **Ferramentas novas** (`scripts/perf/`, versionadas):

  | Ferramenta | Para que serve |
  |---|---|
  | `lantern-lcp.mjs` | linha do tempo SIMULADA do LCP pelo próprio modelo do Lighthouse (`LANTERN_DEBUG`): quais requisições e tarefas compõem os ~4 s |
  | `profile-startup.mjs` | perfil do V8 com CPU 4× e sourcemap: custo por pacote e por função até a primeira imagem |
  | `bundle-composition.mjs` | bytes de cada chunk por módulo de origem |
  | `cpu-by-script.mjs`, `task-window.mjs`, `waterfall.mjs` | atribuição das tarefas longas e da cascata observada |
  | `variance.mjs` | relação entre o `benchmarkIndex` de cada execução e o resultado |
  | `ab.mjs` | **A/B intercalado**: dois builds servidos ao mesmo tempo, execuções alternadas A, B, A, B… |

- **Por que o A/B:** a máquina deriva ao longo do tempo (`benchmarkIndex` de 1321 a 2342). Lotes sequenciais chegaram a indicar o contrário do A/B (H-U), por isso as decisões finais usam A/B de 8 pares.
- **Rotina:** uma hipótese por vez; testes dirigidos antes de cada commit; reversão do que não trouxe ganho medido.

## 3. Causas identificadas (com evidência)

| # | Causa | Evidência |
|---|---|---|
| C1 | **Public Suffix List no chunk do MSW.** `tough-cookie` (cookie jar emulado do MSW, que o KURIO não usa) puxa o `tldts`: 277 kB de 482 kB do chunk, mais custo de CPU em **toda** requisição simulada | `bundle-composition` (tldts 251 kB); perfil: `canonicalDomain`, `getCookieContext`, `getAllDocumentCookies` |
| C2 | **~30 chunks de 0,3–3 kB na abertura.** Em HTTP/1.1 o Lantern simula 6 conexões por origem com RTT de 150 ms: cada chunk minúsculo ocupava uma conexão, e o MSW (necessário antes de qualquer dado) só começava a baixar em 2,4 s. Os componentes da tela vinham em 3 ondas encadeadas | `lantern-lcp`: LCP otimista terminava exatamente no fim do download do `browser.js` |
| C3 | **Layout síncrono forçado no commit.** O drawer (vaul) lê `window.scrollY` ao montar, e o Slider do Radix mede o próprio tamanho. Ambos ficavam montados e **escondidos por CSS** no mobile | perfil: `vaul › onScroll` 206 ms (CPU 4×); depois `@radix-ui/react-use-size` 201 ms |
| C4 | **Variantes desktop montadas no mobile:** barra lateral, ordenação, galeria com diálogo, rodapé duplo | mesmas medições; DOM e trabalho do React |
| C5 | **`TooltipProvider` em todo o App**, usado só na galeria interna: Radix Tooltip, Popper e floating-ui na abertura | `bundle-composition` (`ui` 25 kB gzip) |
| C6 | **Inicialização do ICU (Intl) em caminho quente:** `toLocaleString('pt-BR', …)` no `RatingStars` e `localeCompare` na ordenação padrão do catálogo simulado | perfil: `RatingStars` foi a função mais cara do detalhe; `catalog-model` 35 ms |
| C7 | **Detalhe sem pintura até os dados.** O loader com `await` segurava a primeira pintura com conteúdo; a renderização inteira (~65 ms de JS) acontecia num bloco | FCP simulado 2,54 s × 0,96 s na Início |
| C8 | **sonner na abertura** (33 kB), embora os toasts só apareçam depois de uma ação | `bundle-composition` |
| C9 | **Variação ambiental (53 → 71 com o mesmo código).** O Chrome headless emula a GPU na CPU (SwiftShader). Na inicialização da GPU e no primeiro quadro com imagens, a thread principal fica bloqueada esperando o compositor ou a GPU, em tarefas **sem atribuição**. O `benchmarkIndex` variou 1,7× entre execuções (CPU híbrida, notebook sob carga contínua, apps do usuário abertos) | `task-window`: GPU 159 ms + compositor 162 ms + thread principal 164 ms no mesmo intervalo; `variance.mjs` (correlação benchmark × TBT de −0,37 a −0,67) |

## 4. Hipóteses e decisões

| Hipótese | Medição | Decisão |
|---|---|---|
| H-A: substituto mínimo do `tldts` | MSW 175 → 64 kB gzip; LCP mobile 4,8 → 4,1 s (Início), 4,7 → 4,0 s (Detalhe) | **mantida** (depois evoluiu para H-N) |
| H-B: drawer de filtros sob demanda; variantes desktop só no desktop | TBT mediano 640 → 471 ms (Início) | **mantida** |
| H-C: latência padrão 120 → 0 ms | LCP **piorou** (4,1 → 4,5 s) | revertida; 120 ms mantidos |
| H-D: `codeSplitting.groups` (react, vendor, ui, app, kit, catalog) | Início 86–88 (5 exec.); tarefas longas quase zeradas | **mantida** |
| H-E: Select/Slider (ordenação e filtros desktop) via `React.lazy` | `catalog` 25,7 → 7,5 kB gzip; desktop CLS 0,010 → 0,0005 | **mantida** |
| H-H/H-I: zoom da galeria sob demanda; grupo `detail`; pré-carregamento do chunk da **rota atual** (script inline) | Detalhe: FCP 2,54 → 0,98 s, LCP 3,64 → 3,26 s | **mantida** |
| H-J: abas e relacionados do detalhe numa transição | Detalhe 77 → 82 (mediana) | **mantida** (com reserva de espaço; CLS 0) |
| Script de pré-carregamento no fim do `<body>` | LCP igual; Início pior | revertida (volta ao `<head>`) |
| H-L: `TooltipProvider` só na galeria interna | `ui` 25 → 6,4 kB gzip | **mantida** |
| H-M: `formatRating` sem Intl (equivalência testada em 110 valores) | ICU fora do caminho quente | **mantida** |
| Rodapé montado após a 1ª pintura | FCP simulado **piorou** 0,93 → 1,52 s (o trabalho caía antes da pintura apresentada) | revertida; mantido só "uma variante por breakpoint" + `memo` |
| H-N: substituto mínimo do `tough-cookie` (API usada pelo MSW, testes unitários) | MSW 65 → 58 kB gzip; sem custo de cookie por requisição; 138 testes do mock passando | **mantida** |
| H-Q: seções secundárias do detalhe só após a imagem principal | FCP do detalhe 1,5 → 0,92 s | **mantida** |
| H-R: página do detalhe numa transição | tarefa de render de 46 → 30–35 ms | **mantida** |
| H-S: `useMatches({ select })` no AppShell | sem ganho distinguível do ruído | mantida (remove re-render inútil do shell) |
| H-T: sonner sob demanda (`src/lib/toast.ts`), Toaster com `aria-live` antes da 1ª mensagem | núcleo inicial ~270 → ~250 kB gzip; Início 79–92 | **mantida** |
| H-U: lazy loading por IntersectionObserver (margem 300 px) | lotes sequenciais pareciam melhores; **A/B (8 pares): Início 90 → 83, Detalhe 89,5 → 84,5** | **revertida** |
| H-V: `useDeferredValue` na grade | A/B: 92 × 92 | descartada |
| H-W: `decoding="async"` na imagem principal | A/B: 90,5 × 91 (ruído) | descartada |
| H-X: ordenação padrão do mock sem colador ICU | A/B: TBT 183 → 138 ms, 91 → 92 | **mantida** |
| Imagens menores / srcset (experimentos com o `dist` a 320 e 384 px) | LCP inalterado; tarefa do quadro de imagens um pouco menor, sem efeito claro no score | não implementado |
| Remover a sombra borrada da barra de compra | +4 no detalhe num lote, mas muda o design | **não adotado** (fidelidade visual) |
| zod → `zod/mini` | ganho estimado ~19 kB gzip (≈ +1 ponto no modelo); reescrita de 563 linhas com risco nas mensagens de validação | **não feito** (risco × ganho); opção documentada |
| Brotli no `vite preview` | o servidor local comprime só com gzip; a Vercel usa brotli | **não feito**: alteraria as condições da auditoria local |

## 5. Corrida de tempo real encontrada (latente desde o CP9)

Durante o CP9.2, o teste "resposta REST antiga que chega DEPOIS do evento" passou a falhar de forma intermitente (2/12). A bissecção apontou o commit H-T, que só mudou o tempo de conexão do socket. A investigação mostrou um **defeito real** do cliente, presente também no `main`:

1. O socket conecta depois da primeira renderização; um `nft.updated` emitido antes da conexão se perde.
2. Na reconciliação, uma consulta ainda na **primeira busca** (sem dados) não era refeita. No TanStack Query v5, sem dados o `cancelRefetch` não se aplica: o `invalidateQueries` se junta à requisição em andamento, e o "invalidado" é limpo quando ela termina.
3. Resultado: o preço antigo (1,69) ficava na tela indefinidamente.

**Correção** (`src/realtime/RealtimeProvider.tsx`): essas consultas são refeitas quando a busca termina, em tempo ocioso (máx. 2 s), e a reconciliação também roda na primeira conexão quando há consultas em trânsito.

**Evidência** (`planning/evidence/cp9-2-tests/`):

| Situação | Resultado | Log |
|---|---|---|
| Teste determinístico novo (servidor offline + listagem retida) com o `RealtimeProvider` do `main` | **24/24 falham** | `…SEM-CORRECAO-controle-negativo.log` |
| Os dois testes de corrida com a correção | **48/48** | `…COM-CORRECAO-48x.log` |
| Idem, com a busca extra em tempo ocioso | **48/48** | `…COM-CORRECAO-ocioso-48x.log` |

Custo: uma busca extra depois do primeiro conteúdo na maioria das aberturas. No A/B, com a máquina carregada, o TBT mediano subiu 136 ms antes da otimização "em tempo ocioso". **A correção prevalece sobre a pontuação.**

O teste antigo ganhou a pré-condição "socket conectado": o cenário dele exige que o evento CHEGUE ao cliente. O caso do evento perdido agora tem teste próprio.

## 6. Alterações nos testes (sem reduzir cobertura)

- `catalog.spec`: dois testes liam a lista sem esperar o resultado. A tela agora renderiza antes da resposta da API, então eles passaram a esperar o primeiro card. Mais: a pré-condição do teste de corrida e o teste novo do §5.
- `a11y.spec`: a mensagem de falha mostra o seletor e o motivo de cada nó.
- Novos testes unitários:
  - `unit/rating.spec`: `formatRating` igual ao Intl;
  - `unit/tough-cookie-lite.spec`: o substituto cobre o uso do MSW.
- Observação: uma violação `color-contrast` no recibo apareceu **uma vez** sob carga e não se reproduziu em 36 repetições. Causa não identificada; a mensagem nova vai mostrar o nó se reaparecer.

## 7. Validação final

| Verificação | Resultado | Registro |
|---|---|---|
| typecheck · lint · build | exit 0 · 0 · 0 | `cp9-2-tests/typecheck-lint-build.log` |
| Suíte completa, rodada 1 (4 workers) | 474 passed, **4 failed** (estados de erro do catálogo: regressão da 1ª versão da correção de tempo real) | `cp9-2-tests/suite-completa-rodada1-4-falhas.log` |
| Suíte completa, rodada 2 | 477 passed, **1 failed** (expiração ao favoritar: regressão confirmada, branch 3/16 × main 16/16) | `cp9-2-tests/isolation-expiracao-*.log` |
| **Suíte completa, rodada 3 (código final)** | **478 passed, 0 failed, 9 skipped** (487 testes = 482 do CP9 + 5 novos) | `cp9-2-tests/suite-completa.log` |
| Regressão visual (8 baselines Windows) | passa, sem atualização de baseline no CP9.2 | idem |
| Corridas de tempo real e estados de erro | 48/48 (final) | `cp9-2-tests/corrida-*.log` |
| Build público (`check:public-build`) | `/demo/*` em 404, deep links 200, nenhum chunk demo | `cp9-2-tests/check-public-build.log` |
| Critérios eliminatórios | mantidos: 0 imports de mocks fora de `src/mocks` e `main.tsx`, 0 `__kurioMock`, 0 `fetch` direto, 0 `emit`/`publish` na UI; Router (53 arquivos), Query (17), Axios, socket.io-client e MSW em uso | §7 deste relatório |
| Lighthouse oficial (12 execuções) e repetição (12) | §1 | `cp9-2-perf/oficial/`, `cp9-2-perf/repeticao/` (HTML + JSON) |

## 8. Riscos

| Risco | Mitigação |
|---|---|
| **Substituto do `tough-cookie`** depende da API interna que o MSW usa do cookie jar; uma atualização do MSW pode exigir revisão | MSW fixado (2.15.0); testes unitários do substituto; a suíte inteira passa pelo MSW |
| **Grupos de chunks** são explícitos: um módulo novo pode cair no grupo errado e entrar ou sair da abertura | comentários no `vite.config.ts`; `bundle-composition.mjs` mostra o efeito |
| **Pré-carregamento por rota:** os padrões (`/`, `/mercado`, `/nft/:id`) estão no `vite.config.ts` e precisam acompanhar as rotas | se o padrão não casar, nada quebra: só deixa de pré-carregar |
| **Toaster** monta na 1ª interação ou após 4 s | um toast pedido antes monta o Toaster primeiro; a11y e testes de feedback passando |
| **Variação ambiental** continua alta nesta máquina | rodar a auditoria com a máquina ociosa; resultados de todas as execuções publicados |

## 9. Commits

Branch `perf/cp9.2-mobile`, sobre `main` (`b2f0bbe`), sem publicação:

- `6ed77c2` CP9.2: suíte completa final (rodada 3): 478 passed, 0 failed, 9 skipped
- `a78cd16` CP9.2: busca após a 1ª busca limitada às consultas públicas de NFT
- `46a8299` CP9.2: logs da suíte completa (rodada 2) e da repetição do teste de expiração
- `8135a69` CP9.2: reconciliação não refaz sozinha consultas que terminaram em erro
- `b861fe6` CP9.2: lint do script de perfil (globais do navegador via globalThis)
- `484a122` CP9.2: refazer consultas da 1ª busca em tempo ocioso após a reconciliação
- `d32b15c` CP9.2: corrige corrida latente de tempo real (evento perdido antes da 1ª conexão)
- `abd66e2` CP9.2 H-X: ordenação do catálogo simulado sem colador ICU na abertura
- `8a809bc` CP9.2: comparação A/B intercalada (scripts/perf/ab.mjs)
- `95dbb3b` CP9.2 H-T: sonner sob demanda (src/lib/toast.ts) e correção de CLS no detalhe desktop
- `3f34719` CP9.2 H-K..H-S: menos bytes e menos trabalho na thread principal
- `efee3c8` CP9.2 H-E..H-J: Select/Slider só no desktop, zoom sob demanda, chunk da rota pré-carregado e seções secundárias em transição
- `892003e` CP9.2 H-D: consolidação dos chunks da inicialização (codeSplitting.groups)
- `380d61d` CP9.2 H-B: drawer de filtros sob demanda e variantes desktop só no desktop
- `da605c4` CP9.2 H-A: tldts (Public Suffix List) fora do chunk do MSW

(e o commit deste relatório)
