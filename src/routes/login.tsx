import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginRequest } from '@/api/contracts'
import { useLogin } from '@/features/auth/queries'
import { sessionStore } from '@/features/auth/sessionStore'

/** Aceita apenas caminhos internos ("/x"), nunca "//host" ou URLs absolutas (open redirect). */
const SafeRedirect = z
  .string()
  .regex(/^\/(?!\/)/)
  .optional()
  .catch(undefined)

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: SafeRedirect }),
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ to: search.redirect ?? '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password', string>>>({})

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = LoginRequest.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] })
      return
    }
    setErrors({})
    login.mutate(parsed.data, { onSuccess: () => void navigate({ to: target ?? '/' }) })
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1>Entrar</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-3">
          <label className="grid gap-1 text-sm">
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="rounded border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.email && <p id="email-error" className="text-sm text-price">{errors.email}</p>}
          <label className="grid gap-1 text-sm">
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="rounded border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.password && <p id="password-error" className="text-sm text-price">{errors.password}</p>}
          {login.isError && <p role="alert" className="text-sm text-price">{login.error.message}</p>}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
