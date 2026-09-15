import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { builtInKomunalaNovoMesto, classifyLine, ResolvedCategory, supportsSupplier } from '../src/eslog/classifier'
import { parseEslogXml } from '../src/eslog/parser'
import { buildDerivedXml } from '../src/eslog/transformer'
import { validateParsed } from '../src/eslog/validator'

const mixedXml = readFileSync('fixtures/realistic/komunala-mesani-anon.xml', 'utf8')
const waterXml = readFileSync('fixtures/realistic/komunala-voda-anon.xml', 'utf8')

function assignments(xml: string) {
  const parsed = parseEslogXml(xml)
  expect(supportsSupplier(parsed.supplier, builtInKomunalaNovoMesto)).toBe(true)
  return {
    parsed,
    map: new Map<number, ResolvedCategory>(parsed.lines.map((line) => [line.internalIndex, classifyLine(line, builtInKomunalaNovoMesto).category])),
  }
}

test('realistic mixed invoice produces 166.22 EUR water and excludes 286.92 EUR waste', () => {
  const { parsed, map } = assignments(mixedXml)
  expect(parsed.invoiceNumber).toBe('TEST-MESANI-001')
  expect(parsed.issueDate).toBe('2026-06-30')
  expect(parsed.periodStart).toBe('2026-06-01')
  expect(parsed.periodEnd).toBe('2026-06-30')
  expect(parsed.supplier?.identifiers.VA).toBe('SI13503766')
  expect(parsed.supplier?.identifiers['0199']).toBe('5073120000')
  expect(parsed.totals.lineNet).toBe('414.07')
  expect(parsed.totals.taxExclusive).toBe('414.07')
  expect(parsed.totals.taxInclusive).toBe('453.14')
  expect(parsed.totals.payable).toBe('453.14')
  expect(parsed.lines).toHaveLength(22)
  expect(validateParsed(parsed).errors).toEqual([])
  const waterLines = parsed.lines.filter((line) => map.get(line.internalIndex) === 'water')
  const wasteLines = parsed.lines.filter((line) => map.get(line.internalIndex) === 'waste')
  expect(waterLines).toHaveLength(7)
  expect(wasteLines).toHaveLength(15)
  expect(wasteLines.reduce((sum, line) => sum + Number(line.gross), 0)).toBeCloseTo(286.92, 2)

  const output = buildDerivedXml(parsed, 'water', map)
  expect(output.gross).toBe(166.22)
  expect(output.payable).toBe(166.22)
  expect(output.xml).not.toContain('ODVOZ KOMUNALNIH ODPADKOV')
  const reparsed = parseEslogXml(output.xml)
  expect(reparsed.invoiceNumber).toBe('TEST-MESANI-001')
  expect(reparsed.lines).toHaveLength(7)
  expect(validateParsed(reparsed).errors).toEqual([])
  expect(validateParsed(reparsed).warnings.some((issue) => issue.code === 'TAX_SUMMARY_MISMATCH')).toBe(false)
})

test('realistic water-only invoice remains 85.06 EUR', () => {
  const { parsed, map } = assignments(waterXml)
  expect(parsed.lines).toHaveLength(7)
  expect(validateParsed(parsed).errors).toEqual([])
  expect(Array.from(map.values())).toEqual(Array(7).fill('water'))
  const output = buildDerivedXml(parsed, 'water', map)
  expect(output.gross).toBe(85.06)
  expect(output.payable).toBe(85.06)
  expect(parseEslogXml(output.xml).lines).toHaveLength(7)
})

test('all realistic sources and generated XML validate against the official eSLOG XSD', () => {
  const generated = [
    mixedXml,
    waterXml,
    buildDerivedXml(assignments(mixedXml).parsed, 'water', assignments(mixedXml).map).xml,
    buildDerivedXml(assignments(mixedXml).parsed, 'waste', assignments(mixedXml).map).xml,
    buildDerivedXml(assignments(waterXml).parsed, 'water', assignments(waterXml).map).xml,
  ]
  const paths = generated.map((xml, index) => {
    const path = join(tmpdir(), `eslog-splitter-xsd-${process.pid}-${index}.xml`)
    writeFileSync(path, xml, 'utf8')
    return path
  })
  const script = [
    'import sys',
    'from lxml import etree',
    'schema=etree.XMLSchema(etree.parse(sys.argv[1]))',
    'failed=[]',
    'for path in sys.argv[2:]:',
    '  doc=etree.parse(path)',
    '  if not schema.validate(doc): failed.append(path + ": " + str(schema.error_log.last_error))',
    'print("\\n".join(failed))',
    'sys.exit(1 if failed else 0)',
  ].join('\n')
  const bundledPython = process.env.USERPROFILE
    ? join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
    : ''
  const candidates = [process.env.PYTHON, bundledPython, 'python3', 'python'].filter(Boolean) as string[]
  const python = candidates.find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0)
  expect(python, 'Python z lxml je potreben za XSD preizkus').toBeTruthy()
  const result = spawnSync(python!, ['-c', script, 'tests/schema/eSLOG20_INVOIC_v200.xsd', ...paths], { encoding: 'utf8' })
  expect(result.error, 'Python z lxml je potreben za XSD preizkus').toBeUndefined()
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  for (const xml of generated.slice(2)) expect(xml).not.toContain('<ds:Signature')
})
