import { useCallback, useSyncExternalStore } from 'react'

/** Media query reativa (ex.: '(min-width: 1024px)'). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

export const DESKTOP_QUERY = '(min-width: 1024px)'
