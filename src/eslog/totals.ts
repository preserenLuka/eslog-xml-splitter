import Decimal from 'decimal.js'
import { LineItem } from './types'

export function sumLines(lines: LineItem[]) {
  const net = lines.reduce((s, l) => s.plus(new Decimal(l.net || '0')), new Decimal(0))
  const vat = lines.reduce((s, l) => s.plus(new Decimal(l.vat || '0')), new Decimal(0))
  const gross = lines.reduce((s, l) => s.plus(new Decimal(l.gross || '0')), new Decimal(0))
  return { net: net.toFixed(2), vat: vat.toFixed(2), gross: gross.toFixed(2) }
}
