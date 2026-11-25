# CP9 — investigação de performance mobile (medições não oficiais, 1 execução cada)

Base: repetição do CP8 (`cp8-perf/repeticao`): Início mobile 70 (LCP 4961, TBT 456), Detalhe mobile 64 (LCP 4723, TBT 736).

Decomposição do LCP (Início mobile, execução observada sem throttling): TTFB 14 ms · atraso de carga do recurso 463 ms · duração da carga 65 ms · atraso de renderização 743 ms. LCP observado 1284 ms; LCP simulado (4G lento + CPU 4×) 4961 ms. Elemento LCP: imagem do card (Início) / imagem principal (Detalhe), ambas com `fetchpriority=high` e `loading=eager`, descobertas só após a resposta da API simulada.

| Hipótese | Mudança | Início mobile | Detalhe mobile | Decisão |
|---|---|---|---|---|
| H1 shell antecipado | App renderiza sem esperar o MSW; Axios e socket.io-client aguardam `mocksReady` | 60 (LCP 5301, TBT 884); 2ª execução 54 (LCP 5435, TBT 1462) | 64; 64 | REVERTIDA: montagem do React passa a disputar a thread principal com a avaliação do MSW (TBT maior) |
| H2 peso das imagens | experimento: imagens do `dist/` reduzidas a 320 px (1,21 MB → 0,53 MB) | 70 (LCP 4948, TBT 472) | 66 (LCP 4727) | DESCARTADA: LCP inalterado; srcset/sizes não traria ganho mensurável. Experimento só no `dist/` local, nada entregue |

Pastas: `h1-shell-antecipado/`, `h1-shell-antecipado-2/`, `h2-experimento-imagens-320/`.

Cadeia crítica observada: documento → `index` (68 kB) + modulepreload de App/rotas + `browser` (MSW, 175 kB transferidos) em paralelo → avaliação (CPU) → chunks da rota (`HomeContent`, `NFTCard`…) → API simulada (latência padrão de 120 ms, realista) → imagem. O código da simulação é ≈ 150 kB de fonte; o restante do chunk do MSW é a biblioteca, que é obrigatória.

Conclusão: a meta de 90 no mobile exigiria mudança estrutural (pré-renderização ou API fora do navegador), vetada nesta etapa. Nenhuma alteração de performance foi mantida no CP9.

Armazenamento: nas três pastas de hipóteses ficaram só os JSON (o HTML do Lighthouse embute o mesmo JSON; ele pode ser reaberto em https://googlechrome.github.io/lighthouse/viewer/). A rodada oficial do CP9 (`oficial/`) mantém HTML e JSON completos.

## Rodada oficial do CP9 (código final, `a5aff5b`)

`npm run audit:lighthouse`, 25/11/2026, sequencial, sem outros processos de teste. Pasta `oficial/` (24 relatórios + `summary.*` + `execucao.log`).

| Página | Perfil | Execuções (Perf) | Mediana Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|---|
| Início | mobile | 53 · 59 · 55 | **55** | 100 | 96 | 92 | 4930 | 0,000 | 1492 |
| Início | desktop | 96 · 97 · 97 | 97 | 100 | 96 | 92 | 1266 | 0,010 | 18 |
| Detalhe | mobile | 64 · 64 · 64 | **64** | 100 | 96 | 92 | 4736 | 0,000 | 649 |
| Detalhe | desktop | 98 · 98 · 98 | 98 | 100 | 96 | 92 | 1076 | 0,000 | 40 |

TBT da Início mobile nas 3 execuções: 1965, 1073 e 1492 ms. Novamente acima da repetição do CP8 (437–485 ms) com código equivalente: variação entre rodadas de causa não identificada (R-48).
