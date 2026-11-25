/**
 * Carteiras (TELA-09 / ACC-07).
 *
 * - Duas posições, como no Figma: "Carteira principal" e "Carteira secundária" (MAX_WALLETS).
 * - Adicionar e editar com formulário inline: apelido, rede, tipo, endereço e nome ENS.
 *   O endereço é validado conforme a rede (EVM 0x… ou Solana base58), no cliente e na API.
 * - "Tornar principal" troca as posições (a API garante uma única principal).
 * - Tudo simulado: nenhuma carteira, blockchain ou serviço externo real.
 * - O Figma repete campos do perfil (nome de exibição, nome de perfil, e-mail, código de
 *   indicação) neste formulário; foram omitidos porque pertencem ao Perfil (desvio documentado).
 */
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MAX_WALLETS, Network, WALLET_TYPE_LABEL, WalletInput, WalletType, type Wallet } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/kurio/states'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { Field, FormAlert, apiErrorMessage, useFocusFirstInvalid, selectClass, zodFieldErrors, type FieldErrors } from '@/components/kurio/form'
import { sortWallets, useSaveWallet, useSetPrimaryWallet, useWallets } from './queries'

type Editing = { mode: 'new' } | { mode: 'edit'; id: string } | null

export function WalletsPage() {
  const wallets = useWallets()
  const [editing, setEditing] = useState<Editing>(null)

  if (wallets.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando carteiras">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }
  if (wallets.isError) {
    return <ErrorState title="Não foi possível carregar suas carteiras" message={apiErrorMessage(wallets.error)} onRetry={() => void wallets.refetch()} retrying={wallets.isFetching} />
  }

  const [primary, secondary] = sortWallets(wallets.data)
  const canAdd = wallets.data.length < MAX_WALLETS
  const close = () => setEditing(null)

  const slot = (wallet: Wallet | undefined, title: string, emptyText: string, id: string) => (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-sm bg-surface p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-title-3 font-bold">
          {title}
        </h2>
        {!wallet && canAdd && editing?.mode !== 'new' && (
          <Button type="button" size="sm" variant="link" className="h-auto p-0 text-price" onClick={() => setEditing({ mode: 'new' })}>
            Adicionar carteira
          </Button>
        )}
      </div>
      {wallet ? (
        editing?.mode === 'edit' && editing.id === wallet.id ? (
          <WalletForm wallet={wallet} onDone={close} />
        ) : (
          <WalletSummary wallet={wallet} onEdit={() => setEditing({ mode: 'edit', id: wallet.id })} disabled={editing !== null} />
        )
      ) : editing?.mode === 'new' ? (
        <WalletForm onDone={close} />
      ) : (
        <p className="text-caption text-muted-foreground">{emptyText}</p>
      )}
    </section>
  )

  // CP8 (VIS-07): como no Figma, a carteira PRINCIPAL aparece como formulário aberto (editar e
  // salvar direto; sem carteira, é o formulário de cadastro). A secundária fica resumida abaixo,
  // com "Editar", "Tornar principal" ou "Adicionar".
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="wallet-primary-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="wallet-primary-title" className="text-title-3 font-bold">
            Carteira principal
          </h2>
          <p className="text-caption text-muted-foreground">
            Estas carteiras ficam disponíveis no pagamento e para receber os NFTs comprados. Carteiras e rede são simuladas: nenhuma carteira real é conectada.
          </p>
        </div>
        <WalletForm key={primary ? `${primary.id}:${primary.version}` : 'nova-principal'} wallet={primary} persistent />
      </section>
      {primary && slot(secondary, 'Carteira secundária', 'Você ainda não adicionou uma carteira secundária.', 'wallet-secondary-title')}
    </div>
  )
}

function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function WalletSummary({ wallet, onEdit, disabled }: { wallet: Wallet; onEdit: () => void; disabled: boolean }) {
  const setPrimary = useSetPrimaryWallet()
  const makePrimary = () =>
    setPrimary.mutate(wallet.id, {
      onSuccess: () => toast.success(`${wallet.nickname} agora é a carteira principal`),
      onError: (err) => toast.error('Não foi possível trocar a carteira principal', { description: apiErrorMessage(err) }),
    })

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" data-testid={`wallet-${wallet.id}`}>
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-caption">
        <dt className="text-muted-foreground">Apelido</dt>
        <dd className="flex flex-wrap items-center gap-2 font-semibold">
          {wallet.nickname}
          {wallet.primary && <Badge>Principal</Badge>}
        </dd>
        <dt className="text-muted-foreground">Tipo</dt>
        <dd>{WALLET_TYPE_LABEL[wallet.type]}</dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd>{NETWORK_LABEL[wallet.network]}</dd>
        <dt className="text-muted-foreground">Endereço</dt>
        <dd className="truncate" title={wallet.address}>
          <span aria-hidden>{shortAddress(wallet.address)}</span>
          <span className="sr-only">{wallet.address}</span>
        </dd>
        {wallet.ens && (
          <>
            <dt className="text-muted-foreground">ENS</dt>
            <dd className="truncate">{wallet.ens}.eth</dd>
          </>
        )}
      </dl>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={disabled} aria-label={`Editar ${wallet.nickname}`}>
          Editar
        </Button>
        {!wallet.primary && (
          <Button type="button" size="sm" onClick={makePrimary} disabled={disabled || setPrimary.isPending} aria-label={`Tornar principal a carteira ${wallet.nickname}`}>
            {setPrimary.isPending ? 'Trocando…' : 'Tornar principal'}
          </Button>
        )}
      </div>
    </div>
  )
}

function WalletForm({ wallet, onDone, persistent = false }: { wallet?: Wallet; onDone?: () => void; persistent?: boolean }) {
  const save = useSaveWallet()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  useFocusFirstInvalid(formRef, errors)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (save.isPending) return
    const data = new FormData(e.currentTarget)
    const parsed = WalletInput.safeParse({
      nickname: data.get('nickname'),
      network: data.get('network') || undefined,
      type: data.get('type') || undefined,
      address: String(data.get('address') ?? '').trim(),
      ens: String(data.get('ens') ?? '').trim().replace(/\.eth$/i, '') || undefined,
    })
    setFormError(null)
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    // mutateAsync (e não mutate + callbacks): ao salvar uma carteira NOVA, o cache passa a ter a
    // carteira e este formulário é desmontado; os callbacks por chamada do `mutate` não rodariam
    // depois disso, mas a promise ainda resolve (toast + fechar o editor).
    save.mutateAsync({ id: wallet?.id, input: parsed.data }).then(
      (saved) => {
        toast.success(wallet ? `Carteira ${saved.nickname} atualizada` : `Carteira ${saved.nickname} adicionada`)
        onDone?.()
      },
      (err: unknown) => {
        if (err instanceof ApiError && err.details) {
          const { form, ...fields } = err.details
          setErrors(fields)
          setFormError(form ?? (err.code === 'CONFLICT' ? 'Esta carteira já está cadastrada.' : err.message))
        } else setFormError(`A carteira não foi salva. ${apiErrorMessage(err)}`)
      },
    )
  }

  const title = persistent ? 'Dados da carteira principal' : wallet ? `Editar ${wallet.nickname}` : 'Nova carteira'
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={title}>
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Apelido da carteira" error={errors.nickname} required>
          {(p) => <Input {...p} name="nickname" defaultValue={wallet?.nickname} placeholder="Ex.: Principal" />}
        </Field>
        <Field label="Rede" error={errors.network} required>
          {(p) => (
            <select {...p} name="network" defaultValue={wallet?.network ?? ''} className={selectClass}>
              <option value="" disabled>
                Selecione uma rede
              </option>
              {Network.options.map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Tipo de carteira" error={errors.type} required>
          {(p) => (
            <select {...p} name="type" defaultValue={wallet?.type ?? ''} className={selectClass}>
              <option value="" disabled>
                Selecione uma carteira
              </option>
              {WalletType.options.map((t) => (
                <option key={t} value={t}>
                  {WALLET_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Endereço da carteira" error={errors.address} hint="Ethereum/Polygon: 0x + 40 caracteres. Solana: base58." required>
          {(p) => <Input {...p} name="address" defaultValue={wallet?.address} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="0x…" />}
        </Field>
        <Field label="Nome ENS (opcional)" error={errors.ens}>
          {(p) => (
            <div className="relative">
              <Input {...p} name="ens" defaultValue={wallet?.ens ?? ''} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="meunome" className="pr-14" />
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-caption text-muted-foreground lg:right-3">
                .eth
              </span>
            </div>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar carteira'}
        </Button>
        {!persistent && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
