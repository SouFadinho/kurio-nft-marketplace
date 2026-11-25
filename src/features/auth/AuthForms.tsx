/**
 * Formulários de login e cadastro (TELA-06 / TELA-07), usados no modal desktop e na tela mobile.
 *
 * - Validação no cliente com os MESMOS schemas do mock (contracts.ts); erros da API (401, 409,
 *   422, rede) aparecem no campo certo ou no topo do formulário.
 * - Envio duplicado impedido: o botão fica desabilitado e o submit ignora cliques durante o envio.
 * - Login social: visualmente presente (Figma), mas informa claramente que não está disponível
 *   na demonstração; não há autenticação social real.
 */
import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { LoginRequest, PASSWORD_HINT, RegisterRequest } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UNAVAILABLE_MESSAGE } from '@/components/kurio/basics'
import { Field, FormAlert, PasswordInput, apiErrorMessage, useFocusFirstInvalid, zodFieldErrors, type FieldErrors } from '@/components/kurio/form'
import { useLogin, useRegister } from './queries'

/** Ícone "G" simplificado (não é o logotipo oficial; ver ASSETS_MANIFEST). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" fill="#FBBC05" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" fill="#EA4335" />
    </svg>
  )
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.5l.5-3h-3V9c0-.6.4-1 1-1Z" fill="#1877F2" />
    </svg>
  )
}

export function SocialButtons() {
  const notAvailable = (provider: string) => toast.info(UNAVAILABLE_MESSAGE, { description: `O login com ${provider} não faz parte desta demonstração. Use e-mail e senha.` })
  const cls = 'w-full justify-center gap-3 border-border-strong text-caption font-normal text-foreground hover:bg-surface-2'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-caption text-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border-strong" />
        Ou continue com
        <span className="h-px flex-1 bg-border-strong" />
      </div>
      <Button type="button" variant="outline" className={cls} aria-label="Continuar com Google (indisponível na demonstração)" onClick={() => notAvailable('Google')}>
        <GoogleIcon /> Continuar com Google
      </Button>
      <Button type="button" variant="outline" className={cls} aria-label="Continuar com Facebook (indisponível na demonstração)" onClick={() => notAvailable('Facebook')}>
        <FacebookGlyph /> Continuar com Facebook
      </Button>
    </div>
  )
}

export function LoginForm({ onSuccess, expired = false, redirect }: { onSuccess: () => void; expired?: boolean; redirect?: string }) {
  const login = useLogin()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  useFocusFirstInvalid(formRef, errors)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (login.isPending) return
    const data = new FormData(e.currentTarget)
    const parsed = LoginRequest.safeParse({ email: data.get('email'), password: data.get('password') })
    setFormError(null)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    login.mutate(parsed.data, {
      onSuccess,
      onError: (error) => setFormError(error instanceof ApiError && error.status === 401 ? 'E-mail ou senha inválidos.' : apiErrorMessage(error)),
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Entrar">
      {expired && <FormAlert tone="info">Sua sessão expirou. Entre novamente para continuar de onde parou.</FormAlert>}
      {formError && <FormAlert>{formError}</FormAlert>}
      <Field label="E-mail" error={errors.email} required>
        {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" placeholder="contato@email.com" />}
      </Field>
      <Field label="Senha" error={errors.password} required>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" placeholder="••••••••" />}
      </Field>
      <button
        type="button"
        className="-mt-2 self-end text-caption text-price underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => toast.info(UNAVAILABLE_MESSAGE, { description: 'A recuperação de senha não faz parte desta demonstração.' })}
      >
        Esqueceu a senha?
      </button>
      <Button type="submit" size="lg" disabled={login.isPending} className="mt-2 h-14 w-full rounded-lg lg:mt-0 lg:h-11 lg:rounded-xs">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      <SocialButtons />
      <p className="text-center text-caption text-foreground">
        Novo na Kurio?{' '}
        <Link to="/cadastro" search={{ redirect }} className="text-price underline underline-offset-4 hover:decoration-2">
          Crie uma conta
        </Link>
      </p>
    </form>
  )
}

export function RegisterForm({ onSuccess, redirect }: { onSuccess: () => void; redirect?: string }) {
  const register = useRegister()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  useFocusFirstInvalid(formRef, errors)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (register.isPending) return
    const data = new FormData(e.currentTarget)
    const parsed = RegisterRequest.safeParse({
      username: data.get('username'),
      email: data.get('email'),
      password: data.get('password'),
      confirmPassword: data.get('confirmPassword'),
    })
    setFormError(null)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    register.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Conta criada. Boas-vindas à Kurio!')
        onSuccess()
      },
      onError: (error) => {
        if (error instanceof ApiError && error.details) {
          setErrors(error.details)
          setFormError(error.code === 'CONFLICT' ? 'Alguns dados já estão em uso. Revise os campos destacados.' : error.message)
        } else setFormError(apiErrorMessage(error))
      },
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Criar conta">
      {formError && <FormAlert>{formError}</FormAlert>}
      <Field label="Nome de usuário" error={errors.username} hint="Letras minúsculas, números, ponto e sublinhado." required>
        {(p) => <Input {...p} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nome de usuário" />}
      </Field>
      <Field label="E-mail" error={errors.email} required>
        {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Digite seu e-mail" />}
      </Field>
      <Field label="Senha" error={errors.password} hint={PASSWORD_HINT} required>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" placeholder="Senha" />}
      </Field>
      <Field label="Confirmar senha" error={errors.confirmPassword} required>
        {(p) => <PasswordInput {...p} name="confirmPassword" autoComplete="new-password" placeholder="Confirmar senha" />}
      </Field>
      <Button type="submit" size="lg" disabled={register.isPending} className="mt-2 h-14 w-full rounded-lg lg:mt-0 lg:h-11 lg:rounded-xs">
        {register.isPending ? 'Criando conta…' : 'Criar perfil'}
      </Button>
      <SocialButtons />
      <p className="text-center text-caption text-foreground">
        Já tem uma conta?{' '}
        <Link to="/login" search={{ redirect }} className="text-price underline underline-offset-4 hover:decoration-2">
          Entre
        </Link>
      </p>
    </form>
  )
}
