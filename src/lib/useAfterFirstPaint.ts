import { startTransition, useEffect, useState } from 'react'

/**
 * CP9.2 (performance medida): `true` logo depois da primeira pintura, numa transição do React.
 *
 * Usado para montar conteúdo secundário abaixo da dobra (rodapé, abas e relacionados do detalhe)
 * fora da renderização inicial: a transição é fatiada pelo React (cede a thread a cada ~5 ms), sem
 * tarefa longa, e o conteúdo principal pinta antes. `ready = false` adia o início (ex.: dados ainda
 * não chegaram).
 */
export function useAfterFirstPaint(ready = true) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!ready || show) return
    const frame = requestAnimationFrame(() => startTransition(() => setShow(true)))
    return () => cancelAnimationFrame(frame)
  }, [ready, show])
  return show
}
