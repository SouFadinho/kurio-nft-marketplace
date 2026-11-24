/**
 * Conteúdo editorial e de marketing da página inicial (textos de interface, não dados de
 * negócio: preço, estoque e catálogo vêm da API).
 *
 * Textos legíveis nas capturas foram reproduzidos. Trechos ILEGÍVEIS na resolução das
 * capturas (corpo dos banners e resumos do "Diário da Cunhagem") foram redigidos no mesmo
 * tom e documentados como derivados em planning/CP3_REPORT.md.
 */
export const HERO = {
  eyebrow: 'Bem-vindo à Kurio',
  desktop: {
    titleLines: ['Seja dono do futuro', 'da arte digital'],
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha sua parte da cultura da internet.',
  },
  mobile: {
    titleLines: ['Seja dono da', 'cultura digital'],
    text: 'Descubra NFTs selecionados de criadores do mundo todo.',
  },
  cta: 'Explorar',
}

const art = (file: string) => `/assets/nfts/catalog/${file}.webp`

export const PROMO_BANNERS = [
  {
    id: 'genesis',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Coleções em edição limitada, cunhadas diretamente pelos criadores e verificadas na rede.',
    cta: 'Explorar',
    image: art('emerald-ape-original'),
    imageAlt: 'Macaco de óculos redondos e jaqueta college verde',
    search: { tab: 'new' as const },
  },
  {
    id: 'digital-art',
    title: 'Arte digital selecionada',
    text: 'Explore obras verificadas de artistas digitais, com procedência e royalties transparentes.',
    cta: 'Explore agora',
    image: art('ivory-baron-original'),
    imageAlt: 'Chimpanzé de blazer marfim e gola alta verde',
    search: { category: 'arte-digital' as const },
  },
]

export const DIARY = {
  title: 'Diário da Cunhagem',
  description: 'Histórias, guias e insights para colecionadores e amantes da propriedade digital.',
  posts: [
    { id: 'propriedade', date: '12 de setembro', read: 'Leitura de 5 min', title: 'Como funciona a propriedade de NFTs', excerpt: 'Entenda o que você realmente possui ao comprar um NFT e como a rede registra isso.', image: art('ivory-baron-areia-esp'), imageAlt: 'Chimpanzé de blazer marfim sobre fundo areia' },
    { id: 'artistas', date: '05 de setembro', read: 'Leitura de 4 min', title: '10 artistas digitais para acompanhar', excerpt: 'Criadores que estão moldando a cultura digital e as coleções da temporada.', image: art('emerald-ape-salvia-esp'), imageAlt: 'Macaco de óculos redondos sobre fundo sálvia' },
    { id: 'raridade', date: '29 de agosto', read: 'Leitura de 6 min', title: 'Raridade, atributos e procedência', excerpt: 'Grandes detalhes, procedência e por que eles importam para colecionadores.', image: art('sage-nomad-ceu-esp'), imageAlt: 'Gorila de chapéu bucket sobre fundo céu' },
    { id: 'carteira', date: '22 de agosto', read: 'Leitura de 3 min', title: 'Como proteger sua carteira', excerpt: 'Práticas simples de segurança para colecionar com tranquilidade.', image: art('golden-beat-creme-esp'), imageAlt: 'Orangotango com fones de ouvido sobre fundo creme' },
  ],
}
