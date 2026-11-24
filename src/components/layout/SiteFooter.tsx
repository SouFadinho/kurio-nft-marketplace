/**
 * Rodapé.
 *
 * DESKTOP (≥ lg), fiel ao Figma:
 *  1. Faixa de benefícios: 3 cards com círculo laranja e letra (W, C, D: iniciais de Wallet,
 *     Creators e Drops, como no Figma), separados por divisores verticais, mais a newsletter.
 *  2. Faixa de contato (#38220F): KURIO · lema · e-mail · telefone.
 *  3. Colunas de links + redes sociais + "Carteiras compatíveis".
 *  4. Copyright.
 * MOBILE (< lg): o Figma não desenha rodapé no mobile. Versão compacta DERIVADA, com a
 * mesma informação essencial, e espaço reservado para a navegação inferior.
 *
 * Links fora do escopo usam UnavailableAction (sem aparentar sucesso). A newsletter não tem
 * backend no escopo: valida o e-mail e informa que está indisponível, sem fingir inscrição.
 */
import { Link } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Container, UnavailableAction, UNAVAILABLE_MESSAGE } from '@/components/kurio/basics'
import { FacebookIcon, InstagramIcon, LinkedinIcon, XSocialIcon, YoutubeIcon } from '@/components/icons/brand'
import { BENEFITS, FOOTER_COLUMNS, type FooterLink } from './navigation'

const SOCIALS = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'X (Twitter)', Icon: XSocialIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
] as const

function FooterLinkItem({ link }: { link: FooterLink }) {
  const cls = 'text-caption text-foreground/80 transition-colors hover:text-price'
  if (link.unavailable || !link.to) return <UnavailableAction label={link.label} className={cls} />
  return (
    <Link to={link.to} className={cls}>
      {link.label}
    </Link>
  )
}

function Newsletter() {
  const uid = useId()
  const ids = { title: `${uid}-title`, email: `${uid}-email`, error: `${uid}-error`, help: `${uid}-help` }
  const [error, setError] = useState<string | null>(null)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Informe um e-mail válido.')
      return
    }
    setError(null)
    toast.info(UNAVAILABLE_MESSAGE, { description: 'A inscrição na newsletter não faz parte desta demonstração.' })
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2" aria-labelledby={ids.title}>
      <h2 id={ids.title} className="text-title-3 font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex">
        <label htmlFor={ids.email} className="sr-only">
          E-mail para a newsletter
        </label>
        <input
          id={ids.email}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? ids.error : ids.help}
          className="h-10 min-w-0 flex-1 rounded-l-xs border border-input bg-band/60 px-3 text-caption outline-none focus-visible:border-primary"
        />
        <Button type="submit" className="h-10 rounded-l-none">
          Enviar
        </Button>
      </div>
      {error ? (
        <p id={ids.error} className="text-caption text-destructive">
          {error}
        </p>
      ) : (
        <p id={ids.help} className="text-caption text-muted-foreground">
          Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
        </p>
      )}
    </form>
  )
}

function Socials() {
  return (
    <ul className="flex gap-2">
      {SOCIALS.map(({ label, Icon }) => (
        <li key={label}>
          <UnavailableAction label={label} className="grid size-9 place-items-center rounded-xs border border-primary/70 text-price hover:bg-primary/10 lg:size-7">
            <Icon />
          </UnavailableAction>
        </li>
      ))}
    </ul>
  )
}

function CompatibleWallets() {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-title-3 font-bold">Carteiras compatíveis</h2>
      <p className="w-fit rounded-xs bg-band px-3 py-1.5 text-overline font-semibold text-price uppercase">MetaMask · WalletConnect · Coinbase</p>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-16 pb-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+1.5rem)] lg:pb-6" data-testid="site-footer">
      {/* ---------- Desktop ---------- */}
      <Container className="hidden lg:block">
        <div className="overflow-hidden rounded-sm bg-surface">
          <div className="grid grid-cols-[repeat(3,1fr)_1.3fr] gap-0 px-8 py-8">
            {BENEFITS.map((b) => (
              <div key={b.letter} className="flex flex-col gap-3 border-r border-primary/50 pr-6 pl-6 first:pl-0">
                <span aria-hidden className="grid size-12 place-items-center rounded-full bg-primary text-title-3 font-bold text-primary-foreground">
                  {b.letter}
                </span>
                <h2 className="text-title-3 font-bold">{b.title}</h2>
                <p className="text-caption text-muted-foreground">{b.text}</p>
              </div>
            ))}
            <div className="pl-6">
              <Newsletter />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-6 bg-band px-8 py-5 text-caption">
            <span className="font-bold tracking-[0.18em]">KURIO</span>
            <span className="text-muted-foreground">Feito para colecionadores, criadores e cultura</span>
            <span className="text-muted-foreground">contato@email.com</span>
            <span className="text-muted-foreground">+55 11 4002 8922</span>
          </div>
          <div className="grid grid-cols-4 gap-6 px-8 py-8">
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
                <h2 className="text-title-3 font-bold">{col.title}</h2>
                <ul className="flex flex-col gap-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLinkItem link={l} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="text-title-3 font-bold">Redes sociais</h2>
                <Socials />
              </div>
              <CompatibleWallets />
            </div>
          </div>
        </div>
        <p className="py-4 text-center text-caption text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
      </Container>

      {/* ---------- Mobile (derivado) ---------- */}
      <Container className="flex flex-col gap-6 border-t border-border pt-8 lg:hidden">
        <div className="flex flex-col gap-1">
          <span className="font-bold tracking-[0.18em]">KURIO</span>
          <span className="text-caption text-muted-foreground">Feito para colecionadores, criadores e cultura</span>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
              <h2 className="text-caption font-bold">{col.title}</h2>
              <ul className="flex flex-col gap-1">
                {col.links.map((l) => (
                  <li key={l.label} className="flex min-h-9 items-center">
                    <FooterLinkItem link={l} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <Newsletter />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-caption font-bold">Redes sociais</h2>
            <Socials />
          </div>
          <CompatibleWallets />
        </div>
        <p className="text-caption text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
      </Container>
    </footer>
  )
}
