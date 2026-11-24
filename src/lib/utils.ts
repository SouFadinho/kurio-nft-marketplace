import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * O tailwind-merge precisa conhecer os tokens de tamanho de texto do KURIO (index.css).
 * Sem isso, `text-caption` é tratado como COR e descartado quando combinado com
 * `text-foreground` (defeito encontrado no CP2: fontes inconsistentes no rodapé mobile).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'display-sm', 'title-1', 'title-2', 'title-3', 'body', 'caption', 'overline'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
