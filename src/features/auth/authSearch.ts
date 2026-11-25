import { z } from 'zod'

/** Aceita apenas caminhos internos ("/x"), nunca "//host" ou URLs absolutas (open redirect). */
export const SafeRedirect = z
  .string()
  .regex(/^\/(?!\/)/)
  .optional()
  .catch(undefined)

export const AuthSearch = z.object({
  redirect: SafeRedirect,
  motivo: z.enum(['expirada']).optional().catch(undefined),
})

/** Prefixos de rotas privadas (perfil, carteiras, favoritos; checkout e pedidos no CP5/CP6). */
const PROTECTED_PREFIXES = ['/perfil', '/favoritos', '/checkout', '/pedidos']

/** Fechar o login sem entrar não pode voltar para uma rota privada (cairia no login de novo). */
export function isProtectedPath(href: string) {
  const path = href.split(/[?#]/)[0] ?? href
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}
