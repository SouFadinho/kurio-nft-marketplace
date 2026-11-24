/**
 * Galeria do design system (TEMPORÁRIA, interna, fora da navegação pública).
 * Serve para validação visual em 390/768/1440 (planning/evidence/cp2).
 *
 * Fronteiras preservadas: os NFTs vêm da API simulada (useNftList → Axios → MSW). Os demais
 * exemplos usam apenas estado local de demonstração e não representam regras de negócio.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { EllipsisVertical, SlidersHorizontal, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Container } from '@/components/kurio/basics'
import { NetworkBadge } from '@/components/kurio/NetworkBadge'
import { NFTCard } from '@/components/kurio/NFTCard'
import { NFTGrid } from '@/components/kurio/NFTGrid'
import { Pagination } from '@/components/kurio/Pagination'
import { PriceDisplay } from '@/components/kurio/PriceDisplay'
import { QuantitySelector } from '@/components/kurio/QuantitySelector'
import { SearchInput } from '@/components/kurio/SearchInput'
import { SectionHeading } from '@/components/kurio/SectionHeading'
import { EmptyState, ErrorState, LoadingState } from '@/components/kurio/states'
import { WalletCard } from '@/components/kurio/WalletCard'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { useNftList } from '@/features/nfts/queries'

export const Route = createFileRoute('/demo/componentes')({
  component: ComponentGallery,
})

const COLORS = [
  ['background', '#140D0A'],
  ['surface', '#241612'],
  ['surface-2', '#341E15'],
  ['surface-3', '#4A2D1F'],
  ['band', '#38220F'],
  ['primary', '#D28A4C'],
  ['primary-active', '#B77743'],
  ['price', '#E89B55'],
  ['foreground', '#F5F1EB'],
  ['muted-foreground', '#CFB28C'],
  ['placeholder', '#B39463'],
  ['input', '#82603F'],
  ['destructive', '#FF8A80'],
  ['success', '#7BC47F'],
] as const

const TYPE_SCALE = [
  ['text-display', 'SEJA DONO DO FUTURO'],
  ['text-display-sm', 'SEJA DONO DA CULTURA'],
  ['text-title-1', 'Emerald Ape #042'],
  ['text-title-2', 'Carrinho de NFTs'],
  ['text-title-3', 'Violet Nomad #314'],
  ['text-body', 'Um colecionável digital 1/50 finalizado à mão.'],
  ['text-caption', 'Edição: 1/50 · ID do token: #0042'],
] as const

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border py-8 first:border-t-0">
      <h2 id={id} className="text-title-2 text-price">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ComponentGallery() {
  const nfts = useNftList()
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['nft-002']))
  const [qty, setQty] = useState(1)
  const [page, setPage] = useState(1)
  const [price, setPrice] = useState([0.02, 12.3])
  const [query, setQuery] = useState('')
  const [wallet, setWallet] = useState('reserva')
  const [showSkeleton, setShowSkeleton] = useState(false)

  const toggleFavorite = (id: string, next: boolean) =>
    setFavorites((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })

  return (
    <>
      <MobileTopBar title="Design system" />
      <Container className="pb-12">
        <h1 className="hidden pt-8 text-title-1 lg:block">KURIO · Design system</h1>

        <Block id="ds-colors" title="Cores">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {COLORS.map(([name, hex]) => (
              <li key={name} className="flex flex-col gap-1.5">
                <span className="h-14 rounded-sm border border-border-strong" style={{ background: hex }} />
                <span className="text-caption">{name}</span>
                <code className="text-caption text-muted-foreground">{hex}</code>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="ds-type" title="Tipografia · Roboto Mono">
          <ul className="flex flex-col gap-3">
            {TYPE_SCALE.map(([cls, sample]) => (
              <li key={cls} className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-6">
                <code className="w-40 shrink-0 text-caption text-muted-foreground">{cls}</code>
                <span className={cls}>{sample}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="ds-buttons" title="Botões">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Comprar</Button>
            <Button variant="outline">
              <Star aria-hidden /> Favoritar
            </Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Continuar explorando</Button>
            <Button variant="destructive">Remover</Button>
            <Button disabled>Desabilitado</Button>
            <Button size="sm">Entrar</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="gradient" size="lg" className="min-w-56">
              Comprar NFT
            </Button>
            <Button variant="icon-round" size="icon-lg" aria-label="Voltar">
              ‹
            </Button>
            <Button variant="default" size="icon" aria-label="Filtros" className="rounded-lg bg-primary-gradient">
              <SlidersHorizontal aria-hidden />
            </Button>
          </div>
        </Block>

        <Block id="ds-forms" title="Formulários">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-name">
                Nome de exibição <span className="text-price" aria-hidden>*</span>
              </Label>
              <Input id="demo-name" placeholder="Seu nome público" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-email">E-mail</Label>
              <Input id="demo-email" type="email" defaultValue="ana@exemplo" aria-invalid aria-describedby="demo-email-error" />
              <p id="demo-email-error" className="text-caption text-destructive">
                Informe um e-mail válido.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-disabled">Endereço da carteira</Label>
              <Input id="demo-disabled" disabled placeholder="0x…" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-network">Rede</Label>
              <Select defaultValue="polygon">
                <SelectTrigger id="demo-network" className="w-full">
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="solana">Solana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SearchInput label="Buscar NFTs" placeholder="Explorar coleções" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} />
            <SearchInput label="Buscar NFTs (desktop)" variant="outline" placeholder="Buscar por nome ou coleção" />
            <div className="flex items-center gap-3">
              <Checkbox id="demo-check" defaultChecked />
              <Label htmlFor="demo-check">Igual à carteira principal</Label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption font-semibold" id="demo-price-label">
                Faixa de preço
              </span>
              <Slider
                aria-labelledby="demo-price-label"
                min={0}
                max={20}
                step={0.01}
                value={price}
                onValueChange={setPrice}
                thumbLabels={['Preço mínimo', 'Preço máximo']}
              />
              <p className="text-caption text-muted-foreground">
                Preço: {price[0]?.toFixed(2)} – {price[1]?.toFixed(2)} ETH
              </p>
            </div>
          </div>
        </Block>

        <Block id="ds-badges" title="Selos, rede e preço">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="rare">Raro</Badge>
            <Badge variant="chip">1/10</Badge>
            <Badge variant="chip" className="border-primary text-price">
              1/50
            </Badge>
            <Badge variant="chip">Aberta</Badge>
            <Badge variant="chip">
              <Star className="text-price" fill="currentColor" aria-hidden /> 4.8 (19)
            </Badge>
            <Badge variant="success">Confirmado</Badge>
            <Badge variant="danger">Recusado</Badge>
            <Badge variant="count">3</Badge>
            <NetworkBadge network="ethereum" />
            <NetworkBadge network="polygon" />
            <NetworkBadge network="solana" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <PriceDisplay value="1.19" size="xl" />
            <PriceDisplay value="1.99" previous="2.29" />
            <PriceDisplay value="8.936" size="lg" />
            <QuantitySelector value={qty} onChange={setQty} max={5} itemName="Emerald Ape #042" />
          </div>
        </Block>

        <Block id="ds-tabs" title="Abas">
          <Tabs defaultValue="all">
            <TabsList bordered aria-label="Filtrar NFTs">
              <TabsTrigger value="all">Todos os NFTs</TabsTrigger>
              <TabsTrigger value="new">Novos lançamentos</TabsTrigger>
              <TabsTrigger value="hot">Em alta</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="text-muted-foreground">
              Conteúdo de “Todos os NFTs”.
            </TabsContent>
            <TabsContent value="new" className="text-muted-foreground">
              Conteúdo de “Novos lançamentos”.
            </TabsContent>
            <TabsContent value="hot" className="text-muted-foreground">
              Conteúdo de “Em alta”.
            </TabsContent>
          </Tabs>
        </Block>

        <Block id="ds-overlays" title="Diálogo, drawer, tooltip e toast">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Abrir diálogo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Entrar</DialogTitle>
                  <DialogDescription>Entre para gerenciar sua carteira, coleção e perfil de criador.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <Label htmlFor="dlg-email">E-mail</Label>
                  <Input id="dlg-email" type="email" placeholder="contato@email.com" />
                  <Button>Entrar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">
                  <SlidersHorizontal aria-hidden /> Abrir filtros (drawer)
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Filtros</DrawerTitle>
                  <DrawerDescription>Coleções, faixa de preço e rede.</DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col gap-3 px-4">
                  <div className="flex items-center gap-3">
                    <Checkbox id="drw-eth" />
                    <Label htmlFor="drw-eth">Ethereum</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="drw-pol" />
                    <Label htmlFor="drw-pol">Polygon</Label>
                  </div>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button>Aplicar</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Taxa estimada pela rede</TooltipContent>
            </Tooltip>
            <Button variant="secondary" onClick={() => toast.success('Adicionado ao carrinho')}>
              Toast de sucesso
            </Button>
            <Button variant="secondary" onClick={() => toast.error('Não foi possível favoritar', { description: 'O estado anterior foi restaurado.' })}>
              Toast de erro
            </Button>
          </div>
        </Block>

        <Block id="ds-cards" title="Cards de NFT (dados da API simulada)">
          <div className="flex items-center gap-3">
            <Checkbox id="toggle-skeleton" checked={showSkeleton} onCheckedChange={(v) => setShowSkeleton(v === true)} />
            <Label htmlFor="toggle-skeleton">Mostrar skeletons</Label>
          </div>
          {nfts.isError ? (
            <ErrorState message="A lista de NFTs não pôde ser carregada." onRetry={() => void nfts.refetch()} />
          ) : (
            <NFTGrid
              label="NFTs de exemplo"
              loading={nfts.isPending || showSkeleton}
              items={nfts.data?.items.slice(0, 6) ?? []}
              getKey={(n) => n.id}
              renderItem={(n, i) => (
                <NFTCard
                  nft={{ ...n, previousPrice: n.id === 'nft-003' ? '2.29' : undefined }}
                  priority={i < 2}
                  favorite={favorites.has(n.id)}
                  onToggleFavorite={(next) => toggleFavorite(n.id, next)}
                />
              )}
            />
          )}
        </Block>

        <Block id="ds-sections" title="Títulos de seção e paginação">
          <SectionHeading title="Mais desta coleção" action={<Button variant="link">Ver todos</Button>} />
          <SectionHeading variant="center" title="Diário da Cunhagem" description="Histórias, guias e insights para colecionadores e amantes da propriedade digital." />
          <Pagination page={page} pageCount={4} onPageChange={setPage} />
        </Block>

        <Block id="ds-wallets" title="Carteiras">
          <RadioGroup value={wallet} onValueChange={setWallet} aria-label="Carteira para pagamento" className="grid gap-3 md:grid-cols-2">
            <WalletCard
              value="reserva"
              name="Reserva"
              address="0x8f3Cb6aD61b5e2B7C9a4d1E0f2A3b4C5d6E7F801"
              ens="nova.kurio.eth"
              network="polygon"
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Ações da carteira Reserva">
                      <EllipsisVertical aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
            <WalletCard value="principal" name="Principal" address="0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C" network="ethereum" />
          </RadioGroup>
        </Block>

        <Block id="ds-states" title="Estados">
          <div className="grid gap-4 lg:grid-cols-3">
            <LoadingState label="Carregando resumo…" />
            <EmptyState title="Nenhum NFT encontrado" description="Ajuste os filtros ou limpe a busca." action={<Button variant="outline">Limpar filtros</Button>} />
            <ErrorState message="Falha temporária na conexão." onRetry={() => toast.info('Nova tentativa (demonstração)')} />
          </div>
        </Block>
      </Container>
    </>
  )
}
