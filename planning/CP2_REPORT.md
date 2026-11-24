# CP2 — Design system, assets e estrutura visual · Relatório

Data: 2026-11-24. Resultados de execuções reais. Logs em `planning/evidence/cp2-tests/`; capturas em `planning/evidence/cp2/`.

## 1. Resumo
- Tokens definitivos (cores medidas, tipografia, espaçamento, raios, elevação, movimento, estados, skeleton) estão em `src/index.css` e documentados em [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).
- 22 componentes pedidos, além da estrutura global: header desktop, barra superior mobile por tela, navegação inferior, rodapé desktop e mobile, layouts de conta e de checkout, modais e drawers.
- Placeholders das artes recortados das capturas e melhorados com super-resolução (Real-ESRGAN, autorizado). Os assets faltantes estão listados em [`ASSETS_MANIFEST.md`](ASSETS_MANIFEST.md).
- **126/126 testes em duas rodadas seguidas**; 24/24 capturas de evidência; typecheck, lint e build sem erros.

## 2. Ambiente e dependências adicionadas (versões exatas)
Node 26.13.1 · npm 11.20.0. Caches e temporários seguem em `D:\emprego\.cache` (C: sem espaço).
| Pacote | Versão | Motivo |
|---|---|---|
| `@fontsource-variable/roboto-mono` | 5.3.0 | Fonte self-hosted |
| `sonner` | 2.0.8 | Toast (via shadcn) |
| `vaul` | 1.1.2 | Drawer (via shadcn) |
| `@axe-core/playwright` (dev) | 4.14.1 | Auditoria de acessibilidade nos testes |
| `sharp` (dev) | 0.35.5 | Pipeline de assets (recorte, WebP/AVIF) e comparações |

**Removidos:**
- `cn` e `next-themes`: o CLI do shadcn os reinstalou; o projeto usa `@/lib/utils` e só tem tema escuro.
- `components/ui/pagination.tsx`: substituído por um componente próprio, porque precisa de links do Router.

**Sem alteração:** `msw` 2.15.0 e `@mswjs/socket.io-binding` 0.2.0 continuam fixados.

## 3. Fonte
**Roboto Mono Variable** (pesos 100–700), self-hosted. É uma **substituição documentada**: sem login no Figma, a fonte original não pôde ser confirmada. A escolha vem da comparação das letras nas capturas ampliadas. Teste: a fonte é carregada e aplicada ao `body`.

## 4. Componentes implementados
Button · Input · SearchInput · Select · Checkbox · Slider · Badge · Tabs · Dialog · Drawer · Tooltip · Toast · QuantitySelector · PriceDisplay · NFTCard · NFTCardSkeleton · EmptyState · ErrorState · LoadingState · SectionHeading · Pagination · NetworkBadge · WalletCard.
**Extras:** NFTGrid (masonry mobile), RadioGroup, DropdownMenu, Label, Logo, Container, UnavailableAction (ações fora do escopo, sem simular sucesso), PlaceholderPage e OutOfScopePage.
**Estrutura:** AppShell (skip link + controle por rota via `staticData`), SiteHeader, MobileTopBar, BottomNav, SiteFooter, AccountLayout e CheckoutLayout. A tabela completa (arquivo e base shadcn/própria) está em `DESIGN_SYSTEM.md §9`.

**Fronteiras preservadas:** os cards da galeria e do checkout de demonstração usam **dados da API simulada** (`useNftList` → Axios → MSW). O contrato `Nft` ganhou `image`, `imageAlt`, `network` e `rare`, e o seed do mock foi atualizado (`kurio:mock:db:v2`). O resumo do checkout mostra **skeleton**, e não valores calculados na UI: os totais virão da cotação da API no CP5.

## 5. Rotas
| Rota | Tipo |
|---|---|
| `/demo`, `/demo/componentes`, `/demo/conta`, `/demo/checkout` | **Interna e temporária** (galeria e layouts), com `noindex` e sem link no site |
| `/demo/poc/*` | Prova de conceito do CP1, movida para cá **sem alterar o código validado** |
| `/`, `/mercado`, `/carrinho`, `/favoritos`, `/nft/$nftId`, `/perfil`, `/perfil/carteiras` | **Placeholders temporários** ("Tela em construção"), para a navegação e os links tipados funcionarem. Rotas privadas já com guard |
| `/criadores`, `/aprenda` | **Definitivas**, "fora desta demonstração" (decisão aprovada) |

## 6. Resultados dos testes
| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |
| `npm run test:e2e`, rodada 1 | **126 passed · 0 failed · 0 skipped** |
| `npm run test:e2e`, rodada 2 | **126 passed · 0 failed · 0 skipped** |
| `EVIDENCE=1 npx playwright test --project=evidence` | 24 passed (capturas) |

| Projeto | Testes | Conteúdo |
|---|---|---|
| unit | 34 | eth (5), EventGuard (6), cn/tailwind-merge (3), contraste de tokens (19), paginação (1) |
| desktop-chromium (1440) | 40 | PoC do CP1 (16) + design system (24: estrutura, componentes, axe em 6 rotas + controle negativo) |
| mobile-chromium (390) | 40 | idem |
| responsive | 12 | Overflow em 360/390/600/768/900/1024/1280/1440 × 7 rotas + troca de navegação em 390/768/1024/1440 |

**Histórico:** uma rodada intermediária teve 112 aprovados e **12 reprovados** (`e2e-intermediate-12-FAILED.log`). Diagnóstico de cada falha:
- **Defeitos de componente (corrigidos):**
  - o drawer não movia o foco para dentro, porque o `vaul` não faz isso por padrão;
  - o skeleton do card ficava 3,4 px mais baixo que o card (CLS).
- **Defeitos dos testes (corrigidos):**
  - o `openApp` não esperava o App renderizar depois do MSW, então a página estava vazia no Tab e na verificação de fonte;
  - dois seletores ambíguos ("Principal" × "Navegação principal"; "Explorar o mercado" × botão central);
  - o rádio exigia segurar a seta, porque o Radix move o foco num `setTimeout` e o `press()` do Playwright solta a tecla na hora.

**Controles de qualidade dos próprios testes:**
- **axe:** cada auditoria precisa ter mais de 15 regras aprovadas, incluindo `color-contrast`. Um controle negativo injeta uma imagem sem `alt` e um botão sem nome, e o axe precisa acusar os dois (`axe-nonvacuous-and-negative-control.log`).

## 7. Defeitos encontrados e corrigidos no CP2 (além dos acima)
1. **`tailwind-merge` descartava os tamanhos de fonte** personalizados quando combinados com uma cor (`text-caption` + `text-foreground/80`), o que deixava fontes inconsistentes no rodapé. Corrigido estendendo o `tailwind-merge`, com teste unitário.
2. **Overflow horizontal em 768 px** no layout de conta: a lista horizontal de itens forçava a largura da grade. Corrigido com `minmax(0,1fr)`, também no checkout. Hoje é coberto pelo teste de overflow.
3. **Classes `dark:` do shadcn** dependiam do tema do sistema operacional, deixando a renderização não determinística. Foram removidas.
4. **IDs duplicados** na newsletter, renderizada duas vezes (desktop e mobile). Corrigido com `useId`.
5. **Slider sem nome acessível** nos polegares. Adicionado `thumbLabels`.
6. **Skeleton invisível** sobre cards de superfície (mesma cor). A base passou para `surface-2`.
7. **Real-ESRGAN na Intel Iris Xe** gerou saídas corrompidas sem erro de saída (`vkQueueSubmit failed -4`). Corrigido com tiles de 64 px e uma **verificação de sanidade de cor** no script, que aborta se a saída divergir.

## 8. Capturas (390 / 768 / 1440)
Em `planning/evidence/cp2/`:
- **Viewport (PNG):** `{inicio-estrutura, componentes, layout-conta, layout-checkout, fora-do-escopo, 404}-{390,768,1440}-viewport.png`.
- **Página inteira (WebP):** `*-pagina.webp`. Em capturas de página inteira, a bottom nav fixa aparece no meio da imagem; é um efeito da captura, não do layout.
- **Comparações com o Figma (PNG):** `comparacao-{header-desktop, footer-desktop, conta-desktop, cards-mobile, bottom-nav-mobile, carrinho-mobile}.png`, geradas por `node scripts/evidence/compare-cp2.mjs`.

## 9. Comparação visual com o Figma: o que foi verificado e ajustado
Comparei proporção, alinhamento, densidade, hierarquia, tipografia e espaçamento, não só as cores. Ajustes feitos a partir das comparações:
- **Card:** moldura com respiro inferior maior que o lateral; favoritar menor, em círculo de superfície com coração caramelo; selo "RARO" maior.
- **Grade:** espaço entre colunas de 16 px; deslocamento do masonry de 36 px.
- **Bottom nav:** ícones de 20 px preenchidos (carrinho em contorno), como no Figma.
- **Carrinho mobile:** miniatura de 80 px e nome com 14 px em negrito (antes era truncado).

## 10. Diferenças conhecidas em relação ao Figma
1. **Artes:** placeholders reconstruídos por IA a partir de recortes de 72–270 px. Não são os originais, e algumas personagens reutilizam a mesma arte.
2. **Fonte:** Roboto Mono, por identificação visual, não confirmada.
3. **Borda de input mais visível** (`#82603F` × ~`#341E15`) para atender a WCAG 1.4.11 (3:1).
4. **Gradiente dos CTAs:** `#D28A4C → #B77743` (medido). O CP0 tinha registrado `#A56C3D`, que daria contraste de 4,41 com o texto.
5. **Botão central da bottom nav:** o ícone "scan" do Figma não tem função definida. Foi interpretado como "Explorar coleções" (vai ao Mercado).
6. **Rodapé mobile, layouts de conta e checkout em mobile e tablet:** não existem no Figma, foram derivados.
7. **Tamanhos tipográficos do desktop:** estimados com ±2 px (capturas em escala ~0,26).
8. **Cores de erro, sucesso e aviso:** propostas próprias (o Figma não tem estados).
9. **Links e ações fora do escopo** (rodapé, redes sociais, newsletter, itens da conta): são focáveis e informam "Indisponível na demonstração", sem simular sucesso.

## 11. Pendências
- Telas definitivas (CP3–CP6), incluindo a Confirmação de pedido, cuja referência visual não está disponível.
- Assets originais (ver o manifesto).
- `breadcrumb`, `separator` e `sheet` do shadcn instalados e ainda sem uso.
- Rotas `/demo/*`: ocultar ou remover antes da entrega final (CP9).
- Zoom de 200% (A11Y-07) a validar no CP8.
- Pendências do CP1: PEND-01..06.
- Revalidação do HEAD em checkout limpo: feita para o commit deste checkpoint (ver §12).

## 12. Commit e checkout limpo
Ver a mensagem final do checkpoint (hash do commit e resultado do checkout limpo).
