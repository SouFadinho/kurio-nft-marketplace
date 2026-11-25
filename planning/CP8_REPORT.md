# CP8 — Refinamento visual, acessibilidade e performance

Data: 25/11/2026 · Ambiente: Windows 11 (10.0.26300), Node 26.13.1, Chromium do Playwright 1.65.1 / HeadlessChrome 159, Lighthouse 13.6.0. Nada publicado; commit apenas local.

## 1. Resumo

| Tema | Resultado |
|---|---|
| VIS-01..16 | 11 feitas, 2 parciais (VIS-09, VIS-16), 3 limitações documentadas (VIS-03, VIS-04, VIS-06): §2 |
| Acessibilidade | axe WCAG 2.2 A/AA sem violações em 12 telas × desktop e mobile, + estrutura, reflow a 320 px, alvos de toque e notificações (`e2e/a11y.spec.ts`). 2 defeitos corrigidos. **Não** é declaração de conformidade WCAG: §4 |
| Lighthouse oficial (12 execuções) | A11y 100, BP 96, SEO 92: **metas atingidas** nos 4 perfis. Performance desktop 97 / 98: **atingida**. Performance mobile 54 (Início) e 64 (Detalhe): **não atingida** (meta 90): §5 |
| Performance (antes → depois, medido) | Detalhe desktop 78 → 98 (CLS 0,307 → 0); Início desktop 94 → 97; Início mobile 53 → 54 na rodada oficial (70 na repetição); Detalhe mobile 65 → 64 |
| Baselines visuais | 6 de 8 atualizadas após inspeção, com antes/depois/diff (§3.3) |
| Typecheck, lint, build, suíte completa | §6 |

## 2. Pendências visuais VIS-01..16

Prioridade do CP7 seguida (P1 → P2 → P3). Nenhum asset novo foi criado e nenhum rótulo acessível foi removido.

| ID | Status | O que mudou / por que não | Evidência |
|---|---|---|---|
| VIS-10 (P1) | FEITO | Pagamento desktop: "Perfil do colecionador" em 2 colunas (nome de exibição · nome de usuário somente leitura · rede · e-mail), carteiras lado a lado, "Usar outra carteira" em linha, observação por último. Validação, carteiras e conexão simulada inalteradas | `evidence/cp8/comparacao-pagamento-desktop.png` |
| VIS-07 (P1) | FEITO | Carteiras: a principal virou formulário persistente com os campos do Figma (sem "Cancelar"); a secundária segue como resumo + Editar/Tornar principal | `comparacao-carteiras-desktop.png` |
| VIS-12 + VIS-05 (P1) | FEITO, TESTADO | Barra fixa mobile com "Total" + valor ao lado do CTA (carrinho e pagamento). O fim da página fica acima da barra (detalhe, carrinho, pagamento). O teste novo achou um defeito real: no detalhe, o fim do rodapé ficava 28 px sob a barra de compra (mais alta que a navegação inferior); corrigido com reserva de altura no rodapé quando a barra existe | `a11y.spec › VIS-05`; `carrinho-390.png` |
| VIS-15 (P1) | FEITO, TESTADO | Toasts no topo central, abaixo do header (antes: canto inferior, sobre o CTA fixo) | `a11y.spec › notificação não cobre…` |
| VIS-01 (P2) | FEITO | Hero mobile ≈ 190 px (antes ≈ 235; Figma ≈ 180) | `comparacao-inicio-mobile.png` |
| VIS-11 + VIS-09 (P2) | FEITO / PARCIAL | Card do carrinho mobile com a altura da imagem (≈ 83 px; antes ≈ 128). Linha extra "Total + Remover" removida: lixeira no canto, total da linha só no desktop. O título "Resumo da carteira" foi **mantido** (estrutura de títulos da página) | `comparacao-carrinho-mobile.png` |
| VIS-08 (P2) | FEITO | Modal de login/cadastro no desktop ancorado a 144 px do topo, como no Figma | `comparacao-login-desktop.png` |
| VIS-14 (P2) | FEITO | Recibo: estado em painel com cor + ícone + texto (não só cor), total maior | `comparacao-recibo-desktop.png` (sem frame no Figma) |
| VIS-03 + VIS-06 (P2) | LIMITAÇÃO | Variedade das artes: não há assets oficiais novos e o enunciado proíbe inventá-los. Mantidas as artes do `ASSETS_MANIFEST.md` | — |
| VIS-02 (P3) | FEITO | Espaçamento vertical da Início desktop 56 → 40 px | `comparacao-inicio-desktop.png` |
| VIS-04 (P3) | LIMITAÇÃO | Galeria segue com 2 vistas reais; 4 miniaturas exigiriam recortes derivados apresentados como vistas novas | — |
| VIS-16 (P3) | PARCIAL | Ajustes pontuais (nome no card do carrinho, espaçamentos da Início, recibo). Sem revisão tipográfica global | — |
| VIS-13 | FEITO | axe e suíte completa após os ajustes (§4, §6) | — |

Revisados sem mudança: navegação do tablet (768), rodapé (só a área de toque dos links mobile, §4), indicadores do carrossel, cards do catálogo.

## 3. Inspeção visual

### 3.1 Capturas
`e2e/cp8.evidence.spec.ts` captura 15 telas/estados em 390, 768 e 1440 px: Início, Mercado, Detalhe, Login, Cadastro, Perfil, Carteiras, Favoritos, Carrinho, Pagamento, pedido pendente, recibo confirmado, pedido recusado e Meus pedidos (`planning/evidence/cp8/`). Inspecionadas: Pagamento 1440, Carrinho 390, Início 390 (hero), recibo 1440, Carteiras 1440, Login 1440. Overflow e reflow são verificados por teste (§4), não só por inspeção.

Observação: nas capturas de página inteira do mobile, a barra de navegação inferior (fixa) aparece no meio da imagem; é efeito da captura, não do layout.

### 3.2 Comparações Figma × antes × depois
`scripts/evidence/compare-cp8.mjs` (mesmo método dos CPs 3–5: frame do Figma ampliado pelo fator exato e as três colunas reduzidas pelo mesmo fator): `planning/evidence/cp8/comparacao-{inicio-desktop,inicio-mobile,carrinho-mobile,pagamento-desktop,carteiras-desktop,login-desktop,recibo-desktop}.png`.

### 3.3 Baselines visuais
Falharam após os ajustes e foram inspecionadas antes da atualização:

| Baseline | Mudança intencional |
|---|---|
| inicio desktop / mobile | VIS-02 / VIS-01 |
| carrinho mobile | VIS-11, VIS-09, VIS-12 |
| pagamento mobile | VIS-10 (campo "Nome de usuário"), VIS-12 |
| detalhe mobile | VIS-05: rodapé 48 px mais alto; os primeiros 2600 px são idênticos (comparação byte a byte) |
| pagamento desktop | VIS-10. **Esta passou sem atualização**: 6,1% dos pixels mudaram, mas só 0,99% passam do limiar de cor do comparador (tolerância 1%). Atualizada mesmo assim; risco R-47 |

Antes, depois e diffs: `planning/evidence/cp8-baselines/{antes,depois,diff}/`. Detalhe desktop e Carrinho desktop ficaram iguais. Baselines Linux continuam não geradas (nenhuma derivada das capturas Windows).

## 4. Auditoria de acessibilidade

`e2e/a11y.spec.ts` (desktop e mobile):

| Verificação | Escopo | Resultado |
|---|---|---|
| axe (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`) | Início, Mercado, Detalhe, Login, Cadastro, Perfil, Carteiras, Favoritos, Carrinho, Pagamento, pedido pendente, recibo, pedido recusado, Meus pedidos | 0 violações após correções |
| Estrutura | mesmas telas | 1 `h1` exposto, títulos sem saltos, todas as imagens com `alt`, controles com nome acessível |
| Reflow | 320 px (≈ 400% de zoom em 1280 px), 8 rotas | sem rolagem horizontal |
| Alvos de toque (WCAG 2.5.8) | 5 telas mobile; alvo efetivo inclui o `<label>`; exceção de espaçamento implementada | nenhum alvo < 24 px sem espaçamento |
| Notificações | toast × CTA fixo e total | sem sobreposição |

Defeitos encontrados e corrigidos:
1. `label-content-name-mismatch` (WCAG 2.5.3): "Tornar principal" tinha o nome "Tornar Reserva a carteira principal". Agora "Tornar principal a carteira Reserva" (contém o texto visível).
2. Login/cadastro no desktop sem `h1` (o título do modal era `h2`): o `DialogTitle` agora renderiza um `h1`.
3. Alvos de toque: links do rodapé mobile (18 px) passaram a 24 px; "Usar outra carteira" ganhou área de clique maior.
4. VIS-05: fim do rodapé do detalhe sob a barra de compra fixa (mobile).

Já cobertos por testes anteriores e mantidos: foco preso e devolvido em diálogos e drawer, ordem de foco e skip link, contraste de 19 pares de tokens, `aria-live` nos feedbacks, movimento reduzido (skeleton e animações), teclado no carrinho, pagamento e galeria.

Limitações: verificação automatizada + inspeção. Sem teste com leitor de tela real (NVDA/VoiceOver), sem zoom só de texto a 200% e sem avaliação manual completa dos critérios WCAG. **Não se declara conformidade WCAG.**

## 5. Performance e Lighthouse

### 5.1 Investigação (medida, não suposta)
Medição inicial não oficial (1 execução, `cp8-perf/antes/`): Início mobile 53 (TBT 2012 ms), Detalhe desktop 78 (CLS 0,307).

| Gargalo medido | Correção | Efeito medido |
|---|---|---|
| Seed do mock calculava PBKDF2 (100 mil iterações × 2 usuários) na partida | Hashes pré-calculados das senhas de teste (`seed-hashes.spec` confere) | parte da queda de TBT da Início mobile (2012 → 431 ms na medição intermediária) |
| App só era baixado depois do MSW iniciar | `import('./app/App')` disparado antes de `startMocks()`; a renderização continua esperando o MSW | idem (medição conjunta) |
| `socket.io-client` no caminho crítico | Import dinâmico dentro do `RealtimeProvider` (Socket.IO continua obrigatório e ativo) | idem |
| Troca de fonte mono deslocava o layout do Detalhe | `@font-face` de fallback com métricas ajustadas | CLS 0,307 → 0 |
| Chunks do MSW/App descobertos tarde | `modulepreload` (plugin no `vite.config.ts`) | sem diferença mensurável; mantido, sem ganho declarado |

Não feito, por regra: desligar MSW, Socket.IO ou qualquer funcionalidade, ou build especial para a auditoria. O LCP mobile (≈ 4,7–4,9 s) é a arte do NFT, que depende da cadeia entry → MSW (498 kB / 180 kB gzip) → registro do Service Worker → App → API simulada, sob 4G simulado e CPU 4×.

### 5.2 Auditoria oficial — `npm run audit:lighthouse` (25/11 08:40–08:42, sequencial, nenhum outro processo de teste)

| Página | Perfil | Execução | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|---|
| Início | mobile | 1 | 54 | 100 | 96 | 92 | 5079 | 0,000 | 1621 |
| Início | mobile | 2 | 54 | 100 | 96 | 92 | 4918 | 0,000 | 1680 |
| Início | mobile | 3 | 56 | 100 | 96 | 92 | 4874 | 0,000 | 1471 |
| Início | desktop | 1 | 98 | 100 | 96 | 92 | 1170 | 0,010 | 13 |
| Início | desktop | 2 | 97 | 100 | 96 | 92 | 1247 | 0,010 | 22 |
| Início | desktop | 3 | 97 | 100 | 96 | 92 | 1258 | 0,010 | 23 |
| Detalhe | mobile | 1 | 63 | 100 | 96 | 92 | 4712 | 0,000 | 679 |
| Detalhe | mobile | 2 | 64 | 100 | 96 | 92 | 4741 | 0,000 | 656 |
| Detalhe | mobile | 3 | 64 | 100 | 96 | 92 | 4591 | 0,000 | 676 |
| Detalhe | desktop | 1 | 98 | 100 | 96 | 92 | 1073 | 0,000 | 40 |
| Detalhe | desktop | 2 | 98 | 100 | 96 | 92 | 1088 | 0,000 | 56 |
| Detalhe | desktop | 3 | 98 | 100 | 96 | 92 | 1087 | 0,000 | 45 |

**Medianas oficiais**

| Página | Perfil | Perf (≥ 90) | A11y (≥ 95) | BP (≥ 95) | SEO (≥ 90) | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | **54 — não atingida** | 100 ✓ | 96 ✓ | 92 ✓ | 4918 | 0,000 | 1621 |
| Início | desktop | 97 ✓ | 100 ✓ | 96 ✓ | 92 ✓ | 1247 | 0,010 | 22 |
| Detalhe | mobile | **64 — não atingida** | 100 ✓ | 96 ✓ | 92 ✓ | 4712 | 0,000 | 676 |
| Detalhe | desktop | 98 ✓ | 100 ✓ | 96 ✓ | 92 ✓ | 1087 | 0,000 | 45 |

Código auditado: o estado do CP8 antes da correção de VIS-05 (só o padding inferior do rodapé no mobile mudou depois; não remedido).

Relatórios HTML e JSON originais: `planning/evidence/cp8-perf/oficial/` (24 arquivos + `summary.*` + `execucao.log`), também em `lighthouse/`.

### 5.3 Variação observada (nada descartado)
Na rodada oficial, as 3 execuções da Início mobile tiveram uma tarefa longa não atribuída de ≈ 1,2 s (TBT 1471–1680 ms). Com o mesmo código, uma execução de diagnóstico (`cp8-perf/diagnostico-1-execucao/`) e uma repetição completa de 12 execuções (`cp8-perf/repeticao/`, 25/11 depois da oficial) mediram:

| Página | Perfil | Oficial | Repetição (mediana; execuções) |
|---|---|---|---|
| Início | mobile | 54 | 70 (70, 71, 70; TBT 437–485 ms) |
| Início | desktop | 97 | 97 (97, 97, 98) |
| Detalhe | mobile | 64 | 64 (62, 64, 65) |
| Detalhe | desktop | 98 | 98 (98, 98, 98) |

A causa da diferença **não foi identificada** (a medição "antes" também tinha uma tarefa não atribuída longa). O resultado oficial continua sendo o da primeira rodada. Em qualquer das rodadas, a meta de Performance mobile **não** é atingida (R-25, R-48).

### 5.4 Antes × depois (Performance)

| Página | Perfil | Antes (1 exec.) | Intermediário (1 exec.) | Oficial (mediana de 3) | Repetição (mediana de 3) |
|---|---|---|---|---|---|
| Início | mobile | 53 | 71 | 54 | 70 |
| Início | desktop | 94 | 97 | 97 | 97 |
| Detalhe | mobile | 65 | 64 | 64 | 64 |
| Detalhe | desktop | 78 | 97 | 98 | 98 |

## 6. Testes e verificações

| Verificação | Resultado | Registro |
|---|---|---|
| typecheck · lint · build | exit 0 · exit 0 · exit 0 | `planning/evidence/cp8-tests/typecheck-lint-build.log` |
| Suíte completa — rodada 1 (4 workers) | 482 testes: **472 passed, 1 failed, 9 skipped** (11,8 min). A falha foi o teste novo VIS-05 apontando um defeito real (rodapé do detalhe sob a barra de compra) | `full-run-1.log` |
| Correção + verificação dirigida | a11y, nft-detail e visual (desktop + mobile): 38 passed, 3 skipped, 1 failed = baseline do detalhe mobile (mudança esperada, inspecionada, atualizada) | `pos-vis05-1.log` |
| Suíte completa — rodada 2, código final (4 workers) | 482 testes: **473 passed, 0 failed, 9 skipped** (12,2 min) | `full-run-2.log` |

Os 9 ignorados são por dispositivo: os 6 do CP7 e as 3 verificações novas só de mobile (alvos de toque, VIS-05, notificação), ignoradas no projeto desktop. Nenhum teste existente foi desativado; timeouts não foram alterados; `retries: 0`.

Testes ajustados por mudança intencional de UI (sem reduzir cobertura): `account`, `isolation`, `auth` e `layout.responsive` leem a carteira principal pelos valores do formulário (VIS-07); `account` usa o novo nome "Tornar principal a carteira Reserva"; o axe de carteiras foi restrito ao formulário "Nova carteira" (havia dois campos "Rede"). `tabs`: o teste offline espera a conexão anônima da outra aba antes de desligar a rede (precondição necessária com o Socket.IO sob demanda).

Testes novos: `e2e/a11y.spec.ts` (7 casos × 2 projetos), `e2e/unit/seed-hashes.spec.ts`, `e2e/cp8.evidence.spec.ts` (captura, projeto `evidence`).

## 7. Riscos e matriz
- `REQUIREMENTS_MATRIX.md`: VIS-01..16 com status individual; A11Y-03 e A11Y-07; TEST-02; LH-01..06.
- `RISK_REGISTER.md`: R-25 atualizado (medido, não resolvido); novos R-47 (sensibilidade da baseline visual), R-48 (variação entre rodadas do Lighthouse), R-49 (hashes pré-calculados do seed).

## 8. Metas e limitações
- **Atingidas (medido):** A11y, BP e SEO nos 4 perfis; Performance desktop; CLS ≤ 0,01 em todos os perfis; axe sem violações nas 12 telas.
- **Não atingidas (medido):** Performance mobile (Início 54, Detalhe 64; meta 90). LCP mobile ≈ 4,7–4,9 s.
- **Limitações:** VIS-03/04/06 dependem de assets oficiais inexistentes; VIS-09/16 parciais; sem leitor de tela real nem conformidade WCAG declarada; Lighthouse local em Windows (não em CI, sem throttling de rede real); baselines Linux não geradas; baseline visual pouco sensível em telas escuras (R-47).

## 9. Commit
Commit local `740289a` (CP8: refinamento visual, acessibilidade e performance) + commit com este hash no relatório. Nada publicado; sem repositório remoto.
