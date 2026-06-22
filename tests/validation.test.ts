import { readFileSync } from 'fs'
import { parseEslogXml } from '../src/eslog/parser'
import { validateParsed } from '../src/eslog/validator'

test('basic validation catches missing gross mismatch', () => {
  const xml = readFileSync('fixtures/input/sample1.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  const res = validateParsed(parsed)
  // our sample has net+vat == gross? 100+22 + 50+11 = 183, but gross fields absent so treated as 0
  expect(res.ok).toBe(false)
  expect(res.errors.length).toBeGreaterThan(0)
})
