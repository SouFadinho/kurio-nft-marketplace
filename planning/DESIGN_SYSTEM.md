# DESIGN_SYSTEM — KURIO (CP2)

A fonte da verdade é `src/index.css` (`@theme inline`): a tabela abaixo é uma cópia comentada. O teste `e2e/unit/tokens.spec.ts` **lê os valores diretamente do CSS** e verifica o contraste de cada par usado.
Legenda: **[M]** medido em pixel nas capturas do Figma · **[D]** derivado ou ajustado (motivo ao lado).

## 1. Cores

| Token | Hex | Origem | Uso |
|---|---|---|---|
| `background` | `#140D0A` | [M] | Fundo da página |
| `foreground` | `#F5F1EB` | [M] | Títulos e texto principal |
| `surface` | `#241612` | [M] | Cards, itens do carrinho, painéis, bottom nav, rodapé |
| `surface-2` | `#341E15` | [M] | Botão secundário, hover, base do skeleton |
| `surface-3` | `#4A2D1F` | [D] | Pressionado, trilho do slider |
| `band` | `#38220F` | [M] | Faixa de contato do rodapé |
| `primary` | `#D28A4C` | [M] | CTA, item ativo, paginação, sublinhado de aba |
| `primary-hover` | `#DC9A60` | [D] | Hover do CTA |
| `primary-active` | `#B77743` | [M] | Fim do gradiente dos CTAs mobile; pressionado |
| `primary-foreground` | `#140D0A` | [M] | Texto sobre laranja |
| `price` | `#E89B55` | [M] | Preços, links, aba ativa |
| `muted-foreground` | `#CFB28C` | [M] | Texto secundário |
| `placeholder` | `#B39463` | [M] | Placeholder |
| `border` | `#341E15` | [M] | Divisores decorativos |
| `border-strong` | `#5A3A26` | [D] | Divisores de seção e de abas |
| `input` | `#82603F` | [D] | Borda de campos: **3,38:1** (WCAG 1.4.11). O Figma é mais sutil (~`#341E15`, 1,23:1) |
| `ring` | `#E89B55` | [D] | Foco visível (outline de 2 px, offset de 2 px) |
| `destructive` / `-surface` | `#FF8A80` / `#3A1714` | [D] | Erro (não existe no Figma) |
| `success` / `-surface` | `#7BC47F` / `#17281A` | [D] | Sucesso (não existe no Figma) |
| `warning` | `#F2C46D` | [D] | Aviso |
| `network-*` | `#8C9EFF` / `#B48CFF` / `#5FE3C0` | [D] | Ponto de rede (sempre acompanhado do nome) |

Gradiente dos CTAs mobile: `linear-gradient(90deg, #D28A4C, #B77743)`, com as duas pontas medidas (`.bg-primary-gradient`).

### Contraste verificado (teste automatizado)
- **Texto (≥ 4,5:1):** `foreground`, `muted-foreground`, `placeholder` e `price` sobre `background`/`surface`; `primary-foreground` sobre `primary` (6,85) e sobre `primary-active` (5,25); `destructive` e `success` sobre os respectivos fundos.
- **Componentes de UI (≥ 3:1):** `input` sobre `background` (3,38) e `surface` (3,08); `ring` sobre `background`.

## 2. Tipografia
- **Fonte:** **Roboto Mono Variable** (`@fontsource-variable/roboto-mono` 5.3.0), self-hosted, em woff2, empacotada pelo Vite e sem CDN.
  - **Substituição documentada:** sem login no Figma, a fonte original não pôde ser confirmada. A escolha vem da comparação visual das capturas (`a` de dois andares, `g` de um andar, `l` com cauda e proporções dos dígitos).
  - Fallback: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Token (utilitário) | Tamanho / altura de linha | Peso | Uso |
|---|---|---|---|
| `text-display` | 40 / 1.2, +0.02em | 700 | Hero desktop ("SEJA DONO DO FUTURO…") |
| `text-display-sm` | 22 / 1.45, +0.02em | 700 | Hero mobile |
| `text-title-1` | 24 / 1.3 | 700 | Título de página, nome do NFT no detalhe |
| `text-title-2` | 18 / 1.35 | 700 | Título de tela mobile, título de seção |
| `text-title-3` | 15 / 1.4 | 600 | Nome em card ou item |
| `text-body` | 14 / 1.6 | 400 | Texto corrido, campos |
| `text-caption` | 12 / 1.5 | 400 | Rótulos, metadados, links do rodapé |
| `text-overline` | 11 / 1.4, +0.08em | — | Selos ("RARO", carteiras compatíveis) |

Os tamanhos desktop foram estimados nas capturas em escala ~0,26 (precisão de ±2 px). O `tailwind-merge` foi estendido para reconhecer esses tokens como tamanhos de fonte (`src/lib/utils.ts`, teste `e2e/unit/cn.spec.ts`).

## 3. Espaçamento e layout
- Escala base do Tailwind (4 px).
- `--container-site`: **1200 px** de largura útil (medida no frame de 1440: ~120 px de margem de cada lado). Padding lateral de 16 px (mobile) e 24 px (md+).
- `--spacing-header` 72 px (desktop); `--spacing-bottom-nav` 72 px + safe area (mobile).
- **Breakpoints** (padrão do Tailwind):
  - mobile: < 768;
  - tablet: 768–1023 (composição mobile com grade de 3 colunas);
  - desktop: ≥ 1024 (`lg`, composição do Figma de 1440).
- **Validação:** 360, 390, 600, 768, 900, 1024, 1280 e 1440 px, sem overflow horizontal (`e2e/layout.responsive.spec.ts`).

## 4. Raios
| Token | Valor | Uso |
|---|---|---|
| `rounded-xs` | 4 px | Botões e inputs desktop, paginação |
| `rounded-sm` | 6 px | Cards de rodapé, diálogos, menu da conta |
| `rounded-md` | 8 px | Inputs mobile |
| `rounded-lg` | 12 px | Imagem dentro do card, item do carrinho, carteira |
| `rounded-xl` | 16 px | Moldura do card mobile |
| `rounded-2xl` | 24 px | Hero mobile, painel de detalhes |
| `rounded-3xl` | 28 px | Topo da bottom nav |
| `rounded-full` | — | CTAs mobile (pílula), botões circulares, FAB |

## 5. Bordas, elevação e movimento
- **Bordas:** 1 px (`border`), divisores de seção com `border-strong`, campos com `input`. O diálogo tem barra inferior laranja de 4 px (como no modal de login do Figma).
- **Sombras:** `shadow-card` (realce interno sutil), `shadow-raised` (CTA em gradiente, polegar do slider), `shadow-overlay` (diálogo, drawer, toast), `shadow-fab` (botão central). O Figma é plano: as sombras ficam restritas a sobreposições.
- **Movimento:** `--duration-fast` 150 ms (hover/cores), `--duration-base` 250 ms (zoom da imagem do card), `--ease-standard` `cubic-bezier(.2,0,0,1)`. Com `prefers-reduced-motion: reduce`, animações e transições caem para 0,01 ms e o shimmer é desligado (testado).

## 6. Estados interativos
| Estado | Tratamento |
|---|---|
| Hover | Clareia o fundo (`primary-hover`, `surface-3`) ou o texto (`foreground`) |
| Active | `primary-active` / `surface-3`; `scale(.95)` no FAB |
| Focus | `outline` de 2 px em `ring` com offset de 2 px. **Sempre visível** no teclado (`:focus-visible`) |
| Disabled | Opacidade 45%, sem eventos de ponteiro e atributo `disabled` (não só visual) |
| Erro | Borda `destructive` + mensagem associada via `aria-describedby` + `aria-invalid` |
| Sucesso | Toast `success` (anunciado em região `aria-live`) |
| Ativo/selecionado | Cor **e** um segundo indicador: sublinhado (abas, nav), barra lateral (conta), `aria-current`/`aria-pressed`/`aria-checked` |

## 7. Skeletons
- `.skeleton`: base `surface-2` + brilho em gradiente animado (`shimmer`, 1,4 s, linear).
- Os skeletons têm **as mesmas dimensões** do conteúdo final. No `NFTCardSkeleton`, as linhas têm exatamente as alturas de linha do card (21 px e 22,4 px). Isso é verificado por teste (diferença ≤ 2 px), para evitar CLS.
- São decorativos (`aria-hidden`). O contêiner anuncia o carregamento com `aria-busy` e `role="status"`.

## 8. Ícones
- `lucide-react` 1.79 (traço 2 px; 16–24 px). Na bottom nav, ícones preenchidos de 20 px, como no Figma.
- Redes sociais: SVGs geométricos próprios (`src/components/icons/brand.tsx`). O lucide 1.x removeu os ícones de marca, e não usamos os logotipos oficiais.
- Ícones decorativos usam `aria-hidden`; o nome acessível fica no controle.

## 9. Componentes
| Componente | Arquivo | Base |
|---|---|---|
| Button (default, gradient, outline, secondary, ghost, icon-round, link, destructive) | `components/ui/button.tsx` | shadcn (personalizado) |
| Input | `components/ui/input.tsx` | shadcn (personalizado) |
| SearchInput | `components/kurio/SearchInput.tsx` | próprio |
| Select | `components/ui/select.tsx` | shadcn/Radix |
| Checkbox | `components/ui/checkbox.tsx` | shadcn/Radix |
| Slider (com `thumbLabels`) | `components/ui/slider.tsx` | shadcn/Radix (reescrito: nomes acessíveis) |
| Badge (rare, chip, count, neutral, success, danger) | `components/ui/badge.tsx` | shadcn (personalizado) |
| Tabs (sublinhado) | `components/ui/tabs.tsx` | shadcn/Radix (personalizado) |
| Dialog | `components/ui/dialog.tsx` | shadcn/Radix |
| Drawer (`autoFocus` por padrão) | `components/ui/drawer.tsx` | shadcn/vaul |
| Tooltip | `components/ui/tooltip.tsx` | shadcn/Radix |
| Toast | `components/ui/sonner.tsx` | shadcn/sonner (tema fixo escuro, sem next-themes) |
| RadioGroup, DropdownMenu, Label | `components/ui/*` | shadcn/Radix |
| QuantitySelector | `components/kurio/QuantitySelector.tsx` | próprio |
| PriceDisplay | `components/kurio/PriceDisplay.tsx` | próprio (bigint) |
| NFTCard / NFTCardSkeleton | `components/kurio/NFTCard.tsx` | próprio |
| NFTGrid (masonry mobile) | `components/kurio/NFTGrid.tsx` | próprio |
| EmptyState / ErrorState / LoadingState | `components/kurio/states.tsx` | próprio |
| SectionHeading | `components/kurio/SectionHeading.tsx` | próprio |
| Pagination | `components/kurio/Pagination.tsx` | próprio sobre Button (lógica em `lib/pagination.ts`) |
| NetworkBadge | `components/kurio/NetworkBadge.tsx` | próprio |
| WalletCard | `components/kurio/WalletCard.tsx` | próprio sobre RadioGroupItem |
| Logo, Container, UnavailableAction | `components/kurio/basics.tsx` | próprio |
| AppShell, SiteHeader, MobileTopBar, BottomNav, SiteFooter | `components/layout/*` | próprio |
| AccountLayout, CheckoutLayout | `components/layout/*` | próprio |

Instalados pelo CLI e ainda **sem uso** (reservados para os próximos CPs): `breadcrumb`, `separator`, `sheet`.
