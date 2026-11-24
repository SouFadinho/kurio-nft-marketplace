import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toasts (base shadcn/ui + sonner). Tema fixo escuro (o KURIO não tem tema claro), por isso
 * sem `next-themes`. O sonner usa uma região `aria-live` para anunciar as mensagens
 * (feedback acessível de mutations e de tempo real: A11Y-06).
 * No mobile, fica acima da navegação inferior.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 'calc(var(--spacing-bottom-nav) + env(safe-area-inset-bottom) + 12px)' }}
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
