import { readFileSync } from 'fs'
import { parseEslogXml } from '../src/eslog/parser'

test('parses namespaced eSLOG XML and extracts lines', () => {
  const xml = readFileSync('fixtures/input/sample1.xml', 'utf8')
  const parsed = parseEslogXml(xml, 'sample1.xml')
  expect(parsed.invoiceNumber).toBe('INV-001')
  expect(parsed.lines.length).toBe(2)
  expect(parsed.lines[0].serviceCode).toBe('11211')
  expect(parsed.lines[1].serviceCode).toBe('14255')
})
