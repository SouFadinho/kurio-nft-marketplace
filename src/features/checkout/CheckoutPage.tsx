/**
 * Pagamento com carteira (TELA-04). Figma: Desktop / Pagamento ("Perfil do colecionador" à
 * esquerda; "Seus NFTs", resumo, carteira e "Confirmar compra" à direita) e Mobile / Pagamento
 * ("Carteira conectada", "Carteira e rede", total e "Confirmar compra" fixo).
 *
 * Regras:
 * - Rota privada (guard); dados do colecionador vêm do perfil e podem ser ajustados para o pedido.
 * - Carteira: uma das cadastradas (`useWallets` + `sortWallets`, principal primeiro) ou outra
 *   informada só para esta compra. A rede é escolhida entre as compatíveis com o endereço.
 * - Conexão SIMULADA (WalletConnect, MetaMask, Coinbase Wallet) pela API do mock: conectar,
 *   recusa e desconectar. Trocar carteira, rede ou provedor desconecta.
 * - Valores: a cotação ACEITA é a que aparece no resumo e vai no pedido. Se uma cotação nova
 *   (preço, estoque, cupom, expiração) tiver valores diferentes, nada muda em silêncio: um
 *   alerta mostra antes → depois e a compra fica bloqueada até "Aceitar novos valores".
 * - Envio idempotente; falhas recuperáveis mantêm tudo preenchido; rascunho salvo para voltar
 *   após expiração da sessão. Confirmação de compra só com o pedido criado pela API.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  CheckoutBuyer,
  PaymentWallet,
  WALLET_TYPE_LABEL,
  WalletType,
  networksForAddress,
  sameQuoteValues,
  type Cart,
  type CheckoutRequest,
  type Network,
  type Profile,
  type Quote,
  type Wallet,
  type WalletConnection,
} from '@/api/contracts'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_LABEL } from '@/components/kurio/NetworkBadge'
import { NftImage } from '@/components/kurio/NftImage'
import { WalletCard, shortenAddress } from '@/components/kurio/WalletCard'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { Field, FormAlert, apiErrorMessage, selectClass, useFocusFirstInvalid, zodFieldErrors, type FieldErrors } from '@/components/kurio/form'
import { CheckoutLayout } from '@/components/layout/CheckoutLayout'
import { useProfile, useWallets, sortWallets } from '@/features/account/queries'
import { useClientSession } from '@/features/auth/queries'
import { cartHasIssues, useCart, useQuote } from '@/features/cart/queries'
import { CouponForm, SummaryRows } from '@/features/cart/QuoteSummary'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { clearAttempt, clearDraft, loadDraft, saveDraft, useConnectWallet, useCreateCheckoutOrder, useDisconnectWallet, useRecoverAttempt, type CheckoutDraft } from './queries'

const CRUMBS = [{ label: 'Início', to: '/' as const }, { label: 'Mercado', to: '/mercado' as const }, { label: 'Pagamento' }]
const TITLE = 'Pagamento com carteira'

export function CheckoutPage() {
  const session = useClientSession()
  const cart = useCart()
  const profile = useProfile()
  const wallets = useWallets()
  const [started, setStarted] = useState(false)
  const navigate = useNavigate()
  // CP7: uma compra enviada antes (refresh ou aba fechada sem resposta) é procurada pela chave.
  const recovery = useRecoverAttempt(session!.userId)
  const recovered = recovery.data
  useEffect(() => {
    if (!recovered) return
    clearAttempt(session!.userId)
    clearDraft(session!.userId)
    toast.info('Encontramos a compra que você já tinha enviado', { description: `Pedido ${recovered.id}. Nada foi enviado de novo.` })
    void navigate({ to: '/pedidos/$orderId', params: { orderId: recovered.id }, replace: true })
  }, [recovered, navigate, session])

  const shell = (main: React.ReactNode, summary: React.ReactNode = null) => <CheckoutLayout title={TITLE} crumbs={CRUMBS} backTo="/carrinho" main={main} summary={summary} />

  if (recovery.isFetching || recovered) {
    return shell(
      <p role="status" aria-busy="true" className="rounded-sm bg-surface p-5 text-body">
        Verificando uma compra enviada antes…
      </p>,
    )
  }
  if (recovery.isError) {
    return shell(<ErrorState title="Não foi possível verificar a compra anterior" message={apiErrorMessage(recovery.error)} onRetry={() => void recovery.refetch()} retrying={recovery.isFetching} />)
  }
  if (cart.isPending || profile.isPending || wallets.isPending) {
    return shell(
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando pagamento">
        <Skeleton className="h-40 w-full rounded-sm" />
        <Skeleton className="h-56 w-full rounded-sm" />
      </div>,
      <Skeleton className="h-80 w-full rounded-sm" />,
    )
  }
  const failed = cart.isError ? cart : profile.isError ? profile : wallets.isError ? wallets : null
  if (failed) {
    return shell(<ErrorState title="Não foi possível carregar o pagamento" message={apiErrorMessage(failed.error)} onRetry={() => void failed.refetch()} retrying={failed.isFetching} />)
  }
  if (!cart.data || !profile.data || !wallets.data) return null
  // Depois que o formulário apareceu, ele NUNCA é desmontado por mudanças no carrinho: um pedido
  // criado com a resposta perdida esvazia o carrinho no servidor, e a pessoa precisa continuar
  // vendo o "Tentar novamente" (mesma chave → mesmo pedido). O formulário trata esses casos.
  if (started) return <CheckoutForm userId={session!.userId} cart={cart.data} profile={profile.data} wallets={sortWallets(wallets.data)} />
  if (cart.data.lines.length === 0) {
    return shell(
      <EmptyState
        title="Seu carrinho está vazio"
        description="Adicione NFTs ao carrinho para pagar."
        action={
          <Button asChild>
            <Link to="/mercado">Explorar NFTs</Link>
          </Button>
        }
      />,
    )
  }
  if (cartHasIssues(cart.data)) {
    return shell(
      <EmptyState
        title="Revise o carrinho"
        description="Alguns itens não têm mais a quantidade escolhida. Ajuste o carrinho para continuar."
        action={
          <Button asChild>
            <Link to="/carrinho">Voltar ao carrinho</Link>
          </Button>
        }
      />,
    )
  }
  setStarted(true)
  return null
}

type Connection = { status: 'idle' } | { status: 'connecting' } | { status: 'refused'; message: string } | { status: 'connected'; connection: WalletConnection }

function initialDraft(userId: string, profile: Profile, wallets: Wallet[]): CheckoutDraft {
  const saved = loadDraft(userId)
  const primary = wallets[0]
  const walletChoice = saved?.wallet && (saved.wallet === 'external' || wallets.some((w) => `saved:${w.id}` === saved.wallet)) ? saved.wallet : primary ? `saved:${primary.id}` : 'external'
  const external = saved?.external ?? { network: 'ethereum' as Network, type: 'metamask' as const, address: '' }
  const address = walletChoice === 'external' ? external.address : (wallets.find((w) => `saved:${w.id}` === walletChoice)?.address ?? '')
  const fallbackNetwork = walletChoice === 'external' ? external.network : (wallets.find((w) => `saved:${w.id}` === walletChoice)?.network ?? 'ethereum')
  const network = saved?.network && networksForAddress(address || '0x').includes(saved.network) ? saved.network : fallbackNetwork
  return {
    displayName: saved?.displayName ?? profile.displayName,
    email: saved?.email ?? profile.email,
    note: saved?.note ?? '',
    wallet: walletChoice,
    external,
    network,
  }
}

function CheckoutForm({ userId, cart, profile, wallets }: { userId: string; cart: Cart; profile: Profile; wallets: Wallet[] }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<CheckoutDraft>(() => initialDraft(userId, profile, wallets))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<{ text: string; retryBody?: CheckoutRequest } | null>(null)
  const [conn, setConn] = useState<Connection>({ status: 'idle' })
  const [provider, setProvider] = useState<WalletType>(() => wallets.find((w) => `saved:${w.id}` === draft.wallet)?.type ?? draft.external.type)
  const [accepted, setAccepted] = useState<Quote | null>(null)
  useFocusFirstInvalid(formRef, errors)

  const quote = useQuote(draft.network, cart)
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const create = useCreateCheckoutOrder()

  // Rascunho: sobrevive a expiração da sessão e falhas (nada sensível: sem senhas ou chaves).
  useEffect(() => saveDraft(userId, draft), [userId, draft])

  // Cotação aceita: a primeira é aceita ao ser exibida; uma nova com OS MESMOS valores é
  // adotada (ex.: renovação após expirar). Valores diferentes exigem aceite explícito.
  const latest = quote.data
  if (latest && (!accepted || (accepted.id !== latest.id && sameQuoteValues(accepted, latest)))) setAccepted(latest)
  const changed = !!accepted && !!latest && !sameQuoteValues(accepted, latest)

  const selectedSaved = wallets.find((w) => `saved:${w.id}` === draft.wallet)
  const address = selectedSaved ? selectedSaved.address : draft.external.address.trim()
  const networkOptions = networksForAddress(address || (draft.external.network === 'solana' ? 'x' : '0x'))

  const dropConnection = () => {
    if (conn.status === 'connected') disconnect.mutate(conn.connection.id)
    setConn({ status: 'idle' })
  }
  const update = (patch: Partial<CheckoutDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const changeNetwork = (network: Network) => {
    dropConnection()
    setAccepted(null) // a pessoa escolheu outra rede: a nova cotação é a que ela verá e aceitará
    update({ network })
  }
  const changeWallet = (choice: string) => {
    dropConnection()
    const w = wallets.find((x) => `saved:${x.id}` === choice)
    if (w) setProvider(w.type)
    const nextNetwork = w ? w.network : draft.external.network
    if (nextNetwork !== draft.network) setAccepted(null)
    update({ wallet: choice, network: nextNetwork })
  }

  const onConnect = () => {
    setFormError(null)
    const wallet = selectedSaved ? { kind: 'saved' as const, walletId: selectedSaved.id } : { kind: 'external' as const, ...draft.external, network: draft.network }
    const parsed = PaymentWallet.safeParse(wallet)
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(zodFieldErrors(parsed.error.issues)).map(([k, v]) => [k === 'address' ? 'externalAddress' : k, v])))
      return
    }
    setConn({ status: 'connecting' })
    connect.mutateAsync({ provider, network: draft.network, address }).then(
      (connection) => {
        setConn({ status: 'connected', connection })
        toast.success(`Carteira conectada via ${WALLET_TYPE_LABEL[provider]}`)
      },
      (err: unknown) => {
        const refused = err instanceof ApiError && err.code === 'WALLET_REJECTED'
        setConn({ status: 'refused', message: refused ? `A conexão foi recusada na ${WALLET_TYPE_LABEL[provider]}. Você pode tentar de novo.` : `Não foi possível conectar. ${apiErrorMessage(err)}` })
      },
    )
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (create.isPending) return
    // Tentativa sem desfecho conhecido (timeout, rede, 5xx): o pedido pode existir. Qualquer
    // confirmação reenvia EXATAMENTE o mesmo conteúdo (mesma chave de idempotência), nunca um
    // conteúdo novo (ex.: cotação renovada) que criaria um segundo pedido.
    if (formError?.retryBody) return send(formError.retryBody)
    setFormError(null)
    const buyer = CheckoutBuyer.safeParse({ displayName: draft.displayName, email: draft.email, note: draft.note || undefined })
    const wallet = PaymentWallet.safeParse(selectedSaved ? { kind: 'saved', walletId: selectedSaved.id } : { kind: 'external', ...draft.external, network: draft.network })
    const fieldErrors: FieldErrors = {
      ...(buyer.success ? {} : zodFieldErrors(buyer.error.issues)),
      ...(wallet.success ? {} : Object.fromEntries(Object.entries(zodFieldErrors(wallet.error.issues)).map(([k, v]) => [k === 'address' ? 'externalAddress' : k, v]))),
    }
    if (!buyer.success || !wallet.success) return setErrors(fieldErrors)
    setErrors({})
    if (cartIssue) return setFormError({ text: 'Alguns itens ficaram sem estoque. Revise o carrinho para continuar.' })
    if (cartEmpty) return setFormError({ text: 'O carrinho está vazio. Volte ao carrinho para escolher NFTs.' })
    if (conn.status !== 'connected') return setFormError({ text: 'Conecte a carteira antes de confirmar a compra.' })
    if (!accepted || changed || quote.isFetching) return setFormError({ text: changed ? 'Os valores mudaram. Revise e aceite os novos valores antes de confirmar.' : 'Aguarde o cálculo dos valores.' })

    send({ quoteId: accepted.id, network: draft.network, buyer: buyer.data, wallet: wallet.data, connectionId: conn.connection.id })
  }

  const send = (body: CheckoutRequest) =>
    create.mutateAsync(body).then(
      (order) => {
        clearDraft(userId)
        void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
      },
      (err: unknown) => onCreateError(err, body),
    )

  const onCreateError = (err: unknown, body: CheckoutRequest) => {
    if (!(err instanceof ApiError)) return setFormError({ text: `Não foi possível criar o pedido. ${apiErrorMessage(err)}`, retryBody: body })
    switch (err.code) {
      case 'TIMEOUT':
      case 'NETWORK_ERROR':
        return setFormError({
          text: 'Não recebemos a resposta do servidor. O pedido pode ter sido criado: tente de novo. A nova tentativa usa a mesma chave e não cria um pedido duplicado.',
          retryBody: body,
        })
      case 'QUOTE_EXPIRED':
      case 'QUOTE_STALE':
        void quote.refetch()
        return setFormError({ text: `${err.message} Os valores foram recalculados; confirme a compra novamente.` })
      case 'OUT_OF_STOCK':
      case 'CART_EMPTY':
        return setFormError({ text: `${err.message} Volte ao carrinho para revisar.` })
      case 'WALLET_DISCONNECTED':
        setConn({ status: 'idle' })
        return setFormError({ text: err.message })
      case 'STALE_SESSION':
      case 'SESSION_EXPIRED':
      case 'UNAUTHORIZED':
        return // a sessão mudou: SessionEffects cuida (login com retorno a /pagamento)
      default:
        if (err.details) setErrors(err.details)
        // 4xx: o conteúdo precisa mudar (não há o que repetir). 5xx: desfecho incerto, repete o mesmo.
        return setFormError({ text: `Não foi possível criar o pedido. Seus dados foram mantidos. ${err.message}`, retryBody: err.status !== null && err.status < 500 ? undefined : body })
    }
  }

  const imageOf = new Map(cart.lines.map((l) => [l.id, l]))
  const submitting = create.isPending
  const cartIssue = cartHasIssues(cart)
  const cartEmpty = cart.lines.length === 0

  const confirmButton = (className: string, variant: 'default' | 'gradient') => (
    <Button type="submit" form="checkout-form" variant={variant} size="lg" className={className} disabled={submitting} aria-describedby="checkout-status">
      {submitting ? 'Enviando pedido…' : 'Confirmar compra'}
    </Button>
  )

  const main = (
    <form id="checkout-form" ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-8" aria-label="Pagamento">
      {formError && (
        <div role="alert" className="flex flex-col gap-2 rounded-xs bg-destructive-surface px-3 py-2 text-caption text-destructive">
          <span>{formError.text}</span>
          {formError.text.includes('carrinho') && (
            <Link to="/carrinho" className="self-start underline underline-offset-4">
              Revisar o carrinho
            </Link>
          )}
          {formError.retryBody && (
            <Button type="button" size="sm" variant="outline" className="self-start" disabled={submitting} onClick={() => void send(formError.retryBody!)}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {cartIssue && (
        <div role="alert" className="flex flex-col gap-2 rounded-xs bg-destructive-surface px-3 py-2 text-caption text-destructive" data-testid="checkout-cart-issue">
          <span>Alguns itens ficaram sem estoque enquanto você revisava. A compra está bloqueada até o carrinho ser ajustado.</span>
          <Link to="/carrinho" className="self-start underline underline-offset-4">
            Voltar ao carrinho
          </Link>
        </div>
      )}
      {cartEmpty && !formError?.retryBody && (
        <p role="status" className="rounded-xs bg-surface px-3 py-2 text-caption">
          Seu carrinho está vazio.{' '}
          <Link to="/carrinho" className="text-price underline underline-offset-4">
            Ir para o carrinho
          </Link>
        </p>
      )}

      <section aria-labelledby="buyer-title" className="flex flex-col gap-4">
        <h2 id="buyer-title" className="text-title-3 font-bold">
          Perfil do colecionador
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome de exibição" error={errors.displayName} required>
            {(p) => <Input {...p} value={draft.displayName} onChange={(e) => update({ displayName: e.target.value })} autoComplete="name" />}
          </Field>
          <Field label="E-mail" error={errors.email} required>
            {(p) => <Input {...p} type="email" inputMode="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} autoComplete="email" />}
          </Field>
        </div>
        <Field label="Observação do colecionador (opcional)" error={errors.note} hint="Até 280 caracteres.">
          {(p) => (
            <textarea
              {...p}
              value={draft.note}
              onChange={(e) => update({ note: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-4 py-3 font-mono text-body text-foreground outline-none hover:border-muted-foreground focus-visible:border-primary aria-invalid:border-destructive lg:rounded-xs lg:px-3 lg:text-caption"
            />
          )}
        </Field>
      </section>

      <section aria-labelledby="wallet-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="wallet-title" className="text-title-3 font-bold">
            Carteira de pagamento
          </h2>
          <Link to="/perfil/carteiras" className="text-caption text-price underline-offset-4 hover:underline">
            Gerenciar carteiras
          </Link>
        </div>
        <RadioGroup value={draft.wallet} onValueChange={changeWallet} aria-labelledby="wallet-title" aria-describedby={errors.wallet ? 'wallet-error' : undefined} className="gap-3">
          {wallets.map((w) => (
            <WalletCard key={w.id} value={`saved:${w.id}`} name={w.nickname} address={w.address} ens={w.ens ? `${w.ens}.eth` : undefined} network={w.network} />
          ))}
          <div className="flex items-center gap-3 rounded-lg bg-surface p-4 has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary">
            <RadioGroupItem id="wallet-external" value="external" />
            <label htmlFor="wallet-external" className="cursor-pointer text-body">
              Usar outra carteira
            </label>
          </div>
        </RadioGroup>
        {errors.wallet && (
          <p id="wallet-error" className="text-caption text-destructive">
            {errors.wallet}
          </p>
        )}
        {!selectedSaved && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tipo de carteira" error={errors.type} required>
              {(p) => (
                <select
                  {...p}
                  value={draft.external.type}
                  onChange={(e) => {
                    dropConnection()
                    const type = e.target.value as WalletType
                    setProvider(type)
                    update({ external: { ...draft.external, type } })
                  }}
                  className={selectClass}
                >
                  {WalletType.options.map((t) => (
                    <option key={t} value={t}>
                      {WALLET_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Endereço da carteira" error={errors.externalAddress} hint="Ethereum/Polygon: 0x + 40 caracteres. Solana: base58." required>
              {(p) => (
                <Input
                  {...p}
                  value={draft.external.address}
                  onChange={(e) => {
                    dropConnection()
                    const value = e.target.value
                    const options = networksForAddress(value.trim() || '0x')
                    const network = options.includes(draft.network) ? draft.network : options[0]!
                    if (network !== draft.network) setAccepted(null)
                    update({ external: { ...draft.external, address: value, network }, network })
                  }}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x…"
                />
              )}
            </Field>
          </div>
        )}
        <Field label="Rede" error={errors.network} hint={networkOptions.length > 1 ? 'A taxa de rede muda conforme a rede.' : 'Única rede compatível com este endereço.'} required>
          {(p) => (
            <select {...p} value={draft.network} onChange={(e) => changeNetwork(e.target.value as Network)} className={cn(selectClass, 'md:max-w-xs')}>
              {networkOptions.map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>
    </form>
  )

  const summary = (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="items-title" className="flex flex-col gap-3 rounded-sm bg-surface p-5">
        <div className="flex items-center justify-between border-b border-border-strong pb-2 text-caption font-semibold">
          <h2 id="items-title" className="text-title-3 font-bold">
            Seus NFTs
          </h2>
          <span aria-hidden>Subtotal</span>
        </div>
        <ul className="flex flex-col gap-2">
          {(accepted?.lines ?? []).map((l) => {
            const line = imageOf.get(l.lineId)
            return (
              <li key={l.lineId} className="flex items-center gap-3 rounded-xs bg-surface-2 p-2" data-testid="checkout-line">
                {line && (
                  <div className="size-12 shrink-0 overflow-hidden rounded-xs">
                    <NftImage src={line.image} alt={line.imageAlt} />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-caption font-bold">{l.name}</span>
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {formatEth(l.unitPrice)} × {l.quantity}
                  </span>
                </div>
                <span className="font-mono text-caption font-bold text-price tabular-nums">{formatEth(l.lineTotal)}</span>
              </li>
            )
          })}
          {!accepted && quote.isFetching && <Skeleton className="h-16 w-full rounded-xs" />}
        </ul>
        <CouponForm cart={cart} />
        {changed && latest && accepted && <QuoteChanged from={accepted} to={latest} onAccept={() => setAccepted(latest)} />}
        <SummaryRows quote={accepted ?? undefined} loading={!accepted && quote.isFetching} error={!accepted ? quote.error : null} onRetry={() => void quote.refetch()} feeNote="Taxa estimada" />
      </section>

      <section aria-labelledby="connect-title" className="flex flex-col gap-3 rounded-sm bg-surface p-5">
        <h2 id="connect-title" className="text-title-3 font-bold">
          Carteira e rede
        </h2>
        <RadioGroup
          value={provider}
          onValueChange={(v) => {
            dropConnection()
            setProvider(v as WalletType)
          }}
          aria-labelledby="connect-title"
          className="gap-2"
        >
          {WalletType.options.map((t) => (
            <label key={t} htmlFor={`provider-${t}`} className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-surface-3 text-caption font-bold text-price">
                {WALLET_TYPE_LABEL[t][0]}
              </span>
              <span className="flex-1 text-caption">{WALLET_TYPE_LABEL[t]}</span>
              <RadioGroupItem id={`provider-${t}`} value={t} />
            </label>
          ))}
        </RadioGroup>
        <ConnectionStatus conn={conn} provider={provider} onConnect={onConnect} onDisconnect={dropConnection} />
        <p id="checkout-status" className="sr-only">
          {conn.status !== 'connected' ? 'Conecte a carteira para confirmar.' : changed ? 'Aceite os novos valores para confirmar.' : ''}
        </p>
        {confirmButton('hidden w-full lg:flex', 'default')}
        <p className="text-[0.6875rem] text-muted-foreground">Ambiente de demonstração: nenhuma carteira real é conectada e nenhum valor é cobrado.</p>
      </section>
    </div>
  )

  return <CheckoutLayout title={TITLE} crumbs={CRUMBS} backTo="/carrinho" main={main} summary={summary} mobileAction={confirmButton('w-full', 'gradient')} />
}

function ConnectionStatus({ conn, provider, onConnect, onDisconnect }: { conn: Connection; provider: WalletType; onConnect: () => void; onDisconnect: () => void }) {
  if (conn.status === 'connected') {
    const c = conn.connection
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xs bg-success-surface px-3 py-2 text-caption text-success">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-4" aria-hidden />
          Conectada via {WALLET_TYPE_LABEL[c.provider]}: {shortenAddress(c.address)} · {NETWORK_LABEL[c.network]}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onDisconnect}>
          Desconectar
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {conn.status === 'refused' && <FormAlert>{conn.message}</FormAlert>}
      <Button type="button" variant="outline" onClick={onConnect} disabled={conn.status === 'connecting'}>
        <WalletIcon aria-hidden />
        {conn.status === 'connecting' ? 'Aguardando a carteira…' : `Conectar ${WALLET_TYPE_LABEL[provider]}`}
      </Button>
    </div>
  )
}

/** Valores mudaram depois da revisão: mostra antes → depois e pede aceite explícito. */
function QuoteChanged({ from, to, onAccept }: { from: Quote; to: Quote; onAccept: () => void }) {
  const before = new Map(from.lines.map((l) => [l.lineId, l]))
  const lineChanges = to.lines.filter((l) => {
    const b = before.get(l.lineId)
    return !b || b.unitPrice !== l.unitPrice || b.quantity !== l.quantity
  })
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xs border border-warning/50 bg-warning/10 px-3 py-2 text-caption text-warning" data-testid="quote-changed">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        Os valores mudaram desde a sua revisão.
      </p>
      <ul className="flex flex-col gap-1 text-foreground">
        {lineChanges.map((l) => (
          <li key={l.lineId}>
            {l.name}: {before.get(l.lineId) ? `${formatEth(before.get(l.lineId)!.unitPrice)} → ` : ''}
            {formatEth(l.unitPrice)}
          </li>
        ))}
        <li>
          Total: {formatEth(from.total)} → <strong data-testid="quote-new-total">{formatEth(to.total)}</strong>
        </li>
      </ul>
      <Button type="button" size="sm" className="self-start" onClick={onAccept}>
        Aceitar novos valores
      </Button>
    </div>
  )
}
