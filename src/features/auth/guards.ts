import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { sessionStore } from './sessionStore'

/**
 * Guard de rotas privadas (ACC-02). Usado em `beforeLoad`.
 * Sem sessão: vai ao login preservando o destino (o login só aceita caminhos internos).
 */
export function requireAuth({ location }: { location: ParsedLocation }) {
  if (!sessionStore.get()) throw redirect({ to: '/login', search: { redirect: location.href } })
}
