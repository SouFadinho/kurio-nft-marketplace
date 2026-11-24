/**
 * Layout de conta (Figma: Desktop / Perfil do colecionador e Carteiras).
 *
 * DESKTOP: card lateral "Meu perfil" com itens e ícones; o item ativo tem a barra laranja à
 * esquerda e o texto laranja; conteúdo à direita.
 * MOBILE (derivado; não há frame): barra superior com título + navegação horizontal rolável
 * com os mesmos itens.
 * Itens fora do escopo (Atividade, Ofertas, Arquivos baixados, Suporte) usam UnavailableAction.
 * "Sair" encerra a sessão de verdade (mutation de logout).
 */
import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Activity, Download, Heart, LifeBuoy, LogOut, Tag, UserRound, Wallet, type LucideIcon } from 'lucide-react'
import { Container, UnavailableAction } from '@/components/kurio/basics'
import { useLogout } from '@/features/auth/queries'
import { cn } from '@/lib/utils'
import { MobileTopBar } from './MobileTopBar'
import { ACCOUNT_NAV, type AccountNavKey } from './navigation'

const ICONS: Record<(typeof ACCOUNT_NAV)[number]['icon'], LucideIcon> = {
  user: UserRound,
  wallet: Wallet,
  activity: Activity,
  heart: Heart,
  tag: Tag,
  download: Download,
  support: LifeBuoy,
}

const itemBase =
  'relative flex min-h-11 items-center gap-3 rounded-xs px-3 text-caption transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9'

export function AccountLayout({ active, title, children }: { active: AccountNavKey; title: string; children: ReactNode }) {
  const logout = useLogout()
  const navigate = useNavigate()
  const onLogout = () => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })

  const items = ACCOUNT_NAV.map((item) => {
    const Icon = ICONS[item.icon]
    const isActive = item.key === active
    const content = (
      <>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </>
    )
    return (
      <li key={item.key} className="shrink-0">
        {'unavailable' in item ? (
          <UnavailableAction label={item.label} className={cn(itemBase, 'w-full text-muted-foreground hover:text-foreground')}>
            {content}
          </UnavailableAction>
        ) : (
          <Link
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              itemBase,
              isActive
                ? 'bg-surface-2 font-semibold text-price before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary lg:bg-transparent'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {content}
          </Link>
        )}
      </li>
    )
  })

  return (
    <>
      <MobileTopBar title="Minha conta" titleAs="p" fallback="/" />
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:pt-8">
        <aside aria-label="Menu da conta" className="min-w-0 lg:sticky lg:top-[calc(var(--spacing-header)+2rem)] lg:self-start">
          <nav aria-label="Conta" className="rounded-sm lg:bg-surface lg:p-4">
            <h2 className="mb-3 hidden text-title-3 font-bold lg:block">Meu perfil</h2>
            <ul className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
              {items}
              <li className="shrink-0">
                <button type="button" onClick={onLogout} disabled={logout.isPending} className={cn(itemBase, 'w-full text-muted-foreground hover:text-foreground')}>
                  <LogOut className="size-4" aria-hidden />
                  <span>{logout.isPending ? 'Saindo…' : 'Sair'}</span>
                </button>
              </li>
            </ul>
          </nav>
        </aside>
        <section aria-labelledby="account-title" className="min-w-0">
          <h1 id="account-title" className="mb-6 hidden text-title-2 lg:block">
            {title}
          </h1>
          <h1 className="sr-only lg:hidden">{title}</h1>
          {children}
        </section>
      </Container>
    </>
  )
}
