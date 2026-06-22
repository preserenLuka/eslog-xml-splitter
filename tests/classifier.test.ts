import { parseEslogXml } from '../src/eslog/parser'
import { builtInKomunalaNovoMesto, classifyLine } from '../src/eslog/classifier'
import { readFileSync } from 'fs'

test('built-in profile classifies water and waste correctly', () => {
  const xml = readFileSync('fixtures/input/sample1.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  const l1 = parsed.lines[0]
  const l2 = parsed.lines[1]
  expect(classifyLine(l1, builtInKomunalaNovoMesto).category).toBe('water')
  expect(classifyLine(l2, builtInKomunalaNovoMesto).category).toBe('waste')
})

test('ODVAJANJE ODPADNIH VODA is water', () => {
  const xml = readFileSync('fixtures/input/sample2.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  const l = parsed.lines[0]
  expect(classifyLine(l, builtInKomunalaNovoMesto).category).toBe('water')
})
