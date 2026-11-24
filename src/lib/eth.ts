/**
 * Aritmética monetária em ETH sem ponto flutuante.
 *
 * Por que bigint em wei? `0.1 + 0.2 !== 0.3` em number (IEEE-754).
 * Convertendo a string decimal para inteiro de wei (1 ETH = 10^18 wei),
 * somas e multiplicações por quantidade são exatas. A formatação só acontece na saída.
 */
export type Wei = bigint & { readonly __brand: 'Wei' }

const DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(DECIMALS)
const DECIMAL_RE = /^(\d+)(?:\.(\d{1,18}))?$/

export function parseEth(value: string): Wei {
  const match = DECIMAL_RE.exec(value.trim())
  if (!match) throw new Error(`Valor ETH inválido: "${value}"`)
  const [, int = '0', frac = ''] = match
  return (BigInt(int) * WEI_PER_ETH + BigInt(frac.padEnd(DECIMALS, '0'))) as Wei
}

/** Converte wei para string decimal canônica, sem zeros à direita (ex.: "8.936"). */
export function toEthString(wei: Wei): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / WEI_PER_ETH
  const frac = (abs % WEI_PER_ETH).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: Wei[]): Wei {
  return values.reduce((acc, v) => acc + v, 0n) as Wei
}

export function mulEth(value: Wei, quantity: number): Wei {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantidade deve ser inteira e não negativa')
  return (value * BigInt(quantity)) as Wei
}

/**
 * Formata para exibição com arredondamento half-up.
 * minDecimals/maxDecimals controlam as casas mostradas ("1.19 ETH", "8.936 ETH").
 */
export function formatEth(value: string | Wei, { minDecimals = 2, maxDecimals = 4 } = {}): string {
  const wei = typeof value === 'string' ? parseEth(value) : value
  const scale = 10n ** BigInt(DECIMALS - maxDecimals)
  const rounded = ((wei + scale / 2n) / scale) * scale
  const [int, frac = ''] = toEthString(rounded as Wei).split('.')
  const shown = frac.padEnd(minDecimals, '0')
  return `${int}.${shown} ETH`
}
