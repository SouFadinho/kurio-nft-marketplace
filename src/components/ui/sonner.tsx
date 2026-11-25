import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { markToasterMounted } from '@/lib/toast'

/**
 * Toasts (base shadcn/ui + sonner). Tema fixo escuro (o KURIO não tem tema claro), por isso
 * sem `next-themes`. O sonner usa uma região `aria-live` para anunciar as mensagens
 * (feedback acessível de mutations e de tempo real: A11Y-06).
 * CP8 (VIS-15): no TOPO, logo abaixo do header (desktop) ou da barra superior (mobile). Embaixo,
 * os toasts encobriam a ação fixa do mobile ("Conectar e finalizar", "Confirmar compra", total) e
 * botões do resumo; no topo, ficam longe das ações principais.
 * CP9.2: carregado sob demanda (src/lib/toast.ts); avisa quando está montado.
 */
function Toaster(props: ToasterProps) {
  // Efeitos rodam do filho para o pai: aqui o sonner já assinou o estado e a região aria-live existe.
  useEffect(() => markToasterMounted(), [])
  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset={{ top: 'calc(var(--spacing-header) + 12px)' }}
      mobileOffset={{ top: 'calc(4rem + env(safe-area-inset-top) + 8px)' }}
      containerAriaLabel="Notificações"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-price" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: '!rounded-sm !border !border-border-strong !bg-surface !font-mono !text-foreground !shadow-overlay',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
