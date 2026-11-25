/**
 * Perfil do colecionador (TELA-08 / ACC-06).
 *
 * - Três formulários independentes (avatar, dados, senha). O Figma tem um único "Salvar";
 *   separar evita enviar a senha junto com o perfil e deixa claro o que falhou (desvio
 *   documentado em VISUAL_ANALYSIS).
 * - Dados TEMPORÁRIOS (o que está sendo digitado) ficam no formulário; dados PERSISTIDOS vêm
 *   do cache da query. O formulário é remontado (key = version) só quando a API confirma uma
 *   nova versão; "Descartar alterações" volta aos dados persistidos.
 * - Sucesso só depois da resposta da API (toast + aviso no formulário).
 */
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, PASSWORD_HINT, PasswordChange, ProfileUpdate, type Profile } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/kurio/states'
import { Field, FormAlert, PasswordInput, apiErrorMessage, useFocusFirstInvalid, zodFieldErrors, type FieldErrors } from '@/components/kurio/form'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from './queries'

export function ProfilePage() {
  const profile = useProfile()

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando perfil">
        <Skeleton className="h-20 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (profile.isError) {
    return <ErrorState title="Não foi possível carregar seu perfil" message={apiErrorMessage(profile.error)} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
  }

  const data = profile.data
  return (
    <div className="flex flex-col gap-10">
      <AvatarSection profile={data} />
      <ProfileForm key={data.version} profile={data} />
      <PasswordForm />
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function AvatarSection({ profile }: { profile: Profile }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = upload.isPending || remove.isPending

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    setError(null)
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return setError('Formato não suportado. Use PNG, JPEG ou WebP.')
    if (file.size > AVATAR_MAX_BYTES) return setError('A imagem excede 512 KB. Escolha um arquivo menor.')
    upload.mutate(await readAsDataUrl(file), {
      onSuccess: () => toast.success('Foto de perfil atualizada'),
      onError: (err) => setError(err instanceof ApiError && err.details?.avatar ? err.details.avatar : `Não foi possível enviar a foto. ${apiErrorMessage(err)}`),
    })
  }

  const onRemove = () => {
    setError(null)
    remove.mutate(undefined, {
      onSuccess: () => toast.success('Foto de perfil removida'),
      onError: (err) => setError(`Não foi possível remover a foto. ${apiErrorMessage(err)}`),
    })
  }

  return (
    <section aria-labelledby="avatar-title" className="flex flex-col gap-3">
      <h2 id="avatar-title" className="text-title-3 font-bold">
        Foto de perfil
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border-strong bg-surface-2 text-title-2 font-bold text-price">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`Foto de perfil de ${profile.displayName}`} className="size-full object-cover" /> : <span aria-hidden>{initials(profile.displayName)}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id="avatar-file"
              type="file"
              accept={AVATAR_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void onFile(e)}
              data-testid="avatar-input"
            />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby="avatar-hint">
              {upload.isPending ? 'Enviando…' : 'Enviar foto'}
            </Button>
            {profile.avatarUrl && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
                {remove.isPending ? 'Removendo…' : 'Remover'}
              </Button>
            )}
          </div>
          <p id="avatar-hint" className="text-caption text-muted-foreground">
            PNG, JPEG ou WebP, até 512 KB. Envio simulado: a imagem fica salva na API de demonstração.
          </p>
        </div>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
    </section>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  useFocusFirstInvalid(formRef, errors)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (update.isPending) return
    const data = new FormData(e.currentTarget)
    const parsed = ProfileUpdate.safeParse({
      displayName: data.get('displayName'),
      username: data.get('username'),
      email: data.get('email'),
      walletNickname: data.get('walletNickname'),
    })
    setFormError(null)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    // Com sucesso, o formulário é remontado com a nova versão (key) → valores persistidos.
    // mutateAsync: a promise resolve mesmo após a remontagem (callbacks do `mutate` não).
    update.mutateAsync(parsed.data).then(
      () => toast.success('Perfil atualizado'),
      (err: unknown) => {
        if (err instanceof ApiError && err.details) {
          setErrors(err.details)
          setFormError(err.code === 'CONFLICT' ? 'Alguns dados já estão em uso por outra conta.' : err.message)
        } else setFormError(`Suas alterações não foram salvas. ${apiErrorMessage(err)}`)
      },
    )
  }

  const onReset = () => {
    setErrors({})
    setFormError(null)
  }

  return (
    <section aria-labelledby="profile-form-title" className="flex flex-col gap-4">
      <h2 id="profile-form-title" className="text-title-3 font-bold">
        Dados do perfil
      </h2>
      <form ref={formRef} onSubmit={onSubmit} onReset={onReset} noValidate className="flex flex-col gap-4" aria-labelledby="profile-form-title">
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome de exibição" error={errors.displayName} required>
            {(p) => <Input {...p} name="displayName" defaultValue={profile.displayName} autoComplete="name" />}
          </Field>
          <Field label="Nome de usuário" error={errors.username} hint="Letras minúsculas, números, ponto e sublinhado." required>
            {(p) => <Input {...p} name="username" defaultValue={profile.username} autoComplete="username" autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label="E-mail" error={errors.email} required>
            {(p) => <Input {...p} name="email" type="email" inputMode="email" defaultValue={profile.email} autoComplete="email" />}
          </Field>
          <Field label="Apelido da carteira" error={errors.walletNickname} required>
            {(p) => <Input {...p} name="walletNickname" defaultValue={profile.walletNickname} />}
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          <Button type="reset" variant="ghost" disabled={update.isPending}>
            Descartar alterações
          </Button>
        </div>
      </form>
    </section>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  useFocusFirstInvalid(formRef, errors)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (change.isPending) return
    const form = e.currentTarget
    const data = new FormData(form)
    const parsed = PasswordChange.safeParse({
      currentPassword: data.get('currentPassword'),
      newPassword: data.get('newPassword'),
      confirmPassword: data.get('confirmPassword'),
    })
    setFormError(null)
    setDone(false)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    change.mutate(parsed.data, {
      onSuccess: () => {
        form.reset() // senhas nunca ficam no formulário depois de salvas
        setDone(true)
        toast.success('Senha alterada')
      },
      onError: (err) => {
        if (err instanceof ApiError && err.details) {
          setErrors(err.details)
        } else setFormError(`A senha não foi alterada. ${apiErrorMessage(err)}`)
      },
    })
  }

  return (
    <section aria-labelledby="password-title" className="flex flex-col gap-4">
      <h2 id="password-title" className="text-title-3 font-bold">
        Alterar senha
      </h2>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4" aria-labelledby="password-title">
        {formError && <FormAlert>{formError}</FormAlert>}
        {done && (
          <p role="status" className="rounded-xs bg-success-surface px-3 py-2 text-caption text-success">
            Senha alterada. Outras sessões abertas desta conta foram encerradas.
          </p>
        )}
        <Field label="Senha atual" error={errors.currentPassword} required>
          {(p) => <PasswordInput {...p} name="currentPassword" autoComplete="current-password" />}
        </Field>
        <Field label="Nova senha" error={errors.newPassword} hint={PASSWORD_HINT} required>
          {(p) => <PasswordInput {...p} name="newPassword" autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword} required>
          {(p) => <PasswordInput {...p} name="confirmPassword" autoComplete="new-password" />}
        </Field>
        <Button type="submit" disabled={change.isPending} className="self-start">
          {change.isPending ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}
