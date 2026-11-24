/**
 * Demonstração do layout de conta (TEMPORÁRIA). Campos conforme Desktop / Perfil do
 * colecionador; o formulário real (validação, API, avatar) é o CP4.
 */
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccountLayout } from '@/components/layout/AccountLayout'

export const Route = createFileRoute('/demo/conta')({
  component: DemoAccount,
})

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-price" aria-hidden>*</span>}
      </Label>
      {children ?? <Input id={id} required={required} />}
    </div>
  )
}

function DemoAccount() {
  return (
    <AccountLayout active="profile" title="Perfil do colecionador">
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault()
          toast.info('Demonstração de layout', { description: 'O salvamento do perfil é implementado no CP4.' })
        }}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="acc-display" label="Nome de exibição" required />
          <Field id="acc-user" label="Nome de usuário" required />
          <Field id="acc-email" label="E-mail" required />
          <Field id="acc-wallet-nick" label="Apelido da carteira" required />
        </div>
        <fieldset className="grid gap-5 md:max-w-[calc(50%-0.625rem)]">
          <legend className="mb-4 text-title-3 font-bold">Alterar senha</legend>
          <Field id="acc-current" label="Senha atual">
            <Input id="acc-current" type="password" autoComplete="current-password" />
          </Field>
          <Field id="acc-new" label="Nova senha">
            <Input id="acc-new" type="password" autoComplete="new-password" />
          </Field>
          <Field id="acc-confirm" label="Confirmar nova senha">
            <Input id="acc-confirm" type="password" autoComplete="new-password" />
          </Field>
        </fieldset>
        <div>
          <Button type="submit" className="w-full md:w-auto">
            Salvar
          </Button>
        </div>
      </form>
    </AccountLayout>
  )
}
