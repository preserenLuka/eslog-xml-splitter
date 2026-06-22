import { readFileSync } from 'fs'
import { parseEslogXml } from '../src/eslog/parser'
import { sumLines } from '../src/eslog/totals'

test('sums lines correctly using Decimal.js', () => {
  const xml = readFileSync('fixtures/input/sample1.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  const totals = sumLines(parsed.lines)
  expect(totals.net).toBe('150.00')
  expect(totals.vat).toBe('33.00')
  expect(totals.gross).toBe('0.00')
})
