/**
 * Estado do catálogo na URL (CAT-01): busca, filtros, aba, ordenação e página.
 *
 * - Validação: valores inválidos são DESCARTADOS (`.catch(undefined)`) em vez de quebrar a
 *   página. Ex.: `?network=bitcoin&page=-3` vira o catálogo padrão.
 * - O TanStack Router converte "0.5" e "2" da URL em números; por isso preços e busca
 *   aceitam número e são normalizados para string.
 * - Valores padrão (aba "todos", ordem "recentes", página 1) não aparecem na URL: links
 *   equivalentes são idênticos e compartilháveis.
 * - Faixa de preço invertida (mín > máx) é corrigida trocando os limites.
 */
import { z } from 'zod'
import { CatalogSort, CatalogTab, CategoryId, Network, type CatalogParams } from '@/api/contracts'
import { parseEth } from '@/lib/eth'

const priceString = z.coerce
  .string()
  .regex(/^\d+(\.\d{1,4})?$/)
  .optional()
  .catch(undefined)

const schema = z.object({
  q: z.coerce.string().trim().max(60).optional().catch(undefined),
  category: CategoryId.optional().catch(undefined),
  network: Network.optional().catch(undefined),
  minPrice: priceString,
  maxPrice: priceString,
  tab: CatalogTab.optional().catch(undefined),
  sort: CatalogSort.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof schema>

/**
 * IMPORTANTE: devolve TODAS as chaves conhecidas, com `undefined` quando inválidas ou padrão.
 * O TanStack Router mescla o resultado sobre a query crua da URL (`{...crua, ...validada}`);
 * se uma chave inválida fosse apenas omitida, o valor cru "vazaria" para a página e para a
 * API (defeito encontrado no CP3: `?network=bitcoin` gerava 422).
 */
export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const s = schema.parse(raw)
  const inverted = s.minPrice && s.maxPrice && parseEth(s.minPrice) > parseEth(s.maxPrice)
  return {
    q: s.q || undefined,
    category: s.category,
    network: s.network,
    minPrice: inverted ? s.maxPrice : s.minPrice,
    maxPrice: inverted ? s.minPrice : s.maxPrice,
    tab: s.tab && s.tab !== 'all' ? s.tab : undefined,
    sort: s.sort && s.sort !== 'recent' ? s.sort : undefined,
    page: s.page && s.page > 1 ? s.page : undefined,
  }
}

/** Parâmetros da API a partir do estado da URL: só as chaves conhecidas, página sempre válida. */
export const toCatalogParams = (s: CatalogSearch): CatalogParams => ({
  q: s.q,
  category: s.category,
  network: s.network,
  minPrice: s.minPrice,
  maxPrice: s.maxPrice,
  tab: s.tab,
  sort: s.sort,
  page: s.page ?? 1,
})

/** Filtros ativos (para os chips de remoção individual). */
export const FILTER_KEYS = ['q', 'category', 'network', 'minPrice', 'maxPrice'] as const

export const hasActiveFilters = (s: CatalogSearch) => FILTER_KEYS.some((k) => s[k] !== undefined) || (s.tab ?? 'all') !== 'all'

export const SORT_LABEL: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
  name: 'Nome (A–Z)',
}

export const TAB_LABEL: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}
