/**
 * Demonstração do layout de checkout (TEMPORÁRIA). Itens vêm da API simulada; os VALORES do
 * resumo aparecem como skeleton de propósito: eles virão da cotação da API no CP5 (a UI não
 * calcula totais).
 */
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PriceDisplay } from '@/components/kurio/PriceDisplay'
import { QuantitySelector } from '@/components/kurio/QuantitySelector'
import { CheckoutLayout } from '@/components/layout/CheckoutLayout'
import { useNftList } from '@/features/nfts/queries'

export const Route = createFileRoute('/demo/checkout')({
  staticData: { hideBottomNav: true },
  component: DemoCheckout,
})

const demoAction = () => toast.info('Demonstração de layout', { description: 'O checkout é implementado no CP5.' })

function Summary() {
  const rows = ['Subtotal', 'Desconto do lançamento', 'Taxa de rede']
  return (
    <div className="flex flex-col gap-4 rounded-sm bg-surface p-5" aria-busy="true">
      <h2 className="text-title-3 font-bold">Resumo da carteira</h2>
      <form className="flex" onSubmit={(e) => (e.preventDefault(), demoAction())}>
        <label htmlFor="coupon" className="sr-only">Código promocional</label>
        <Input id="coupon" placeholder="Digite o código promocional…" className="rounded-r-none lg:rounded-r-none" />
        <Button type="submit" className="h-12 rounded-l-none lg:h-10">Aplicar</Button>
      </form>
      <p role="status" className="sr-only">Carregando valores da cotação…</p>
      <dl className="flex flex-col gap-3 text-caption">
        {rows.map((r) => (
          <div key={r} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{r}</dt>
            <dd><Skeleton className="h-4 w-20 rounded-xs" /></dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border-strong pt-3">
          <dt className="text-body font-bold">Total</dt>
          <dd><Skeleton className="h-5 w-24 rounded-xs" /></dd>
        </div>
      </dl>
      <Button className="hidden w-full lg:flex" onClick={demoAction}>Conectar e finalizar</Button>
    </div>
  )
}

function DemoCheckout() {
  const nfts = useNftList()
  const items = nfts.data?.items.slice(0, 3) ?? []
  return (
    <CheckoutLayout
      title="Carrinho de NFTs"
      crumbs={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]}
      backTo="/mercado"
      main={
        <ul className="flex flex-col gap-3" aria-label="Itens do carrinho">
          {items.map((n) => (
            <li key={n.id} className="flex items-stretch overflow-hidden rounded-lg bg-surface">
              <img src={n.image} alt={n.imageAlt} width={80} height={80} className="size-20 shrink-0 self-center object-cover" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3 lg:gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body font-bold lg:text-title-3">{n.name}</span>
                  <span className="text-caption text-muted-foreground">Edição: 1/50</span>
                  <PriceDisplay value={n.price} size="lg" />
                </div>
                <QuantitySelector value={1} onChange={demoAction} max={Math.max(1, n.available)} itemName={n.name} className="gap-2 lg:gap-3" />
              </div>
            </li>
          ))}
        </ul>
      }
      summary={<Summary />}
      mobileAction={
        <Button variant="gradient" size="lg" className="w-full" onClick={demoAction}>
          Conectar e finalizar
        </Button>
      }
    />
  )
}
