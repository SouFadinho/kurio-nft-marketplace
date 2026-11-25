# Mapa de commits (reescrita de autoria, CP9.1)

Em 25/11/2026, antes da publicação, a autoria dos 39 commits foi trocada do e-mail pessoal para o endereço noreply do GitHub (`git filter-branch --env-filter`). Conteúdo, mensagens e datas são os mesmos; os identificadores mudaram.

Relatórios e logs de evidência anteriores citam os identificadores ANTIGOS (registros históricos, não editados). Esta tabela faz a correspondência. Os documentos vivos (README, ARCHITECTURE, matriz, CP9_1_REPORT) usam os novos.

| Antigo | Novo | Mensagem |
|---|---|---|
| `91380dc` | `701ac64` | CP1: fundação técnica e prova de conceito da integração |
| `f24edd2` | `c073019` | CP1: corrige vazamento do preview no script Lighthouse e valida checkout limpo |
| `6ad49e0` | `a8a55ab` | CP2: design system, assets e estrutura visual |
| `6e31b31` | `11fef80` | CP2: registra validação do checkout limpo do 6ad49e0 (126/126) |
| `b0aeaa6` | `9a5a4a6` | CP3 (em andamento): catálogo, início e detalhe do NFT |
| `ce20494` | `34280dc` | CP3: catálogo, início e detalhes do NFT |
| `2b2aa83` | `b01eec2` | CP3: tempo-limite de 90 s nos testes de navegação responsive; ESLint ignora .cache |
| `d8069e4` | `a7fc23a` | CP3: registra validação do checkout limpo do 2b2aa83 (199 passed / 2 skipped) |
| `ea6f60b` | `33a3eec` | CP4: autenticação, perfil e carteiras |
| `79df5c8` | `deb4e95` | CP4: resultado do checkout limpo no relatório e na matriz |
| `18291bf` | `5a28bfc` | CP5: carrinho e checkout |
| `496ac52` | `4fd564a` | CP5: resultado do checkout limpo no relatório e na matriz |
| `070415e` | `0342c3c` | CP6: pedidos, recibo, recuperação, reserva e várias abas |
| `b200ae6` | `f087799` | CP6: hash do commit no relatório |
| `2860c10` | `138db36` | CP7: consolidação de testes, cobertura e CI |
| `cd8fb6e` | `a7a86d5` | CP7: hash do commit no relatório |
| `740289a` | `00a79b7` | CP8: refinamento visual, acessibilidade e performance |
| `bb3f359` | `15c9c03` | CP8: hash do commit no relatório |
| `a5aff5b` | `2472200` | CP9: limpeza da entrega, documentação e preparação do deploy |
| `ad6320c` | `23111d2` | CP9: validação final, Lighthouse oficial e relatórios de entrega |
| `b2f0bbe` | `f1d23c1` | CP9: hash do commit no relatório |
| `da605c4` | `6c5ef87` | CP9.2 H-A: tldts (Public Suffix List) fora do chunk do MSW |
| `380d61d` | `baf155d` | CP9.2 H-B: drawer de filtros sob demanda e variantes desktop só no desktop |
| `892003e` | `06bf215` | CP9.2 H-D: consolidação dos chunks da inicialização (codeSplitting.groups) |
| `efee3c8` | `b3f7640` | CP9.2 H-E..H-J: Select/Slider só no desktop, zoom sob demanda, chunk da rota pré-carregado e seções secundárias em transição |
| `3f34719` | `13105ce` | CP9.2 H-K..H-S: menos bytes e menos trabalho na thread principal |
| `95dbb3b` | `5fcb590` | CP9.2 H-T: sonner sob demanda (src/lib/toast.ts) e correção de CLS no detalhe desktop |
| `8a809bc` | `31dfcad` | CP9.2: comparação A/B intercalada (scripts/perf/ab.mjs) |
| `abd66e2` | `d5cf8ae` | CP9.2 H-X: ordenação do catálogo simulado sem colador ICU na abertura |
| `d32b15c` | `6ece5e1` | CP9.2: corrige corrida latente de tempo real (evento perdido antes da 1ª conexão) |
| `484a122` | `338f566` | CP9.2: refazer consultas da 1ª busca em tempo ocioso após a reconciliação |
| `b861fe6` | `cf0e261` | CP9.2: lint do script de perfil (globais do navegador via globalThis) |
| `8135a69` | `b1e0e40` | CP9.2: reconciliação não refaz sozinha consultas que terminaram em erro |
| `46a8299` | `93b90f6` | CP9.2: logs da suíte completa (rodada 2) e da repetição do teste de expiração |
| `a78cd16` | `ea82b9a` | CP9.2: busca após a 1ª busca limitada às consultas públicas de NFT |
| `6ed77c2` | `d733a06` | CP9.2: suíte completa final (rodada 3): 478 passed, 0 failed, 9 skipped |
| `d777396` | `377dd30` | CP9.2: relatório, Lighthouse oficial e repetição, logs A/B |
| `eb95154` | `5fe1216` | CP9.1: auditoria da substituição de cookies do MSW (reversão parcial) |
| `dd2ebed` | `74aff52` | CP9.1: evidência da investigação do contraste no recibo (a11y sob carga) |
