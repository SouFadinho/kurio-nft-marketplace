/**
 * Efeitos globais da sessão (montados uma vez, dentro do Router):
 *
 * 1. Limpeza do cache privado (ACC-05 / ELIM-04): a cada troca de sessão (login, logout,
 *    expiração, troca de usuário), requisições privadas pendentes são CANCELADAS (o Axios
 *    aborta o HTTP) e todo o cache `['me', …]` e da sessão é removido.
 * 2. Expiração (ACC-04): se a API recusar o token numa rota privada ou durante uma ação, leva ao login com `?redirect=` da rota
 *    atual e `motivo=expirada` (a intenção, ex.: favoritar, já foi guardada). Em página pública sem ação pendente, segue como visitante com um aviso.
 * 3. Retomada da intenção: depois do login, executa a ação pendente (ex.: favoritar).
 */
import { useEffect, useEffectEvent, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { queryKeys } from '@/api/queryKeys'
import { useToggleFavorite } from '@/features/favorites/queries'
import { useClientSession } from './queries'
import { toast } from 'sonner'
import { isProtectedPath } from './authSearch'
import { clearIntent, peekIntent } from './intent'
import { sessionStore } from './sessionStore'

export function SessionEffects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useClientSession()
  const toggleFavorite = useToggleFavorite()
  const currentHref = useEffectEvent(() => location.href)

  // 1 + 2: reage a TODA mudança de sessão.
  useEffect(
    () =>
      sessionStore.subscribe(() => {
        void qc.cancelQueries({ queryKey: ['me'] })
        qc.removeQueries({ queryKey: ['me'] })
        qc.removeQueries({ queryKey: queryKeys.session })
        const href = currentHref()
        if (sessionStore.getEndReason() !== 'expired' || href.startsWith('/login') || href.startsWith('/cadastro')) return
        // Rota privada ou ação pendente (ex.: favoritar): login com aviso e retorno.
        // Página pública sem ação pendente: segue como visitante, com aviso e atalho para entrar.
        if (isProtectedPath(href) || peekIntent()) {
          void navigate({ to: '/login', search: { redirect: href, motivo: 'expirada' }, replace: true })
        } else {
          sessionStore.acknowledgeEnd()
          toast.info('Sua sessão expirou', {
            id: 'session-expired',
            description: 'Você continua navegando como visitante.',
            action: { label: 'Entrar', onClick: () => void navigate({ to: '/login', search: { redirect: href } }) },
          })
        }
      }),
    [qc, navigate],
  )

  // 3: retoma a intenção pendente quando há sessão.
  const resumed = useRef<number | null>(null)
  const resume = useEffectEvent(() => {
    const intent = peekIntent()
    if (!intent || resumed.current === intent.createdAt) return
    resumed.current = intent.createdAt
    clearIntent()
    if (intent.kind === 'favorite') toggleFavorite.mutate({ nftId: intent.nftId, next: intent.next, name: intent.name })
  })
  useEffect(() => {
    if (session) resume()
  }, [session])

  return null
}
