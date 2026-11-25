import sharp from 'sharp'
const [a, b] = process.argv.slice(2)
const ra = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const rb = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) { console.log('size differs'); process.exit() }
let any = 0, big = 0
for (let i = 0; i < ra.data.length; i += 4) {
  const d = Math.max(Math.abs(ra.data[i] - rb.data[i]), Math.abs(ra.data[i + 1] - rb.data[i + 1]), Math.abs(ra.data[i + 2] - rb.data[i + 2]))
  if (d > 8) any++
  if (d > 60) big++
}
const n = ra.info.width * ra.info.height
console.log(`pixels >8: ${any} (${(100 * any / n).toFixed(2)}%), >60: ${big} (${(100 * big / n).toFixed(2)}%)`)
