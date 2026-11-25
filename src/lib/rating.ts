/**
 * Nota no formato pt-BR, igual a `toLocaleString('pt-BR', { minimumFractionDigits: 1 })` para notas
 * de 0 a 5: vírgula decimal, de 1 a 3 casas ("4,8", "5,0", "4,75").
 * CP9.2 (perfil de CPU): o primeiro uso do Intl em pt-BR (carga dos dados do locale) era a função
 * mais cara da renderização do detalhe; para este formato simples, o Intl é desnecessário.
 */
export function formatRating(rating: number) {
  const text = String(Math.round(rating * 1000) / 1000)
  return (text.includes('.') ? text : `${text}.0`).replace('.', ',')
}
