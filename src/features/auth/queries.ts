import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { http } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { SessionResponse, User, type LoginRequest } from '@/api/contracts'
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: LoginRequest) => SessionResponse.parse((await http.post('/auth/login', body)).data),
    onSuccess: (data) => {
      // Troca de usuário: nada da sessão anterior pode sobreviver no cache (ACC-05).
      queryClient.removeQueries({ queryKey: ['me'] })
      sessionStore.set(data)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await http.post('/auth/logout')
    },
    onSettled: () => {
      sessionStore.clear()
      queryClient.removeQueries({ queryKey: ['me'] })
      queryClient.removeQueries({ queryKey: queryKeys.session })
    },
  })
}
