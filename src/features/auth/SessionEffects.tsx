/**
 * Efeitos globais da sessão (montados uma vez, dentro do Router):
 *
 * 1. Limpeza do cache privado (ACC-05 / ELIM-04): a cada troca de sessão (login, logout,
 *    expiração, troca de usuário), requisições privadas pendentes são CANCELADAS (o Axios
 *    aborta o HTTP) e todo o cache `['me', …]` e da sessão é removido.
 * 2. Expiração (ACC-04): se a API recusar o token numa rota privada ou durante uma ação, leva ao login com `?redirect=` da rota
 *    atual e `motivo=expirada` (a intenção, ex.: favoritar, já foi guardada). Em página pública sem ação pendente, segue como visitante com um aviso.
 * 3. Retomada da intenção: depois do login, executa a ação pendente (ex.: favoritar).
 * 4. Carrinho de visitante: mesclado no do usuário logo após o login (regra no servidor).
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
import { guestCart } from '@/features/cart/guestCart'
import { useMergeGuestCart } from '@/features/cart/queries'

export function SessionEffects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useClientSession()
  const toggleFavorite = useToggleFavorite()
  const mergeCart = useMergeGuestCart()
  const currentHref = useEffectEvent(() => location.href)

  // 1 + 2: reage a TODA mudança de sessão.
  useEffect(() => {
    const onChange = () => {
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
    }
    return sessionStore.subscribe(onChange)
  }, [qc, navigate])

  // 3: retoma a intenção pendente quando há sessão.
  const resumed = useRef<number | null>(null)
  const resume = useEffectEvent(() => {
    const intent = peekIntent()
    if (!intent || resumed.current === intent.createdAt) return
    resumed.current = intent.createdAt
    clearIntent()
    if (intent.kind === 'favorite') toggleFavorite.mutate({ nftId: intent.nftId, next: intent.next, name: intent.name })
    // 'checkout': NUNCA reenvia uma compra sozinho. O login já volta para /pagamento (redirect)
    // e o rascunho do formulário é restaurado; a pessoa confirma de novo.
  })
  // 4 (CP5): carrinho de visitante → carrinho do usuário, uma vez por id de visitante.
  const merge = useEffectEvent((userId: string) => {
    const guestCartId = guestCart.peek()
    if (guestCartId && !mergeCart.isPending) mergeCart.mutate({ guestCartId, userId })
  })
  useEffect(() => {
    if (!session) return
    merge(session.userId)
    resume()
  }, [session])

  return null
}
