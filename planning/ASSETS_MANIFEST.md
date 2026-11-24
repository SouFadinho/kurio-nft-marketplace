# ASSETS_MANIFEST — KURIO (CP2)

## Situação do Figma
O arquivo oficial está numa **equipe restrita, em modo somente consulta**. Sem login, o Figma informa: "Cadastre-se para comentar, editar, inspecionar e outras ações" (verificado em 2026-11-24 no navegador embutido). Por decisão do candidato, **não houve login nem tentativa de contornar** a restrição. Logo, nenhum asset original foi exportado.

## Assets obtidos
| Asset | Arquivo | Origem | Observação |
|---|---|---|---|
| Fonte Roboto Mono (variável, 100–700) | `@fontsource-variable/roboto-mono` 5.3.0 | npm (SIL OFL 1.1) | **Substituta** da fonte não confirmada do Figma |
| Ícones de interface | `lucide-react` 1.79.0 | npm (ISC) | Equivalentes visuais aos ícones das capturas |
| Ícones de redes sociais | `src/components/icons/brand.tsx` | Desenho próprio | Geométricos; não são os logotipos oficiais |
| Logo "KURIO" | Texto em Roboto Mono, bold, espaçado | Reproduzido das capturas | O Figma não mostra um arquivo de logo distinto do texto |

## Placeholders temporários das artes de NFT
Gerados por `scripts/assets/build-placeholders.mjs` (reprodutível). Cada arte foi recortada **individualmente** das capturas, em regiões sem marcadores de comentário. **Nenhuma tela inteira** do Figma foi usada como interface.
Para reduzir a pixelização (pedido do candidato no CP2), as artes passaram por **super-resolução 4x com Real-ESRGAN** (`realesrgan-ncnn-vulkan` v0.2.5.0, modelo `realesrgan-x4plus`, executado localmente; download autorizado pelo candidato). Depois foram redimensionadas para 512×512 em WebP e AVIF.

> ⚠ A IA **reconstrói** detalhes plausíveis; o resultado **não é a arte original**. As três miniaturas de 72 px têm aspecto levemente "pintado". Todas as artes devem ser substituídas pelos originais quando houver acesso.

| Arquivo (`public/assets/nfts/`) | Resolução de origem | Final | Captura / região | Usado por |
|---|---|---|---|---|
| `emerald-ape.{webp,avif}` | 256 px | 512 px | `13_10_47` (Mobile / Detalhe) 520,89 270×256 | Emerald Ape #042 |
| `sage-nomad.{webp,avif}` | 116 px | 512 px | `13_10_47` (Mobile / Início) 235,352 116×116 | Sage Nomad #009 |
| `violet-nomad.{webp,avif}` | 72 px | 512 px | `13_10_51` (Mobile / Carrinho) 58,213 75×72 | Violet Nomad #314, Cosmic Bloom #118 |
| `ivory-baron.{webp,avif}` | 72 px | 512 px | `13_10_51` 58,309 75×72 | Ivory Baron #088, Neon Vessel #552 |
| `golden-beat.{webp,avif}` | 72 px | 512 px | `13_10_51` 58,404 75×72 | Golden Beat #207, Golden Frequency #071, Golden Signal #160 |

O registro de máquina de cada arquivo (região, upscaler, status) está em `public/assets/nfts/manifest.json`.

## Assets faltantes (necessários para fidelidade total)
| Asset | Onde aparece | Especificação necessária |
|---|---|---|
| Artes originais dos 9+ NFTs | Início, detalhe, carrinho, pagamento, "Mais desta coleção" | Quadradas 1:1, ≥ 1024×1024, fundo cheio (creme, sálvia, verde-água), PNG ou WebP sem perdas |
| Variações de cor por NFT | Cosmic Bloom, Golden Frequency, Golden Signal, Neon Vessel (no Figma são variações; aqui reutilizam a mesma arte) | Idem |
| Galeria do detalhe (4 ângulos ou variações) | Desktop / Detalhe (miniaturas verticais) | 1:1, ≥ 1024 px |
| Imagens dos banners promocionais | Início desktop ("Lançamentos gênesis…", "Arte digital…") | ~3:2, ≥ 800 px de largura |
| Imagens editoriais "Diário da Cunhagem" | Início desktop (4 cards) | ~4:3, ≥ 600 px de largura |
| Imagens do hero (desktop e mobile) | Início | 1:1 ou ~4:5, ≥ 1200 px; fundo creme |
| Fonte original | Todas as telas | Nome e pesos confirmados no Figma (Inspect) |
| Ícones originais do Figma | Header, bottom nav, rodapé, FAB "scan" | SVG |
| Marcas de login social (Google, Facebook) e de carteiras | Login, Cadastro, Pagamento (CP4/CP5) | SVG oficiais, conforme as diretrizes de marca |

## Política
- Sem hotlinks: tudo é servido localmente (`public/assets`, fontes no bundle).
- Sem imagens aleatórias ou de bancos de imagem que descaracterizem o marketplace.
- Os placeholders de imagem para promoções e editorial (CP3) seguirão a mesma regra: artes dos personagens já existentes, com recorte e proporção documentados.
