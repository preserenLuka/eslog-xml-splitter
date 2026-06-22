import { readFileSync } from 'fs'
import { parseEslogXml } from '../src/eslog/parser'
import { buildDerivedXml } from '../src/eslog/transformer'

test('transformer removes non-selected lines and signature', () => {
  const xml = readFileSync('fixtures/input/sample1.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  const selected = new Set(['1'])
  const out = buildDerivedXml(parsed, 'water', selected)
  expect(out).toContain('VODARINA')
  expect(out).not.toContain('ODVOZ KOMUNALNIH ODPADKOV')
})
