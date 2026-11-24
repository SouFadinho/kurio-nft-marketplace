/**
 * Queries do catálogo (TanStack Query + Axios → MSW).
 *
 * - A query key contém os parâmetros normalizados: trocar um filtro cria outra consulta,
 *   e a resposta atrasada da consulta anterior cai no cache DELA, nunca na tela atual
 *   (respostas fora de ordem: CAT-03/INT-07).
 * - O `signal` do Query é repassado ao Axios: quando uma consulta deixa de ter
 *   observadores, a requisição HTTP é cancelada.
 * - `keepPreviousData`: durante a troca de página ou filtro, a grade anterior continua
 *   visível (marcada como "atualizando"), sem piscar nem deslocar o layout.
 */
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Highlights, NftDetail, NftList, type CatalogParams } from '@/api/contracts'
import { ApiError } from '@/api/http'

/** Remove valores vazios para que parâmetros equivalentes gerem a mesma query key. */
export function normalizeParams(params: CatalogParams): CatalogParams {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) out[k] = v
  return out as CatalogParams
}

export const nftListQuery = (params: CatalogParams = {}) => {
  const p = normalizeParams(params)
  return queryOptions({
    queryKey: queryKeys.nfts.list(p),
    queryFn: async ({ signal }) => NftList.parse((await http.get('/nfts', { params: p, signal })).data),
    placeholderData: keepPreviousData,
  })
}

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: async ({ signal }) => NftDetail.parse((await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })).data),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })

export const highlightsQuery = () =>
  queryOptions({
    queryKey: queryKeys.nfts.highlights,
    queryFn: async ({ signal }) => Highlights.parse((await http.get('/highlights', { signal })).data),
    staleTime: 5 * 60_000,
  })

export const useNftList = (params: CatalogParams = {}) => useQuery(nftListQuery(params))
