/**
 * Favoritos (CAT-05): persistem por usuário na API simulada.
 *
 * Atualização OTIMISTA com rollback (INT-11):
 *  onMutate  → cancela consultas em andamento, guarda o snapshot e já aplica o novo estado;
 *  onError   → restaura o snapshot e informa a falha (toast acessível);
 *  onSettled → revalida com o servidor (fonte da verdade).
 * As mutations compartilham o escopo 'favorites': cliques rápidos são enviados em sequência,
 * sem corrida entre PUT e DELETE do mesmo item.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { FavoriteList } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

export function useFavorites() {
  const session = useClientSession()
  return useQuery({
    queryKey: queryKeys.me.favorites(session?.userId ?? 'anonymous'),
    enabled: !!session,
    queryFn: async ({ signal }) => FavoriteList.parse((await http.get('/favorites', { signal })).data),
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  const session = useClientSession()
  const key = queryKeys.me.favorites(session?.userId ?? 'anonymous')

  return useMutation({
    scope: { id: 'favorites' },
    mutationFn: async ({ nftId, next }: { nftId: string; next: boolean; name: string }) => {
      if (next) await http.put(`/favorites/${encodeURIComponent(nftId)}`)
      else await http.delete(`/favorites/${encodeURIComponent(nftId)}`)
    },
    onMutate: async ({ nftId, next }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoriteList>(key)
      qc.setQueryData<FavoriteList>(key, (old) => {
        const ids = old?.ids ?? []
        return { ids: next ? [nftId, ...ids.filter((i) => i !== nftId)] : ids.filter((i) => i !== nftId), items: (old?.items ?? []).filter((n) => next || n.id !== nftId) }
      })
      return { previous }
    },
    onError: (_error, { name, next }, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error(next ? `Não foi possível favoritar ${name}` : `Não foi possível remover ${name} dos favoritos`, {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      })
    },
    onSuccess: (_data, { name, next }) => {
      toast.success(next ? `${name} adicionado aos favoritos` : `${name} removido dos favoritos`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/**
 * Estado + ação de favoritar para um NFT. Visitante: leva ao login e volta para a mesma
 * página (favoritos exigem autenticação, ACC-02).
 */
export function useFavoriteAction() {
  const session = useClientSession()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const location = useLocation()

  return {
    isFavorite: (id: string) => favorites.data?.ids.includes(id) ?? false,
    pendingId: toggle.isPending ? toggle.variables?.nftId : undefined,
    toggle: (nft: { id: string; name: string }, next: boolean) => {
      if (!session) {
        void navigate({ to: '/login', search: { redirect: location.href } })
        return
      }
      toggle.mutate({ nftId: nft.id, next, name: nft.name })
    },
  }
}
