/**
 * Header DESKTOP (≥ lg). Figma: "KURIO" à esquerda; navegação central (Início, Mercado,
 * Criadores, Aprenda) com o item ativo laranja e sublinhado; à direita, busca, carrinho com
 * contador e botão "Entrar" laranja com ícone.
 * No mobile, o Figma não tem header global: cada tela tem a própria barra (MobileTopBar)
 * e a navegação fica embaixo (BottomNav).
 */
import { Link } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container, Logo } from '@/components/kurio/basics'
import { useClientSession } from '@/features/auth/queries'
import { PRIMARY_NAV } from './navigation'

export function SiteHeader({ cartCount = 0 }: { cartCount?: number }) {
  const session = useClientSession()
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/60 bg-background/90 backdrop-blur-md lg:block">
      <Container className="grid h-(--spacing-header) grid-cols-[1fr_auto_1fr] items-center gap-6">
        <Logo />
        <nav aria-label="Principal">
          <ul className="flex items-center gap-8">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === '/' }}
                  className="relative inline-flex h-(--spacing-header) items-center text-caption text-foreground/85 transition-colors hover:text-foreground after:absolute after:inset-x-0 after:bottom-4 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 aria-[current=page]:font-semibold aria-[current=page]:text-price aria-[current=page]:after:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Buscar NFTs">
            <Link to="/mercado">
              <Search aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="relative" aria-label={cartCount > 0 ? `Carrinho, ${cartCount} itens` : 'Carrinho'}>
            <Link to="/carrinho">
              <ShoppingCart aria-hidden />
              {cartCount > 0 && (
                <Badge variant="count" className="absolute top-1 right-1" aria-hidden>
                  {cartCount}
                </Badge>
              )}
            </Link>
          </Button>
          {session ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/perfil">
                <UserRound aria-hidden />
                Minha conta
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">
                <LogIn aria-hidden />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </Container>
    </header>
  )
}
