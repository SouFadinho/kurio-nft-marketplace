/**
 * Navegação inferior MOBILE (< lg). Figma (Mobile / Início): barra de superfície com cantos
 * superiores arredondados; ícones Início, Favoritos, [botão central flutuante], Carrinho e
 * Perfil; item ativo em laranja.
 *
 * O botão central do Figma usa um ícone de "scan" sem função definida. Interpretamos como
 * "Explorar" (leva ao Mercado): decisão documentada em planning/CP2_REPORT.md.
 * Cada item tem rótulo visível ao leitor de tela e `aria-current` (não só cor).
 * Respeita a safe area inferior (iOS).
 */
import { Link } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, UserRound, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const ITEMS: Array<{ label: string; to: '/' | '/favoritos' | '/carrinho' | '/perfil'; icon: LucideIcon }> = [
  { label: 'Início', to: '/', icon: House },
  { label: 'Favoritos', to: '/favoritos', icon: Heart },
  { label: 'Carrinho', to: '/carrinho', icon: ShoppingCart },
  { label: 'Perfil', to: '/perfil', icon: UserRound },
]

const itemClass =
  'relative grid size-12 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary outline-none focus-visible:outline-2 focus-visible:outline-ring'

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const [home, favorites, cart, profile] = ITEMS as [(typeof ITEMS)[0], (typeof ITEMS)[1], (typeof ITEMS)[2], (typeof ITEMS)[3]]
  const renderItem = (item: (typeof ITEMS)[number]) => (
    <li key={item.to}>
      <Link to={item.to} activeOptions={{ exact: item.to === '/' }} className={itemClass} aria-label={item.to === '/carrinho' && cartCount > 0 ? `${item.label}, ${cartCount} itens` : item.label}>
        {/* Figma: ícones pequenos e preenchidos (o carrinho é contorno). */}
        <item.icon className="size-5" aria-hidden fill={item.to === '/carrinho' ? 'none' : 'currentColor'} strokeWidth={item.to === '/carrinho' ? 2 : 1.5} />
        {item.to === '/carrinho' && cartCount > 0 && (
          <Badge variant="count" className="absolute top-1.5 right-1" aria-hidden>
            {cartCount}
          </Badge>
        )}
      </Link>
    </li>
  )

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.6)] lg:hidden"
      data-testid="bottom-nav"
    >
      <ul className="mx-auto grid h-(--spacing-bottom-nav) max-w-md grid-cols-5 items-center justify-items-center px-2">
        {renderItem(home)}
        {renderItem(favorites)}
        <li className="relative -top-6">
          <Link
            to="/mercado"
            aria-label="Explorar coleções"
            className="grid size-16 place-items-center rounded-full border-[6px] border-background bg-primary-gradient text-primary-foreground shadow-fab outline-none transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ScanLine className="size-6" aria-hidden />
          </Link>
        </li>
        {renderItem(cart)}
        {renderItem(profile)}
      </ul>
    </nav>
  )
}
