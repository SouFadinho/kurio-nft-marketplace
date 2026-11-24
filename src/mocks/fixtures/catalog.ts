/**
 * Catálogo determinístico do mock (CP3). Fonte única dos NFTs: o seed do db e o script
 * de artes (scripts/assets/build-variants.mjs) leem ESTE arquivo.
 * Sem imports com alias, para o Node conseguir importar direto (type stripping).
 *
 * Os 9 primeiros NFTs reproduzem a primeira página do Figma (Desktop / Início), na mesma
 * ordem de "Listados recentemente" e com os mesmos preços. Os demais mantêm a identidade
 * artística (mesmos personagens, variação do traço "Fundo").
 */

export type CategoryId = 'arte-digital' | 'fotografia' | 'musica' | 'arte-3d' | 'colecionaveis' | 'generativa' | 'jogos' | 'assinaturas' | 'utilidade'
export type NetworkId = 'ethereum' | 'polygon' | 'solana'
export type RarityId = 'common' | 'rare' | 'legendary'
export type Character = 'emerald-ape' | 'sage-nomad' | 'violet-nomad' | 'ivory-baron' | 'golden-beat'
export type Background = 'original' | 'creme' | 'salvia' | 'menta' | 'pessego' | 'ceu' | 'lilas' | 'areia'

/** Labels exatamente como na barra lateral do Figma ("Coleções"). */
export const CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
]

export const EDITION_LABEL = { 'ed-10': '1/10', 'ed-1': '1/1', 'ed-50': '1/50', 'ed-open': 'Aberta' } as const
export type EditionId = keyof typeof EDITION_LABEL

/** Modelos de edição (disponibilidade por edição). `null` = edição aberta sem limite de tiragem. */
const EDITIONS: Record<string, Array<{ id: EditionId; supply: number | null; available: number }>> = {
  figma: [
    { id: 'ed-10', supply: 10, available: 4 },
    { id: 'ed-1', supply: 1, available: 0 },
    { id: 'ed-50', supply: 50, available: 31 },
    { id: 'ed-open', supply: null, available: 120 },
  ],
  duo: [
    { id: 'ed-10', supply: 10, available: 6 },
    { id: 'ed-50', supply: 50, available: 18 },
  ],
  unique: [{ id: 'ed-1', supply: 1, available: 1 }],
  scarce: [
    { id: 'ed-10', supply: 10, available: 2 },
    { id: 'ed-open', supply: null, available: 60 },
  ],
  soldout: [
    { id: 'ed-50', supply: 50, available: 0 },
    { id: 'ed-open', supply: null, available: 0 },
  ],
  fifty: [{ id: 'ed-50', supply: 50, available: 25 }],
}

interface Seed {
  id: string
  name: string
  family: 'apes' | 'nomads' | 'barons' | 'sound'
  character: Character
  background: Background
  flip: boolean
  category: CategoryId
  network: NetworkId
  rarity: RarityId
  price: string
  previousPrice?: string
  editions: keyof typeof EDITIONS
}

const COLLECTION = { apes: 'Kurio Apes', nomads: 'Kurio Nomads', barons: 'Kurio Barons', sound: 'Kurio Sound' } as const

// prettier-ignore
const SEEDS: Seed[] = [
  // --- Página 1 do Figma (ordem e preços das referências) ---
  { id: 'nft-001', name: 'Emerald Ape #042', family: 'apes', character: 'emerald-ape', background: 'original', flip: false, category: 'arte-digital', network: 'ethereum', rarity: 'common', price: '1.19', editions: 'figma' },
  { id: 'nft-002', name: 'Sage Nomad #009', family: 'nomads', character: 'sage-nomad', background: 'original', flip: false, category: 'arte-digital', network: 'ethereum', rarity: 'common', price: '1.69', editions: 'duo' },
  { id: 'nft-003', name: 'Neon Vessel #552', family: 'barons', character: 'ivory-baron', background: 'ceu', flip: true, category: 'colecionaveis', network: 'polygon', rarity: 'rare', price: '1.99', previousPrice: '2.29', editions: 'unique' },
  { id: 'nft-004', name: 'Cosmic Bloom #118', family: 'nomads', character: 'violet-nomad', background: 'lilas', flip: true, category: 'generativa', network: 'polygon', rarity: 'common', price: '1.29', editions: 'scarce' },
  { id: 'nft-005', name: 'Violet Nomad #314', family: 'nomads', character: 'violet-nomad', background: 'original', flip: false, category: 'arte-digital', network: 'ethereum', rarity: 'common', price: '1.39', editions: 'duo' },
  { id: 'nft-006', name: 'Ivory Baron #088', family: 'barons', character: 'ivory-baron', background: 'original', flip: false, category: 'colecionaveis', network: 'ethereum', rarity: 'common', price: '1.79', editions: 'duo' },
  { id: 'nft-007', name: 'Golden Beat #207', family: 'sound', character: 'golden-beat', background: 'original', flip: false, category: 'musica', network: 'solana', rarity: 'common', price: '0.99', editions: 'scarce' },
  { id: 'nft-008', name: 'Golden Frequency #071', family: 'sound', character: 'golden-beat', background: 'pessego', flip: true, category: 'musica', network: 'solana', rarity: 'common', price: '0.89', editions: 'soldout' },
  { id: 'nft-009', name: 'Golden Signal #160', family: 'sound', character: 'golden-beat', background: 'menta', flip: false, category: 'musica', network: 'ethereum', rarity: 'common', price: '0.39', editions: 'fifty' },
  // --- Demais NFTs (identidade KURIO; variação de fundo) ---
  { id: 'nft-010', name: 'Amber Ape #133', family: 'apes', character: 'emerald-ape', background: 'pessego', flip: true, category: 'arte-3d', network: 'polygon', rarity: 'common', price: '0.72', editions: 'fifty' },
  { id: 'nft-011', name: 'Dusk Nomad #227', family: 'nomads', character: 'sage-nomad', background: 'ceu', flip: true, category: 'fotografia', network: 'ethereum', rarity: 'rare', price: '2.45', editions: 'duo' },
  { id: 'nft-012', name: 'Velvet Baron #145', family: 'barons', character: 'ivory-baron', background: 'lilas', flip: false, category: 'assinaturas', network: 'solana', rarity: 'common', price: '0.58', editions: 'scarce' },
  { id: 'nft-013', name: 'Golden Echo #098', family: 'sound', character: 'golden-beat', background: 'ceu', flip: true, category: 'musica', network: 'polygon', rarity: 'legendary', price: '12.30', editions: 'unique' },
  { id: 'nft-014', name: 'Cobalt Ape #271', family: 'apes', character: 'emerald-ape', background: 'ceu', flip: false, category: 'jogos', network: 'ethereum', rarity: 'rare', price: '3.15', editions: 'duo' },
  { id: 'nft-015', name: 'Moss Nomad #350', family: 'nomads', character: 'sage-nomad', background: 'salvia', flip: false, category: 'utilidade', network: 'polygon', rarity: 'common', price: '0.31', editions: 'fifty' },
  { id: 'nft-016', name: 'Marble Baron #233', family: 'barons', character: 'ivory-baron', background: 'creme', flip: true, category: 'arte-digital', network: 'ethereum', rarity: 'common', price: '1.05', editions: 'scarce' },
  { id: 'nft-017', name: 'Golden Tempo #251', family: 'sound', character: 'golden-beat', background: 'lilas', flip: false, category: 'musica', network: 'ethereum', rarity: 'common', price: '0.64', editions: 'duo' },
  { id: 'nft-018', name: 'Olive Ape #305', family: 'apes', character: 'emerald-ape', background: 'salvia', flip: true, category: 'colecionaveis', network: 'solana', rarity: 'common', price: '0.88', editions: 'soldout' },
  { id: 'nft-019', name: 'Lilac Nomad #061', family: 'nomads', character: 'violet-nomad', background: 'pessego', flip: false, category: 'generativa', network: 'solana', rarity: 'common', price: '0.47', editions: 'scarce' },
  { id: 'nft-020', name: 'Slate Baron #317', family: 'barons', character: 'ivory-baron', background: 'areia', flip: true, category: 'jogos', network: 'polygon', rarity: 'rare', price: '2.80', editions: 'unique' },
  { id: 'nft-021', name: 'Golden Chorus #333', family: 'sound', character: 'golden-beat', background: 'areia', flip: true, category: 'musica', network: 'ethereum', rarity: 'common', price: '1.12', editions: 'fifty' },
  { id: 'nft-022', name: 'Rose Ape #412', family: 'apes', character: 'emerald-ape', background: 'lilas', flip: true, category: 'arte-digital', network: 'ethereum', rarity: 'legendary', price: '8.40', editions: 'unique' },
  { id: 'nft-023', name: 'Desert Nomad #184', family: 'nomads', character: 'sage-nomad', background: 'areia', flip: true, category: 'fotografia', network: 'polygon', rarity: 'common', price: '0.93', editions: 'duo' },
  { id: 'nft-024', name: 'Pearl Baron #029', family: 'barons', character: 'ivory-baron', background: 'pessego', flip: false, category: 'assinaturas', network: 'ethereum', rarity: 'common', price: '0.27', editions: 'fifty' },
  { id: 'nft-025', name: 'Golden Remix #019', family: 'sound', character: 'golden-beat', background: 'salvia', flip: true, category: 'musica', network: 'solana', rarity: 'rare', price: '1.85', editions: 'scarce' },
  { id: 'nft-026', name: 'Onyx Ape #078', family: 'apes', character: 'emerald-ape', background: 'areia', flip: false, category: 'arte-3d', network: 'polygon', rarity: 'common', price: '0.55', editions: 'scarce' },
  { id: 'nft-027', name: 'Cloud Nomad #402', family: 'nomads', character: 'violet-nomad', background: 'ceu', flip: false, category: 'utilidade', network: 'ethereum', rarity: 'common', price: '0.16', editions: 'fifty' },
  { id: 'nft-028', name: 'Ember Baron #466', family: 'barons', character: 'ivory-baron', background: 'salvia', flip: true, category: 'colecionaveis', network: 'solana', rarity: 'legendary', price: '6.75', editions: 'unique' },
  { id: 'nft-029', name: 'Golden Static #444', family: 'sound', character: 'golden-beat', background: 'creme', flip: true, category: 'jogos', network: 'polygon', rarity: 'common', price: '0.42', editions: 'soldout' },
  { id: 'nft-030', name: 'Citrus Ape #156', family: 'apes', character: 'emerald-ape', background: 'menta', flip: true, category: 'utilidade', network: 'ethereum', rarity: 'common', price: '0.36', editions: 'fifty' },
  { id: 'nft-031', name: 'Harbor Nomad #276', family: 'nomads', character: 'sage-nomad', background: 'menta', flip: true, category: 'arte-3d', network: 'solana', rarity: 'common', price: '0.81', editions: 'scarce' },
  { id: 'nft-032', name: 'Copper Baron #198', family: 'barons', character: 'ivory-baron', background: 'menta', flip: false, category: 'arte-digital', network: 'polygon', rarity: 'common', price: '1.33', editions: 'duo' },
  { id: 'nft-033', name: 'Golden Riff #175', family: 'sound', character: 'golden-beat', background: 'pessego', flip: false, category: 'assinaturas', network: 'ethereum', rarity: 'common', price: '0.05', editions: 'fifty' },
  { id: 'nft-034', name: 'Saffron Ape #389', family: 'apes', character: 'emerald-ape', background: 'creme', flip: true, category: 'generativa', network: 'solana', rarity: 'rare', price: '2.10', editions: 'scarce' },
  { id: 'nft-035', name: 'Indigo Nomad #052', family: 'nomads', character: 'violet-nomad', background: 'menta', flip: true, category: 'jogos', network: 'polygon', rarity: 'common', price: '0.69', editions: 'duo' },
  { id: 'nft-036', name: 'Golden Pulse #120', family: 'sound', character: 'golden-beat', background: 'lilas', flip: true, category: 'fotografia', network: 'ethereum', rarity: 'common', price: '0.24', editions: 'fifty' },
]

const DESCRIPTION: Record<Seed['family'], string> = {
  apes: 'finalizado à mão da coleção Kurio Apes, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores',
  nomads: 'da coleção Kurio Nomads, retrato de viajantes da rede, com metadados imutáveis e procedência registrada',
  barons: 'da coleção Kurio Barons, retrato formal com acabamento em alta resolução e histórico de procedência verificado',
  sound: 'da coleção Kurio Sound, com faixa exclusiva desbloqueável para colecionadores e royalties automáticos para o artista',
}

const ATTRIBUTES: Record<Character, string[]> = {
  'emerald-ape': ['Óculos', 'Jaqueta college', 'Colar'],
  'sage-nomad': ['Chapéu bucket', 'Moletom', 'Sorriso'],
  'violet-nomad': ['Chapéu bucket', 'Moletom roxo'],
  'ivory-baron': ['Blazer', 'Gola alta'],
  'golden-beat': ['Fones de ouvido', 'Jaqueta'],
}

const BG_LABEL: Record<Background, string> = {
  original: 'Original',
  creme: 'Creme',
  salvia: 'Sálvia',
  menta: 'Menta',
  pessego: 'Pêssego',
  ceu: 'Céu',
  lilas: 'Lilás',
  areia: 'Areia',
}

const FIGMA_RATING: Record<string, { rating: number; count: number }> = { 'nft-001': { rating: 4.8, count: 19 } }

const REFERENCE_DATE = Date.parse('2026-11-20T12:00:00Z')
const HOUR = 3_600_000

/** Arquivo da arte de cada NFT (gerado por scripts/assets/build-variants.mjs). */
export const artFile = (s: Pick<Seed, 'character' | 'background' | 'flip'>) => `${s.character}-${s.background}${s.flip ? '-esp' : ''}`

export const ART_SPECS = SEEDS.map((s) => ({ file: artFile(s), character: s.character, background: s.background, flip: s.flip, gallery: true }))

export interface CatalogNft {
  id: string
  name: string
  collection: string
  category: CategoryId
  network: NetworkId
  rarity: RarityId
  price: string
  previousPrice: string | null
  image: string
  gallery: string[]
  imageAlt: string
  listedAt: string
  popularity: number
  rating: number
  reviewsCount: number
  tokenId: string
  description: string
  attributes: string[]
  editions: Array<{ id: EditionId; label: string; supply: number | null; available: number }>
}

const ALT: Record<Character, string> = {
  'emerald-ape': 'Macaco de pelo castanho com óculos redondos de lentes verdes e jaqueta college',
  'sage-nomad': 'Gorila cinza com chapéu bucket verde-oliva e moletom roxo',
  'violet-nomad': 'Gorila cinza-escuro com chapéu bucket verde e moletom roxo',
  'ivory-baron': 'Chimpanzé de pelo preto com blazer marfim e gola alta verde',
  'golden-beat': 'Orangotango de pelo dourado com fones de ouvido verdes e jaqueta creme',
}

export function buildCatalog(): CatalogNft[] {
  return SEEDS.map((s, i) => {
    const number = /#(\d+)/.exec(s.name)?.[1] ?? '0'
    const file = artFile(s)
    const bg = s.background === 'original' ? '' : `, fundo ${BG_LABEL[s.background].toLowerCase()}`
    const flipped = s.flip ? ', voltado para a esquerda' : ''
    return {
      id: s.id,
      name: s.name,
      collection: COLLECTION[s.family],
      category: s.category,
      network: s.network,
      rarity: s.rarity,
      price: s.price,
      previousPrice: s.previousPrice ?? null,
      image: `/assets/nfts/catalog/${file}.webp`,
      gallery: [`/assets/nfts/catalog/${file}.webp`, `/assets/nfts/catalog/${file}-detalhe.webp`],
      imageAlt: `${ALT[s.character]}${bg}${flipped}`,
      listedAt: new Date(REFERENCE_DATE - i * 36 * HOUR).toISOString(),
      popularity: (i * 37 + 11) % 100,
      // Emerald Ape #042 reproduz o Figma: 4.8 (19 avaliações).
      rating: FIGMA_RATING[s.id]?.rating ?? Math.round((3.9 + ((i * 7) % 11) / 10) * 10) / 10,
      reviewsCount: FIGMA_RATING[s.id]?.count ?? 4 + ((i * 5) % 23),
      tokenId: `#${number.padStart(4, '0')}`,
      description: `Um colecionável digital ${DESCRIPTION[s.family]}.`,
      attributes: [...ATTRIBUTES[s.character], BG_LABEL[s.background] === 'Original' ? 'Fundo clássico' : `Fundo ${BG_LABEL[s.background].toLowerCase()}`],
      editions: EDITIONS[s.editions]!.map((e) => ({ ...e, label: EDITION_LABEL[e.id] })),
    }
  })
}

/** Destaques (hero e "NFT em destaque / Oferta limitada"). */
export const HIGHLIGHTS = { hero: ['nft-001', 'nft-002', 'nft-007'], limitedOffer: 'nft-004' }

/** Data de corte de "Novos lançamentos" (determinística). */
export const NEW_RELEASE_SINCE = new Date(REFERENCE_DATE - 10 * 24 * HOUR).toISOString()
/** Limiar de "Em alta". */
export const TRENDING_MIN_POPULARITY = 60
