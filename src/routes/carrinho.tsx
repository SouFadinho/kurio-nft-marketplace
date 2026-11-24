import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/kurio/pages'

// TEMPORÁRIO: carrinho no CP5. No mobile, o Figma não tem navegação inferior nesta tela.
export const Route = createFileRoute('/carrinho')({
  staticData: { hideBottomNav: true },
  component: () => <PlaceholderPage title="Carrinho de NFTs" checkpoint="CP5 (Carrinho e checkout)" />,
})
