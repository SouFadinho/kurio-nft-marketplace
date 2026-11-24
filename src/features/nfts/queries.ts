import { queryOptions, useQuery } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Nft, NftList } from '@/api/contracts'

export const nftListQuery = () =>
  queryOptions({
    queryKey: queryKeys.nfts.list(),
    queryFn: async ({ signal }) => NftList.parse((await http.get('/nfts', { signal })).data),
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: async ({ signal }) => Nft.parse((await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })).data),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })

export const useNftList = () => useQuery(nftListQuery())
