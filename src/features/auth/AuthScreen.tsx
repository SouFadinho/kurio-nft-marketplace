/**
 * Apresentação de login/cadastro (TELA-06 / TELA-07):
 * - Desktop (≥ lg): modal sobre a Home, como no Figma, com as abas "Entrar | Criar conta". CP8
 *   (VIS-08): ancorado perto do topo do hero como no Figma (~160 px), não centralizado na vertical.
 *   O Radix Dialog prende o foco, fecha com Esc e deixa o fundo inerte. Ao fechar, volta para
 *   a rota de origem (ou Início, se a origem for privada) e devolve o foco ao botão "Entrar"
 *   do header.
 * - Mobile: tela cheia, sem header/rodapé/bottom nav (staticData da rota).
 * Sucesso: segue para `redirect` (rota ou ação de origem) ou Início.
 */
import { Link, useRouter } from '@tanstack/react-router'
import { Logo } from '@/components/kurio/basics'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { validateCatalogSearch } from '@/features/catalog/search'
import { HomeContent } from '@/features/home/HomeContent'
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { LoginForm, RegisterForm } from './AuthForms'
import { isProtectedPath } from './authSearch'
import { sessionStore } from './sessionStore'

export type AuthMode = 'login' | 'register'

const COPY: Record<AuthMode, { title: string; description: string }> = {
  login: { title: 'Entrar', description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.' },
  register: { title: 'Criar perfil de colecionador', description: 'Crie seu perfil de colecionador para salvar favoritos e comprar NFTs.' },
}

const EMPTY_SEARCH = validateCatalogSearch({})

export function AuthScreen({ mode, redirect, expired = false }: { mode: AuthMode; redirect?: string; expired?: boolean }) {
  const router = useRouter()
  const desktop = useMediaQuery(DESKTOP_QUERY)

  const done = () => void router.navigate({ href: redirect ?? '/', replace: true })
  const close = () => {
    if (expired) sessionStore.acknowledgeEnd()
    const target = redirect && !isProtectedPath(redirect) ? redirect : '/'
    void router.navigate({ href: target }).then(() => document.querySelector<HTMLElement>('[data-auth-trigger]')?.focus())
  }

  const form =
    mode === 'login' ? <LoginForm onSuccess={done} expired={expired} redirect={redirect} /> : <RegisterForm onSuccess={done} redirect={redirect} />

  if (desktop) {
    return (
      <>
        <HomeContent search={EMPTY_SEARCH} />
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-[31rem] lg:top-36 lg:max-h-[calc(100dvh-10rem)] lg:translate-y-0" overlayClassName="bg-black/45 backdrop-blur-none" aria-describedby="auth-description">
            <nav aria-label="Acesso à conta" className="flex items-center gap-3 pr-10 text-body font-semibold">
              <AuthTab to="/login" active={mode === 'login'} redirect={redirect}>
                Entrar
              </AuthTab>
              <span aria-hidden className="h-4 w-px bg-border-strong" />
              <AuthTab to="/cadastro" active={mode === 'register'} redirect={redirect}>
                Criar conta
              </AuthTab>
            </nav>
            {/* CP8: /login e /cadastro são páginas; no desktop o modal é o conteúdo principal, então o título é o h1. */}
            <DialogTitle asChild>
              <h1 className="sr-only">{COPY[mode].title}</h1>
            </DialogTitle>
            <DialogDescription id="auth-description" className="-mt-2 text-caption">
              {COPY[mode].description}
            </DialogDescription>
            {form}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 px-6 pt-20 pb-10">
      <div className="flex justify-center pb-8">
        <Logo size="lg" />
      </div>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-title-2 font-bold">{COPY[mode].title}</h1>
        <p className="sr-only">{COPY[mode].description}</p>
      </div>
      {form}
    </div>
  )
}

function AuthTab({ to, active, redirect, children }: { to: '/login' | '/cadastro'; active: boolean; redirect?: string; children: string }) {
  return (
    <Link
      to={to}
      search={{ redirect }}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-ring',
        active ? 'text-price' : 'text-foreground/80 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
