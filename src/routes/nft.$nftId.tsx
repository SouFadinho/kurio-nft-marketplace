import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/kurio/pages'

// TEMPORÁRIO: detalhe do NFT no CP3. No mobile, a tela tem barra de compra própria (sem bottom nav).
export const Route = createFileRoute('/nft/$nftId')({
  staticData: { hideBottomNav: true },
  component: () => <PlaceholderPage title="Detalhes do NFT" checkpoint="CP3 (Catálogo e detalhes)" />,
})
