# CP3 — Catálogo e detalhes do NFT · Relatório

Data: 2026-11-24. Resultados de execuções reais. Logs em `planning/evidence/cp3-tests/`; capturas e comparações em `planning/evidence/cp3/`.

## 1. Resumo
- **Início, Mercado e Detalhe do NFT** implementados com dados reais da API simulada (Axios → MSW), estado na URL (TanStack Router), cache (TanStack Query) e tempo real (socket.io-client).
- **Favoritos** persistidos por usuário, com atualização otimista e rollback (página `/favoritos` incluída).
- **Catálogo determinístico de 36 NFTs**, cada um com arte própria. Os 9 primeiros reproduzem a primeira página do Figma (ordem e preços).
- **Comparações com o Figma na mesma escala**, que levaram a ajustes reais de layout.
- **Três defeitos de concorrência encontrados e corrigidos**, cada um com teste determinístico (§5).
- **Testes:** 199 aprovados · 0 reprovados · 2 ignorados (justificados), em **3 rodadas completas seguidas**.

## 2. Ajustes pedidos na revisão do CP2
| Pedido | Feito |
|---|---|
| Não reutilizar a mesma arte em NFTs diferentes | 36 artes únicas por variação do traço "Fundo" + espelhamento (`scripts/assets/build-variants.mjs`); personagens preservados |
| Melhorar artes escuras | Ajuste de tom no Ivory Baron e no Violet Nomad (o Ivory continua escuro por natureza) |
| Preservar Emerald Ape e Sage Nomad | Usados sem alteração ("original") |
| Conferir proporções na mesma escala | `scripts/evidence/compare-cp3.mjs` amplia o Figma pelo fator exato do frame (×3,87 / ×4,19 / ×1,19) |
| Cupom com texto cortado | Fonte do campo reduzida para 12 px (o layout final do carrinho é do CP5) |
| Navegação de conta em tablets sem cortes | Itens passam a quebrar linha em vez de rolar |
| Preservar rodapé, paleta e tipografia | Mantidos |
| Remover avisos de demonstração das telas públicas | Início, Mercado, Detalhe e Favoritos não têm avisos nem elementos de demonstração. Os placeholders que restam são das telas dos próximos CPs (carrinho, perfil) |

## 3. Funcionalidades
**Início (`/`)**
- Hero com destaques da API: desktop com a arte à direita; mobile em card com degradê e segunda arte sobreposta; indicadores sem rotação automática.
- Barra lateral com Coleções, Faixa de preço e Rede, com contagens da API (facetas calculadas com os demais filtros), e o card "NFT em destaque / Oferta limitada".
- Abas, ordenação, busca, grade 3×3 (masonry no mobile), paginação, banners e "Diário da Cunhagem".

**Catálogo (Início e Mercado)**
- Busca com debounce de 300 ms (a URL usa `replace`, sem uma entrada de histórico por tecla).
- Filtros combináveis; chips de filtros ativos com remoção individual e "Limpar filtros".
- Qualquer mudança de filtro volta para a página 1.
- URL validada: valores inválidos são descartados; página além do fim vai para a última; links equivalentes são idênticos.
- Refresh, voltar/avançar e links compartilháveis restauram o estado inteiro.
- Drawer de filtros e ordenação no mobile (foco preso, Esc fecha).

**Detalhe (`/nft/$nftId`)**
- Loader com acesso direto e refresh; 404 com caminho de volta; erro com "Tentar novamente".
- Galeria com miniaturas e zoom em diálogo; nome, preço, estrelas, descrição.
- Edições como grupo de rádio (esgotada desabilitada e anunciada); a edição escolhida fica na URL (`?edicao=`).
- Quantidade limitada ao estoque da edição, inclusive quando o estoque cai em tempo real.
- Favoritar; compartilhar (copiar link funciona; redes sociais informam indisponibilidade); abas "Detalhes" e "Avaliações"; "Mais desta coleção".
- Mobile: botões acima da imagem e barra de compra fixa, como no Figma.
- Preço e estoque atualizam via `nft.updated` e são anunciados numa região `aria-live`.

**Comprar e carrinho:** contrato definido (`features/cart/actions.ts`). Até o CP5, as ações **informam que a compra não está disponível**, sem simular sucesso.

**Estados:** skeletons com as mesmas dimensões, atualização em segundo plano (grade anterior visível e marcada `aria-busy`), vazio, erro HTTP e de conexão com mensagem específica, retry, NFT indisponível, edição esgotada e imagem quebrada (fallback no mesmo espaço).

## 4. Mock (MSW)
- Contratos novos: `Nft` (categoria, raridade, preço anterior, avaliação), `NftDetail` (edições, galeria, avaliações, contrato), `NftList` (paginação, facetas, faixa de preço), `Highlights`, `FavoriteList`. O `nft.updated` passou a levar a disponibilidade por edição.
- Endpoints: `GET /api/nfts` (busca, filtros, abas, ordenação, paginação, coleção, exclusão; 422 para parâmetros inválidos), `GET /api/nfts/:id`, `GET /api/highlights`, `GET/PUT/DELETE /api/favorites`.
- **Cenários novos** (determinísticos): `slow`, `hold-catalog` (resposta retida até o teste liberar), `out-of-order`, `stale-in-flight`, `catalog-error`, `catalog-offline`, `detail-error`, `empty`, `broken-images`, `favorite-fail`.
- Persistência subiu para `kurio:mock:db:v3`.

## 5. Defeitos encontrados e corrigidos (com evidência)
1. **A URL inválida vazava para a API.** O TanStack Router mescla o resultado do `validateSearch` sobre a query crua. Valores omitidos pelo validador continuavam presentes, e `?network=bitcoin` gerava 422. Corrigido devolvendo todas as chaves (inválidas como `undefined`); há teste unitário da regra de mescla.
2. **Corrida: resposta REST antiga depois de um evento mais novo.** Uma listagem em trânsito chegava depois do `nft.updated` e regredia o preço; era a causa da falha intermitente do T9. Corrigido com o último evento memorizado por NFT e reaplicação **monotônica** quando o REST entra no cache. Teste determinístico `stale-in-flight`, com **controle negativo**: sem a correção, a tela fica em 1.69 ETH e o teste falha nos dois viewports (`race-stale-in-flight-WITHOUT-fix-NEGATIVE-CONTROL.log`).
3. **Corrida: eventos antes da autenticação do socket.** Após um refresh, uma liquidação no intervalo antes da autenticação se perdia (T7b). Corrigido com reconciliação REST também na primeira conexão quando há dados em cache.
4. **Recursão infinita introduzida pela correção 2.** Gravar no cache acionava a reaplicação, que gravava de novo, até estourar a pilha. A interface parecia certa; só o contador do painel revelou o problema. Corrigido com guarda de reentrância e gravação apenas quando há item mais antigo. **Prevenção:** fixture automática `failOnPageError` (`e2e/fixtures.ts`) reprova qualquer teste com exceção não tratada na página.
5. **Variações de arte invadiam os personagens:** o `blur` do sharp devolve 3 canais. Corrigido com `extractChannel(0)` e verificação de tamanho.
6. **Lint (react-hooks 7):** `setState` dentro de effects e ref escrita durante o render. Refatorado para o padrão recomendado (ajuste de estado no render, valores derivados, `useEffectEvent`).
7. **Fidelidade** (das comparações na mesma escala):
   - hero mobile ~70% mais alto que o Figma (título em 3 linhas): token `text-display-sm` de 22 para 19 px;
   - galeria do detalhe desktop menor (miniaturas de 104 px, imagem de ~450 px);
   - botões do detalhe mobile acima da imagem, e imagem com margens;
   - estrelas na linha do preço;
   - moldura dos cards com respiro inferior maior.

## 6. Resultados dos testes
| Comando | Resultado |
|---|---|
| `npm run typecheck` / `lint` / `build` | OK / OK (0 erros) / OK |
| `npm run test:e2e`, rodadas 11, 12 e 13 (seguidas) | **199 passed · 0 failed · 2 skipped** em cada uma |

| Projeto | Aprovados | Ignorados | Novos no CP3 |
|---|---|---|---|
| unit | 39 | 0 | validação da URL do catálogo (5) |
| desktop-chromium (1440) | 74 | 1 | catálogo (20), detalhe (10), baselines visuais (2), axe em mais rotas (3) |
| mobile-chromium (390) | 74 | 1 | idem |
| responsive | 12 | 0 | rotas novas incluídas (10 rotas × 8 larguras) |

- **Ignorados (justificados):** o filtro por teclado na barra lateral (só existe no desktop) e o drawer de filtros (só existe no mobile).
- **Testes adaptados (cobertura preservada):** PoC 7/8 passou a verificar "+1 reconciliação na reconexão" em vez de um total fixo, porque a primeira conexão agora também reconcilia. O teste de skeleton passou a usar o cenário determinístico `hold-catalog` em vez de latência.
- **Histórico de falhas (não ocultado):**
  - 1ª rodada: 10 falhas (detector de overflow com falso positivo, ambiguidade de seletores, URL inválida, títulos duplicados);
  - rodada 4: T9 e T7b (corridas §5.2 e §5.3);
  - rodadas 6, 8 e 9: 7/8 (adaptação), T3/4 (recursão §5.4) e baseline visual (imagem não decodificada).
  - Logs em `cp3-tests/*FAILED.log`; diff visual em `visual-flake-inicio-mobile-diff.png`.

## 7. Evidências visuais
- **Páginas completas:** `inicio-*`, `detalhe-*` e `mercado-filtrado-*` em 390/768/1440 (viewport em PNG, página inteira em WebP).
- **Estados (390 e 1440):** busca vazia, 404, erro, skeleton, imagem quebrada.
- **Comparações na mesma escala:** `comparacao-inicio-desktop.png`, `comparacao-inicio-mobile.png`, `comparacao-detalhe-desktop.png`, `comparacao-detalhe-mobile.png`.
- **Baselines de regressão visual:** `e2e/visual.spec.ts-snapshots/{inicio,detalhe}-{desktop,mobile}-chromium-win32.png`. Elas garantem **estabilidade**, não fidelidade.

## 8. Diferenças visuais restantes em relação ao Figma
1. **Artes:** placeholders reconstruídos por IA mais variação de fundo; não são os originais.
2. **Galeria do detalhe:** 2 vistas (arte + recorte de detalhe) em vez das 4 miniaturas do Figma.
3. **"Mais desta coleção":** mostra só NFTs da mesma coleção (o Figma mistura personagens) e não tem os indicadores "• • •" (lista com rolagem horizontal no mobile e 5 colunas no desktop).
4. **Busca no desktop:** um campo na barra de ferramentas do catálogo. O Figma desktop só mostra o ícone, mas o enunciado exige busca.
5. **Textos ilegíveis nas capturas** (corpo dos banners e resumos do Diário): redigidos no mesmo tom (`src/content/home.ts`).
6. **Atributos do Emerald Ape:** "Óculos, Jaqueta college, Colar, Fundo clássico". No Figma aparece "Raro", mas o card do Figma não tem o selo RARO; priorizamos a grade.
7. **Hero mobile:** ~235 px de altura contra ~180 px no Figma (texto e imagem em proporções próximas, mas não idênticas).
8. Pequenas diferenças de tamanho de texto no desktop (as capturas estão em escala ~0,26).

## 9. Assets faltantes
Sem mudança em relação ao CP2: artes originais, galeria de 4 vistas, imagens de banners, editorial e hero, fonte e ícones originais. Ver `ASSETS_MANIFEST.md`.

## 10. Limitações e decisões
- Após `nft.updated`, o item é atualizado **no lugar**; a reordenação e o filtro de preço passam a valer na próxima consulta (R-33).
- O carrinho e a compra têm contrato, mas não implementação (CP5).
- O botão central da bottom nav leva ao Mercado (interpretação do ícone "scan" do Figma).
- As baselines visuais são do Windows; o CP7 gera as de Linux para a CI.
- Contagens das facetas: cada uma considera os **demais** filtros aplicados.

## 11. Pendências
- **CP4:** cadastro e login no visual do Figma (modal no desktop, tela cheia no mobile), perfil, carteiras, expiração de sessão, troca de usuário.
- **CP5:** carrinho, cotação, checkout (substituir o contrato `useCartActions`), baselines de Carrinho e Pagamento.
- **CP6:** pedidos, confirmação e persistência do mock entre abas (PEND-03).
- **CP7–CP9:** baselines Linux, Lighthouse, remoção ou ocultação de `/demo/*`, documentação final.
- Pendências do CP1: PEND-01, 02, 03, 04 e 06.

## 12. Commit e checkout limpo
Ver a mensagem final deste checkpoint.
