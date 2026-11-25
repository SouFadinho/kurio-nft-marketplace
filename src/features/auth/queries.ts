/**
 * Sessão e autenticação (TanStack Query + Axios → MSW).
 * A limpeza do cache privado na troca de sessão é centralizada em SessionEffects.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { SessionResponse, User, type LoginRequest, type RegisterRequest } from '@/api/contracts'
import { sessionStore } from './sessionStore'

export function useClientSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

/** Sessão autoritativa: o token local só vale se a API confirmar (GET /auth/session). */
export function useSessionUser() {
  const session = useClientSession()
  return useQuery({
    queryKey: [...queryKeys.session, session?.userId ?? 'anonymous'],
    enabled: !!session,
    queryFn: async ({ signal }) => User.parse((await http.get('/auth/session', { signal })).data.user),
    staleTime: 60_000,
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async (body: LoginRequest) => SessionResponse.parse((await http.post('/auth/login', body)).data),
    onSuccess: (data) => sessionStore.set(data),
  })
}

/** Cadastro: a API cria a conta e já devolve a sessão (a pessoa segue de onde parou). */
export function useRegister() {
  return useMutation({
    mutationFn: async (body: RegisterRequest) => SessionResponse.parse((await http.post('/auth/register', body)).data),
    onSuccess: (data) => sessionStore.set(data),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await http.post('/auth/logout')
    },
    // Mesmo se a rede falhar, a sessão local termina (o token deixa de ser usado).
    onSettled: () => sessionStore.clear(),
  })
}
