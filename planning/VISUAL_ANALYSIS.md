# VISUAL_ANALYSIS — KURIO

> **CP2:** tokens definitivos em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Atualizações: fonte adotada = Roboto Mono (substituta, identificação visual); fim do gradiente medido = `#B77743` (não `#A56C3D`); breakpoints mobile < 768, tablet 768–1023, desktop ≥ 1024; borda de input `#82603F` por acessibilidade. Comparações lado a lado em `planning/evidence/cp2/comparacao-*.png`.

> **CP0.1:** Figma oficial (somente visualização): https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1. A exportação de assets e a confirmação de fonte e espaçamentos serão tentadas no CP2, pelos mecanismos do viewer.
> Decisões aprovadas: preservar a **paleta medida** (§3); usar uma fonte mono semelhante caso a original não seja identificada (substituição documentada); não reproduzir as inconsistências matemáticas (§10); perfil, carteiras e confirmação mobile **derivados** do design system; páginas fora do escopo coerentes, sem simular função; login social visível, com aviso de indisponibilidade.
> Larguras obrigatórias de avaliação: **390, 768 e 1440 px** (o §8 abaixo usava 1024 como breakpoint; isso foi substituído por `<768` mobile, `768–1279` tablet e `≥1280` desktop).
> Tela obrigatória **sem captura:** Confirmação de pedido (resultado, transação, itens, taxas, total).

Fonte: 8 capturas de tela do Figma na raiz do projeto. Não há acesso ao arquivo Figma.
Método: leitura de cada imagem, recortes ampliados (3x) das regiões de texto e **amostragem de pixels** (System.Drawing) para cores.
Legenda de confiança: **[M]** medido em pixel · **[O]** observado com segurança · **[E]** estimado (baixa resolução, precisa de confirmação no Figma).

## 1. Inventário de telas

| Imagem | Frames | Observações |
|---|---|---|
| `13_10_32` | Desktop / Início (topo e meio) · Desktop / Detalhes do NFT (completa) | Frame "Início" com largura 1440 |
| `13_10_39` | Desktop / Início (parte inferior) | Rótulo "1440 × Envolver 3668" → página de 1440 px de largura e cerca de 3668 px de altura |
| `13_10_43` | Desktop / Login · Desktop / Cadastro | Modal sobre a Home |
| `13_10_47` | Mobile / Início · Mobile / Detalhes do NFT | Melhor legibilidade |
| `13_10_51` | Mobile / Carrinho · Mobile / Pagamento · Mobile / Login | Melhor legibilidade |
| `13_10_54` | Mobile / Cadastro | — |
| `13_10_56` | Desktop / Cadastro · Desktop / Perfil do Colecionador · Desktop / Carteiras | Texto pequeno |
| `13_10_59` | Desktop / Detalhes do NFT · Desktop / Carrinho · Desktop / Pagamento | Texto pequeno |

Ruído nas capturas: avatares e marcadores de comentário do Figma (círculos "T", "Z", "A", "L", "E", "S", fotos) cobrem partes do conteúdo e **não fazem parte do design**.

## 2. Identidade visual

Tema escuro, tons de marrom-café e acento cobre/laranja. Tipografia **monoespaçada** em toda a interface (títulos, corpo, preços e botões), o que dá um ar "terminal/cripto". As ilustrações são retratos de macacos antropomórficos com fundos creme ou verde-sálvia. A marca "KURIO" aparece em caixa alta, monoespaçada e com letras espaçadas.

## 3. Paleta (amostrada)

| Token proposto | Hex | Origem | Uso |
|---|---|---|---|
| `--bg` | `#140D0A` | [M] fundo da página e do celular, login, sidebar | Fundo base |
| `--surface` | `#241612` | [M] itens do carrinho, resumo, cards de carteira, painel de detalhes, nav mobile, cards do rodapé | Superfícies elevadas |
| `--surface-2` | `#341E15` | [M] borda de input · `#341A0A` card desktop [M] | Bordas e cards de NFT no desktop |
| `--band` | `#38220F` | [M] faixa de contato do rodapé | Faixa de destaque |
| `--primary` | `#D28A4C` | [M] botão "Entrar", paginação ativa, sublinhado da aba ativa | CTA e estado ativo |
| `--primary-grad-end` | `#B77743` → `#A56C3D` | [M] lado direito dos botões mobile | Gradiente horizontal dos CTAs mobile |
| `--accent-text` | `#E89B55` | [M] preços, total, link "Esqueceu a senha?" | Preços e links |
| `--fg` | `#F5F1EB` | [M] logo, títulos, nomes | Texto principal |
| `--muted` | `#CFB28C` | [M] "Edição: 1/50" | Texto secundário |
| `--placeholder` | `#B39463` | [M] placeholder de inputs | Placeholder |
| `--on-primary` | escuro (≈`#140D0A`) | [O] texto preto sobre botões laranja | Texto em CTA |

As cores de status (sucesso, erro, aviso) **não aparecem nas referências**. Serão propostas no CP2 e documentadas como decisão própria, com contraste AA verificado.

## 4. Tipografia

- Família: monoespaçada em todos os níveis. **[E]** O formato das letras é compatível com *Roboto Mono*, *JetBrains Mono* ou *IBM Plex Mono*, mas **não dá para confirmar** sem o Figma. Proposta: usar Roboto Mono (variable, self-hosted e com subset latin) até a confirmação.
- Hierarquia observada [O]:
  - Hero desktop: caixa alta, ~32–36 px (estimado), peso bold, com duas linhas: "SEJA DONO DO FUTURO / DA ARTE DIGITAL".
  - Hero mobile: caixa alta, menor: "SEJA DONO DA / CULTURA DIGITAL" (o **texto é diferente** do desktop).
  - Títulos de tela mobile ("Carrinho de NFTs", "Pagamento com carteira"): ~18–20 px, bold.
  - Nome do NFT no detalhe: ~20 px, bold.
  - Corpo e labels: ~12–14 px no mobile; ~8–10 px na captura desktop (no frame real de 1440 px, provavelmente 12–14 px) [E].
  - Preço: bold, cor `--accent-text`.

## 5. Componentes reutilizáveis identificados

| Componente | Onde aparece | Base shadcn/ui sugerida |
|---|---|---|
| Header desktop (logo, nav Início/Mercado/Criadores/Aprenda, busca, carrinho com badge, botão "Entrar") | Todas as telas desktop | `NavigationMenu`, `Button`, `Badge` |
| Bottom nav mobile (Início, Favoritos, botão central flutuante, Carrinho, Perfil) | Mobile / Início | Custom + `Button` |
| Barra de busca mobile + botão de filtros | Mobile / Início | `Input`, `Sheet` (filtros) |
| Hero / carrossel com indicadores "•••" | Início | `Carousel` |
| Abas "Todos os NFTs / Novos lançamentos / Em alta" | Início | `Tabs` |
| Select "Ordenar por: Listados recentemente" | Desktop / Início | `Select` |
| Sidebar de filtros: Coleções (com contagem), Faixa de preço (slider duplo + "Aplicar"), Rede (Ethereum, Polygon, Solana) | Desktop / Início | `Slider`, `Checkbox`/lista, `Button` |
| Card de NFT (imagem, nome, preço, preço riscado opcional, badge "RARO", favoritar, ações no hover) | Início, "Mais desta coleção", "Colecionadores também viram" | `Card`, `Badge`, `Toggle` |
| Card "NFT em destaque / Oferta limitada" | Desktop / Início | `Card` |
| Paginação (1 2 3 4 >) | Desktop / Início | `Pagination` |
| Banners promocionais (2 lado a lado: "Lançamentos gênesis de edição limitada", "Arte digital…") | Desktop / Início | `Card` |
| Cards de blog "Diário da Cunhagem" (data, tempo de leitura, título, resumo, "Ler mais") | Desktop / Início | `Card` |
| Galeria com miniaturas verticais + zoom | Desktop / Detalhe | Custom |
| Avaliação em estrelas + contagem | Detalhe | Custom |
| Chips de edição (1/10, 1/1, 1/50, ABERTA) | Detalhe | `ToggleGroup` |
| Stepper de quantidade (− 1 +) | Detalhe, Carrinho | Custom com `Button` |
| Abas "Detalhes do NFT / Avaliações de colecionadores (19)" | Desktop / Detalhe | `Tabs` |
| Carrossel "Mais desta coleção" com dots | Detalhe | `Carousel` |
| Linha de item do carrinho (miniatura, nome, edição/ID do token, preço, stepper, total, lixeira) | Carrinho | Custom; `Table` no desktop |
| Campo de cupom + "Aplicar" | Carrinho, Pagamento | `Input`, `Button` |
| Resumo (Subtotal, Desconto do lançamento, Taxa de rede + "Taxa estimada", Total) | Carrinho, Pagamento | Custom |
| Card de carteira com radio (nome, ENS/endereço abreviado, rede, menu ⋮) | Mobile / Pagamento | `RadioGroup`, `DropdownMenu` |
| Lista de provedores (WalletConnect, MetaMask, Coinbase Wallet) com radio | Mobile / Pagamento | `RadioGroup` |
| Formulários de autenticação (inputs com ícone de mostrar senha, CTA, divisor "Ou continue com", Google, Facebook, link para trocar de modo) | Login/Cadastro | `Form`, `Input`, `Button`, `Separator`, `Dialog` (desktop) |
| Abas "Entrar / Criar conta" no modal | Desktop / Login e Cadastro | `Tabs` |
| Sidebar do perfil (Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte, Sair) com indicador ativo à esquerda | Perfil, Carteiras | Custom nav |
| Formulários de perfil e carteira (labels com `*` laranja, selects, sufixo ".eth") | Perfil, Carteiras, Pagamento desktop | `Form`, `Select` |
| Breadcrumb "Início / Mercado / …" | Desktop / Detalhe, Carrinho, Pagamento | `Breadcrumb` |
| Rodapé: 3 cards de benefício com ícone circular (Segurança da carteira, Criadores em destaque, Alertas de lançamentos), newsletter, faixa de contato, 4 colunas de links, redes sociais, "Carteiras compatíveis", copyright | Todas as telas desktop | Custom |

## 6. Layout desktop (frame de 1440 px)

- Conteúdo centralizado em um container estreito (no frame, ocupa cerca de 82% da largura) [E].
- **Início:** header → hero (texto à esquerda, imagem à direita) → grid de 2 colunas: sidebar de filtros (~25%) e grid de NFTs com 3 colunas → paginação → 2 banners → "Diário da Cunhagem" (4 cards) → rodapé.
- **Detalhe:** breadcrumb → 3 colunas: miniaturas, imagem principal e informações (nome, preço, estrelas, descrição, edição, quantidade, Comprar/Favoritar, ID do token, coleção, atributos, compartilhar) → abas → "Mais desta coleção" (5 cards em carrossel) → rodapé.
- **Carrinho:** breadcrumb → tabela (NFTs, Preço, Edições, Total, lixeira) à esquerda e "Resumo da carteira" à direita (cupom, totais, "Conectar e finalizar", "Continuar explorando") → "Colecionadores também viram" → rodapé.
- **Pagamento:** formulário "Perfil do colecionador" à esquerda (nome de exibição, nome de usuário, rede, nome de perfil, endereço da carteira, ENS/carteira secundária, tipo de carteira, código de indicação, e-mail, nome ENS ".eth", "Usar outra carteira?", observação) e "Seus NFTs" à direita (lista, cupom, totais, seleção de carteira, "Confirmar compra").
- **Login/Cadastro:** `Dialog` centralizado sobre a Home, com abas "Entrar | Criar conta", botão de fechar e uma barra laranja na borda inferior.
- **Perfil/Carteiras:** sidebar à esquerda e formulário em 2 colunas.

## 7. Layout mobile

- Frame com cantos arredondados (moldura de aparelho; **não** reproduzir as bordas no app).
- **Início:** busca e filtros → hero em card com gradiente → abas → grid de 2 colunas em **masonry** (cards com alturas diferentes) → bottom nav fixa com botão central flutuante.
- **Detalhe:** imagem quase em tela cheia com botões de voltar e favoritar sobrepostos → painel `--surface` com cantos superiores arredondados (nome, nota 4.8 (19), descrição, chips de edição, ID do token, coleção, atributos) → barra inferior fixa (Qtd. com stepper, preço, "Comprar NFT" e botão de carrinho).
- **Carrinho:** header com voltar → lista de itens → painel inferior (cupom, totais, "Conectar e finalizar").
- **Pagamento:** "Carteira conectada" + "Trocar carteira" → cards de carteira → "Carteira e rede" (provedores) → Total → "Confirmar compra" fixo na parte inferior.
- **Login/Cadastro:** página inteira, logo KURIO centralizado, sem header ou nav.

## 8. Diferenças desktop × mobile

| Aspecto | Desktop | Mobile |
|---|---|---|
| Navegação | Header com links e botão "Entrar" | Bottom nav e botão flutuante; sem header |
| Login/Cadastro | Modal com abas sobre a Home | Página inteira |
| Filtros | Sidebar sempre visível | Botão de filtros (abre um sheet; **conteúdo não desenhado**) |
| Grid | 3 colunas uniformes | 2 colunas em masonry |
| Hero | "…FUTURO DA ARTE DIGITAL", imagem grande | "…CULTURA DIGITAL", card compacto com "EXPLORAR →" |
| Detalhe | Galeria com miniaturas, abas, compartilhar | Imagem única, CTA fixo embaixo, chips de edição |
| Pagamento | Formulário longo de perfil e carteira | Seleção de carteira e provedor (sem formulário) |
| Rodapé | Completo | Ausente |
| Botões | Laranja sólido, cantos pouco arredondados | Gradiente laranja, formato pílula |

**Breakpoint:** não definido nas referências. Proposta: layout mobile abaixo de 1024 px (`lg`) e desktop a partir de 1024 px, com revisão no CP2. O intervalo de tablet **não foi desenhado**.

## 9. Assets necessários

- Ilustrações de NFT: Emerald Ape #042, Sage Nomad #009, Noon Vessel #552 (leitura incerta), Cosmic Bloom #118, Violet Nomad #314, Ivory Baron #088, Golden Beat #207, Golden Frequency #071, Golden Signal #160. **Não temos os arquivos originais**: recortar das capturas resultaria em baixa qualidade. Pedir a exportação do Figma ou usar placeholders licenciados e documentar a escolha.
- Logo "KURIO" (pode ser texto na fonte mono).
- Ícones: busca, carrinho, login, coração, estrela, lixeira, olho/olho cortado, voltar, filtros, zoom, compartilhar, home, perfil, carteira, redes sociais (Facebook, Instagram, X/Twitter, LinkedIn, YouTube), marcas Google e Facebook (botões sociais), WalletConnect/MetaMask/Coinbase (no mockup aparecem como letras "W", "M" e um ícone genérico). Proposta: `lucide-react` + SVGs oficiais das marcas apenas onde forem obrigatórios.
- Fonte monoespaçada (self-hosted, woff2).

## 10. Inconsistências e ambiguidades nas referências

1. **Subtotal mobile inconsistente:** os itens somam 1.19 + 1.39 + 3.58 + 1.98 = 8.14 ETH, mas o subtotal exibido é 8.92 ETH. No desktop a conta fecha (2.38 + 8.34 + 16.11 = 26.83). → Os totais serão **sempre calculados**, nunca copiados do mockup.
2. **Edição 1/1 com stepper de quantidade:** uma edição única com quantidade > 1 não faz sentido. → Regra proposta: a quantidade máxima é o estoque restante da edição (decisão a confirmar).
3. **"Taxa de rede 0.016 ETH" com carteira em "Rede Polygon":** a taxa da Polygon não seria cobrada em ETH. → Mock de taxa por rede, documentado.
4. Preços divergem entre telas por causa da baixa resolução (Violet Nomad 1.30/1.39; Sage Nomad 1.60/1.69) → os dados de seed definem um único valor.
5. Texto "(-) 00.00" no desconto (dois zeros à esquerda e sem unidade) → formatar como "(-) 0.00 ETH" e documentar o desvio, ou reproduzir exatamente após confirmação.
6. O ícone do botão central da bottom nav é ambíguo (parece "scan"). A função não está definida.
7. Copyright "© 2026 Kurio" está legível só em parte.

## 11. Telas e estados sem referência
Lista e detalhe de **pedidos** e status em tempo real; páginas Mercado, Criadores e Aprenda; abas do perfil além de Dados e Carteiras; perfil mobile; sheet de filtros mobile; busca; favoritos; carrinho vazio; loading/skeleton; estados de erro; toasts; confirmação de compra concluída; 404. Esses itens serão derivados dos tokens e componentes acima e marcados como "derivado — sem referência" no código e na documentação.
