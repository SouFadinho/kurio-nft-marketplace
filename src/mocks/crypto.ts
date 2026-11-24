/**
 * Hash de senha do mock (ACC-08): PBKDF2-SHA256 com salt via Web Crypto.
 * Serve para não guardar senha em claro no localStorage da simulação.
 * NÃO é uma implementação de segurança de produção: tudo roda no navegador.
 */
const ITERATIONS = 100_000

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

export function randomHex(bytes = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

/** Hash estável (não criptográfico) para comparar o conteúdo de requisições idempotentes. */
export async function digest(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(stableStringify(value))
  return toHex(await crypto.subtle.digest('SHA-256', data))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
