/**
 * Conta (ACC-06 / ACC-07): perfil, avatar, senha e carteiras.
 *
 * Fluxo: UI → TanStack Query → Axios → MSW. Regras:
 * - Cache privado sempre sob ['me', userId, …] (isolamento por usuário; SessionEffects
 *   cancela e descarta tudo na troca de sessão).
 * - Mutações NÃO são otimistas: o cache só muda com a resposta da API, e a mensagem de
 *   sucesso só aparece depois dela (requisito do CP4).
 * - Respostas parseadas com os contratos zod (o mesmo schema que o mock valida).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { Profile, Wallet, WalletList, type PasswordChange, type ProfileUpdate, type WalletInput } from '@/api/contracts'
import { useClientSession } from '@/features/auth/queries'

function useUserId() {
  return useClientSession()?.userId ?? 'anonymous'
}

export function useProfile() {
  const session = useClientSession()
  return useQuery({
    queryKey: queryKeys.me.profile(session?.userId ?? 'anonymous'),
    enabled: !!session,
    queryFn: async ({ signal }) => Profile.parse((await http.get('/me/profile', { signal })).data),
  })
}

/** Grava o perfil devolvido pela API e atualiza o usuário da sessão (header/avatar). */
function useStoreProfile() {
  const qc = useQueryClient()
  const userId = useUserId()
  return (profile: Profile) => {
    qc.setQueryData(queryKeys.me.profile(userId), profile)
    void qc.invalidateQueries({ queryKey: queryKeys.session })
  }
}

export function useUpdateProfile() {
  const store = useStoreProfile()
  return useMutation({
    mutationFn: async (body: ProfileUpdate) => Profile.parse((await http.put('/me/profile', body)).data),
    onSuccess: store,
  })
}

export function useUploadAvatar() {
  const store = useStoreProfile()
  return useMutation({
    mutationFn: async (dataUrl: string) => Profile.parse((await http.put('/me/avatar', { dataUrl })).data),
    onSuccess: store,
  })
}

export function useRemoveAvatar() {
  const store = useStoreProfile()
  return useMutation({
    mutationFn: async () => Profile.parse((await http.delete('/me/avatar')).data),
    onSuccess: store,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: PasswordChange) => {
      await http.put('/me/password', body)
    },
  })
}

// ---------- Carteiras (contrato pronto para o checkout do CP5) ----------

export function useWallets() {
  const session = useClientSession()
  return useQuery({
    queryKey: queryKeys.me.wallets(session?.userId ?? 'anonymous'),
    enabled: !!session,
    queryFn: async ({ signal }) => WalletList.parse((await http.get('/me/wallets', { signal })).data).items,
  })
}

/** Principal primeiro; usado pela tela de carteiras e pelo checkout (CP5). */
export function sortWallets(items: Wallet[]) {
  return [...items].sort((a, b) => Number(b.primary) - Number(a.primary))
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const key = queryKeys.me.wallets(useUserId())
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: WalletInput }) =>
      Wallet.parse((id ? await http.put(`/me/wallets/${encodeURIComponent(id)}`, input) : await http.post('/me/wallets', input)).data),
    onSuccess: (wallet) => {
      qc.setQueryData<Wallet[]>(key, (old) => {
        const list = old ?? []
        return list.some((w) => w.id === wallet.id) ? list.map((w) => (w.id === wallet.id ? wallet : w)) : [...list, wallet]
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useSetPrimaryWallet() {
  const qc = useQueryClient()
  const key = queryKeys.me.wallets(useUserId())
  return useMutation({
    mutationFn: async (id: string) => WalletList.parse((await http.post(`/me/wallets/${encodeURIComponent(id)}/primary`)).data).items,
    onSuccess: (items) => qc.setQueryData(key, items),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
