# CP9 — Auditoria final, otimização complementar e preparação da entrega

Data: 25/11/2026 · Ambiente: Windows 11 (10.0.26300), Node 26.13.1, npm do Node, Chromium do Playwright 1.65.1, Lighthouse 13.6.0. Prazo oficial: 26/11/2026 12h55 (BRT).
**Nada foi publicado:** sem repositório remoto, sem deploy e sem envio da candidatura. A etapa de publicação aguarda autorização.

## 1. Resumo

| Tema | Resultado |
|---|---|
| Otimização mobile (≤ 90 min) | 2 hipóteses medidas e **revertidas/descartadas** (sem ganho). Nenhuma mudança de performance mantida no CP9 |
| Lighthouse oficial final (12 execuções, `a5aff5b`) | A11y 100 · BP 96 · SEO 92 em todos os perfis; Performance desktop 97 / 98; **Performance mobile 55 (Início) e 64 (Detalhe): meta não atingida** |
| Checkout limpo (`a5aff5b`) | `npm ci`, typecheck, lint, build, verificação do build público: OK · suíte completa: **473 passed, 0 failed, 9 skipped** |
| Auditoria de dependências | `npm audit`: 0 vulnerabilidades (produção e completo); produção 100% com licenças permissivas |
| Limpeza | `/demo/*` fora do build público; componente morto removido; referências do Figma organizadas; sem TODO/FIXME, segredos ou caminhos absolutos |
| Documentação | `README.md`, `ARCHITECTURE.md`, `planning/TECHNICAL_HANDOFF.md`; matriz, riscos e auditoria eliminatória revisados |
| Deploy | `vercel.json` e CI preparados; **não executados** |

## 2. Checklist do desafio (CHALLENGE.md)

Legenda: ✅ atendido com evidência · ⚠ atendido com limitação documentada · ❌ não atingido · ⏸ aguarda autorização.

| § | Requisito | Status | Evidência |
|---|---|---|---|
| 1 | Descoberta, compra e conta; desktop e mobile; dados simulados | ✅ | suíte completa; `cp9/telas-obrigatorias-*.png` |
| 2 | Stack obrigatória com uso efetivo | ✅ | `ELIMINATORY_AUDIT.md` (reverificação CP9), matriz §1 |
| 3 | 9 telas com as funcionalidades obrigatórias | ✅ | matriz §4 (TELA-01..09) |
| 3 | Frames do Figma desktop e mobile | ⚠ | comparações CP3–CP8; galeria com 2 vistas, artes substitutas (VIS-03/04/06) |
| 3 | Ações fora do escopo sem aparentar sucesso | ✅ | design-system.spec, página "fora desta demonstração" |
| 3 | Catálogo na URL, filtros, paginação, respostas fora de ordem | ✅ | catalog.spec |
| 3 | Detalhe: acesso direto, inexistente, edição indisponível, limite | ✅ | nft-detail.spec |
| 3 | Carrinho: estoque, refresh, merge, cupom, valores da API, tempo real, precisão | ✅ | cart.spec, unit › eth |
| 3 | Pagamento: validação, carteiras, revalidação, duplicidade, estados, snapshot | ✅ | checkout, orders, recovery, races |
| 3 | Conta e sessão: auth, guarda, refresh, expiração, troca de usuário, senha não em claro | ✅ | auth, account, isolation (ACC-08 reforçado no CP9) |
| 4 | Router, Query, Axios; estados; invalidação; obsoletas; isolamento; otimista; política documentada | ✅ | matriz §5; `ARCHITECTURE.md` §6 |
| 5 | Contratos REST, erros e idempotência | ✅ | `API_CONTRACTS.md`; API-01..03 |
| 6 | MSW na rede, estado consistente, reset, condições de rede, 2 usuários, cenários | ✅ | 29 cenários; MOCK-* |
| 6 | Socket.IO via MSW compatível com o protocolo, transporte documentado | ✅ | `ARCHITECTURE.md` §5; CP1_REPORT §5 |
| 7 | `nft.updated`, `order.updated`, duplicatas/antigos, reconexão, isolamento, cenários exigidos | ✅ | races, recovery, checkout, tabs |
| 8 | Fidelidade visual e responsividade (390/768/1440) | ⚠ | `layout.responsive`, capturas; limitações VIS |
| 8 | Skeletons com shimmer, sem CLS, movimento reduzido | ✅ | UI-03; CLS ≤ 0,01 no Lighthouse |
| 8 | Acessibilidade obrigatória | ✅ (automatizado) | `a11y.spec`; sem leitor de tela, sem declaração WCAG |
| 9 | 12 grupos E2E, Chromium desktop e mobile, regressão visual versionada, estado isolado, tempo controlado, HTML + traces | ✅ / ⚠ | suíte completa; baselines Windows versionadas, Linux não geradas |
| 10 | Lighthouse: 3 medições × 2 páginas × 2 perfis, mediana, relatórios, ambiente, LCP/CLS/TBT, justificativa | ✅ (processo) | `cp9-perf/oficial/` |
| 10 | Performance ≥ 90 | ❌ mobile · ✅ desktop | §4 |
| 10 | Accessibility ≥ 95 · Best Practices ≥ 95 · SEO ≥ 90 | ✅ | §4 |
| 12 | Código, lockfile, assets, mocks, fixtures, testes, configuração de auditoria | ✅ | repositório |
| 12 | README (setup, variáveis, credenciais, cenários, reset, comandos, falhas) | ✅ | `README.md` |
| 12 | ARCHITECTURE (contratos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios) | ✅ | `ARCHITECTURE.md` |
| 12 | Scripts de dev, build, preview, typecheck, lint, testes, Lighthouse | ✅ | `package.json` |
| 12 | Checkout limpo sem serviços privados | ✅ | §5 |
| 12 | Deploy público com mocks e tempo real; refresh e deep links; link do repositório | ⏸ | preparado (§8); aguarda autorização |
| Elim. | 6 critérios eliminatórios | ✅ | `ELIMINATORY_AUDIT.md` |

## 3. Otimização mobile (CP9)

Prazo de 90 min respeitado. Detalhes e medições: `planning/evidence/cp9-perf/LEIA-ME.md`.

**Decomposição do LCP (Início mobile, observado):** TTFB 14 ms, atraso de carga 463 ms, carga 65 ms, atraso de renderização 743 ms. LCP observado 1,28 s; simulado (4G lento + CPU 4×) ≈ 4,9 s. O elemento é a imagem do card ou da arte principal, descoberta só depois da resposta da API simulada.

| Hipótese | Resultado medido | Decisão |
|---|---|---|
| Renderizar o App antes do MSW (Axios e Socket.IO aguardando a interceptação) | Início mobile 60 e 54 (TBT 884 e 1462 ms) contra 70 na base | revertida: a montagem do React disputa a thread principal com a avaliação do MSW |
| Imagens menores (experimento: `dist/` com imagens a 320 px, −56% de bytes) | LCP 4948 ms contra 4961 ms | descartada: o peso da imagem não está no caminho crítico; `srcset/sizes` não traria ganho mensurável |

Outras hipóteses do roteiro, avaliadas por medição ou leitura do bundle:
- **Code splitting:** as rotas já são separadas (`autoCodeSplitting`) e os chunks iniciais já recebem `modulepreload` (CP8).
- **Handlers e fixtures sob demanda:** o código da simulação é ≈ 150 kB de fonte; o restante do chunk do MSW (498 kB, 180 kB gzip) é a biblioteca, que é obrigatória.
- **Latência artificial:** 120 ms no cenário padrão, realista e pequena perto do LCP.
- **Tarefas longas:** concentradas na avaliação de `index` e do MSW.

**Melhorias de performance efetivamente medidas (todas do CP8):**

| Mudança | Efeito |
|---|---|
| Fallback métrico da fonte | CLS do Detalhe desktop 0,307 → 0 (Performance 78 → 98) |
| Hashes do seed pré-calculados, App baixado em paralelo ao MSW, Socket.IO sob demanda | TBT da Início mobile 2012 → ≈ 431–485 ms nas medições intermediária e de repetição |
| Início desktop | 94 → 97 |

No mobile, a mediana oficial final (55) não reflete esse ganho de TBT por causa da variação entre rodadas (§4, R-48).

## 4. Lighthouse oficial final

`npm run audit:lighthouse`, 25/11/2026, commit `a5aff5b`, sequencial, sem outros processos de teste. Relatórios HTML e JSON: `planning/evidence/cp9-perf/oficial/`.

| Página | Perfil | Perf (3 execuções) | **Mediana** | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|---|
| Início | mobile | 53 · 59 · 55 | **55 ❌** | 100 | 96 | 92 | 4930 | 0,000 | 1492 |
| Início | desktop | 96 · 97 · 97 | **97** | 100 | 96 | 92 | 1266 | 0,010 | 18 |
| Detalhe | mobile | 64 · 64 · 64 | **64 ❌** | 100 | 96 | 92 | 4736 | 0,000 | 649 |
| Detalhe | desktop | 98 · 98 · 98 | **98** | 100 | 96 | 92 | 1076 | 0,000 | 40 |

Histórico preservado:
- `cp8-perf/`: antes, intermediário, oficial do CP8, diagnóstico e repetição;
- `cp9-perf/`: hipóteses e oficial do CP9.

A Início mobile oscila entre 53 e 71 entre rodadas com código equivalente. Na rodada oficial do CP9, o TBT ficou em 1073–1965 ms, contra 437–485 ms na repetição do CP8. A causa não foi identificada (R-48). Nenhum resultado foi descartado.

## 5. Validação final local

| Verificação | Resultado | Registro |
|---|---|---|
| Instalação limpa (`git clone` + `npm ci`) | OK | `cp9-tests/checkout-limpo-preparacao.log` |
| Typecheck · lint · build | exit 0 · 0 · 0 | idem |
| Build público (`check:public-build`) | `/demo`, `/demo/poc`, `/demo/componentes` → 404 do app; 5 deep links → 200; nenhum chunk `demo.*` requisitado | idem |
| Suíte completa no checkout limpo (4 workers, `retries: 0`) | **473 passed, 0 failed, 9 skipped** (11,5 min), 482 testes | `cp9-tests/checkout-limpo-suite.log` |
| `npm audit` | 0 vulnerabilidades (produção e completo) | `cp9-tests/npm-audit-*.txt` |
| Licenças | produção: 119 pacotes (MIT 115, Apache-2.0, ISC, Unlicense, OFL-1.1 da fonte). Desenvolvimento: itens a revisar são só ferramentas (WASM opcional do Tailwind não instalado, `sentry` FSL via Lighthouse, libvips LGPL no `sharp` dos scripts); nada disso vai para o build | `cp9-tests/licencas.txt` |
| Critérios eliminatórios | 6/6 mantidos | `ELIMINATORY_AUDIT.md` |
| Inspeção das 9 telas (código final) | 390, 768 e 1440 px, sem defeito encontrado | `cp9/telas/`, `cp9/telas-obrigatorias-{1440,390}.png` |

Observações honestas:
- As duas primeiras tentativas de iniciar a suíte no checkout limpo **não executaram testes**, por erro do script: `cd` e `PATH` do ambiente local. Estão registradas no log. A terceira executou a suíte inteira.
- **Contagem de testes:** 482, igual ao CP8. As rotas `/demo/*` continuam no build dos testes, então a PoC (CP1) e a galeria (CP2) mantêm a cobertura. A verificação de senha em claro (ACC-08) entrou num teste existente.
- **Após o checkout limpo** mudaram só documentação e ferramentas de evidência: `cp8.evidence.spec.ts` ganhou a variável `EVIDENCE_OUT`, e o script `contact-sheet.mjs` é novo. Nenhum código da aplicação mudou.

## 6. Requisitos não atingidos e limitações restantes

**Não atingido:** Performance mobile ≥ 90 (Início 55, Detalhe 64). Atingir a meta exigiria mudança estrutural (pré-renderização ou API fora do navegador), vetada nesta etapa.

**Limitações:**
1. **Simulação no navegador:** banco por navegador; líder entre abas da mesma origem; segurança só ilustrativa. Sessão por aba em `sessionStorage`.
2. **Figma:** artes substitutas (sem exportação no modo de visualização); galeria com 2 vistas; VIS-09 e VIS-16 parciais.
3. **Acessibilidade:** só auditoria automatizada; sem leitor de tela; sem declaração WCAG.
4. **Regressão visual:**
   - baselines só de Windows; as de Linux dependem do job manual da CI;
   - a tolerância de 1% deixa passar mudanças em telas escuras (R-47).
5. **CI** preparada e não executada; o YAML foi revisado manualmente (sem parser local).
6. **HTTPS/WSS:** o Socket.IO simulado deriva `wss://` da origem, mas só é verificável na URL pública (item do smoke test).
7. **Identidade Git:** os commits locais trazem nome e e-mail do autor (configuração do Git). Ao publicar, eles ficam visíveis no repositório. Ajuste antes de publicar se não quiser expor o e-mail.

## 7. Tamanho do repositório

Medido no commit final do CP9:
- arquivos versionados: ≈ 131 MB no commit `a5aff5b`, dos quais ≈ 122 MB são evidências em `planning/evidence/` e ≈ 9 MB são o projeto;
- Lighthouse de CP8 e CP9: ≈ 70 MB versionados até `a5aff5b`, mais ≈ 27 MB do `cp9-perf/` neste commit;
- `.git` local: ≈ 87 MB antes deste commit.

Nenhum arquivo passa de 100 MB (limite do GitHub). Para reduzir o tamanho: remover do HEAD as rodadas não oficiais em `planning/evidence/cp8-perf/{antes,intermediario,diagnostico-1-execucao}`, que não são o resultado oficial. **Não foi feito**, para preservar as evidências originais, e o histórico manteria o tamanho de qualquer forma.

## 8. Instruções exatas para publicação (aguardando autorização)

1. **(Opcional) Identidade dos commits:** revisar `git log --format='%an <%ae>'`.
2. **Repositório remoto (GitHub):**
   ```powershell
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   ```
   ```powershell
   git push -u origin main
   ```
3. **CI:** o push dispara `.github/workflows/ci.yml` (job `quality`). Só declarar aprovado depois de ver a execução verde.
4. **Baselines Linux:**
   1. em Actions, rodar o workflow "CI" manualmente (`workflow_dispatch`): o job `visual-baselines-linux` gera as imagens no container `mcr.microsoft.com/playwright:v1.65.1-noble`;
   2. baixar o artefato `visual-baselines-linux` e inspecionar as 8 imagens;
   3. copiá-las para `e2e/visual.spec.ts-snapshots/` e fazer commit. A partir daí, a regressão visual passa a comparar também na CI.
5. **Vercel:**
   1. "Add New Project", importar o repositório;
   2. framework Vite (detectado); `vercel.json` define `npm ci`, `npm run build`, `dist/`, os rewrites de SPA (exceto `/api/*`) e os headers do `mockServiceWorker.js`;
   3. nenhuma variável de ambiente: `VITE_ENABLE_MOCKS=true` vem do `.env` versionado; `VITE_DEMO_ROUTES` não é definida, então `/demo/*` fica em 404.
6. **Smoke tests na URL pública:**
   1. no PowerShell, `$env:BASE_URL="https://<url>"; node scripts/check-public-build.mjs`: `/demo/*` em 404, deep links em 200;
   2. no navegador:
      - refresh em `/nft/nft-001` e `/pedidos`;
      - Service Worker registrado (DevTools → Application);
      - login com `ana@kurio.test`;
      - compra completa até o recibo;
      - `__kurioMock.updateNft('nft-001', { price: '1.25' })` com o carrinho aberto (evento por `wss://`);
      - cenário `order-timeout` (mesmo pedido após reenvio);
   3. opcional: Lighthouse na URL pública, como informação complementar (o resultado oficial é o local, versionado).
7. Atualizar a URL pública no `README.md`, fazer commit e push. Só então enviar a candidatura (repositório + URL).

## 9. Commit local final

Commit local `ad6320c` (CP9: validação final, Lighthouse oficial e relatórios de entrega), sobre `a5aff5b` (código validado em checkout limpo), + commit com este hash no relatório. Nada publicado; sem repositório remoto.
