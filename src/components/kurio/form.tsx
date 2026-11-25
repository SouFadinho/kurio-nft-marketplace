/**
 * Peças de formulário acessíveis do KURIO.
 * - Rótulo visível sempre associado ao campo (o Figma usa só placeholder: desvio documentado
 *   em favor de "labels e mensagens de erro associadas aos campos", CHALLENGE §8).
 * - Erro ligado ao campo por `aria-describedby` + `aria-invalid`; dica idem.
 * - Obrigatório: asterisco laranja (como no Figma) + `aria-required`.
 */
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useId, useState, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { ApiError } from '@/api/http'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type FieldErrors = Partial<Record<string, string>>

export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; 'aria-required'?: true }) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* O asterisco fica FORA do <label>: o nome acessível e o texto do rótulo são só o nome do campo. */}
      <div className="flex items-baseline gap-1 text-caption font-semibold text-foreground">
        <label htmlFor={id}>{label}</label>
        {required && (
          <span className="text-price" aria-hidden>
            *
          </span>
        )}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Campo de senha com botão "Mostrar/Ocultar senha" (Figma: ícone de olho). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-full text-placeholder hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:size-8"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

/** Mensagem de erro do formulário inteiro (ex.: "E-mail ou senha inválidos"). */
export function FormAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <p role="alert" className={cn('rounded-xs px-3 py-2 text-caption', tone === 'error' ? 'bg-destructive-surface text-destructive' : 'border border-primary/40 bg-primary/10 text-price')}>
      {children}
    </p>
  )
}

/** Converte o resultado do zod em erros por campo (primeiro erro de cada campo). */
export function zodFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const out: FieldErrors = {}
  for (const i of issues) {
    const key = String(i.path[0] ?? 'form')
    out[key] ??= i.message
  }
  return out
}

/** Foca o primeiro campo com erro (ordem do DOM). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}

/** Mensagem legível para falhas de rede/servidor (os erros de campo vêm em `details`). */
export function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
    if (error.code === 'TIMEOUT') return 'O servidor demorou para responder. Tente novamente.'
    return error.message
  }
  return 'Ocorreu um erro inesperado. Tente novamente.'
}

/** Classes do <select> nativo no mesmo estilo do Input (acessível e amigável ao teclado mobile). */
export const selectClass =
  'h-12 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%23c9a27e%27 stroke-width=%272%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat px-4 pr-10 font-mono text-body text-foreground outline-none transition-[border-color,box-shadow] hover:border-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgb(210_138_76/0.25)] aria-invalid:border-destructive disabled:opacity-50 lg:h-10 lg:rounded-xs lg:px-3 [&_option]:bg-surface'

/**
 * Foca o primeiro campo inválido DEPOIS que o React renderiza os erros. Funciona tanto para a
 * validação no submit quanto para erros que chegam da API (callback assíncrono), em que um
 * microtask rodaria antes do commit.
 */
export function useFocusFirstInvalid(formRef: RefObject<HTMLFormElement | null>, errors: FieldErrors) {
  useEffect(() => {
    if (Object.keys(errors).length > 0) focusFirstInvalid(formRef.current)
  }, [formRef, errors])
}
