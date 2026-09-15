import Decimal from 'decimal.js'
import { readFileSync } from 'node:fs'
import { builtInKomunalaNovoMesto, classifyLine } from '../src/eslog/classifier'
import { parseEslogXml } from '../src/eslog/parser'
import { buildAllocationPlan, buildDerivedXml } from '../src/eslog/transformer'
import { LineItem } from '../src/eslog/types'
import { decimalOrNull, taxKey, validateParsed } from '../src/eslog/validator'

function line(serviceCode: string | undefined, description: string): LineItem {
  return { internalIndex: 0, lineId: '1', serviceCode, description, net: '1', vat: '0.1', gross: '1.1', taxGroups: [], meterReferences: [] }
}

function eslogElement(doc: Document, name: string, value?: string): Element {
  const element = doc.createElementNS('urn:eslog:2.00', name)
  if (value !== undefined) element.textContent = value
  return element
}

function addSummaryMoa(doc: Document, code: string, value: string): void {
  const message = Array.from(doc.documentElement.children).find((node) => node.localName === 'M_INVOIC') || doc.documentElement
  const group = eslogElement(doc, 'G_SG50')
  const moa = eslogElement(doc, 'S_MOA')
  const composite = eslogElement(doc, 'C_C516')
  composite.append(eslogElement(doc, 'D_5025', code), eslogElement(doc, 'D_5004', value))
  moa.append(composite)
  group.append(moa)
  const before = Array.from(message.children).find((node) => node.localName === 'G_SG52' || node.localName === 'G_SG53' || node.localName === 'S_UNT') || null
  message.insertBefore(group, before)
}

test('money validation distinguishes zero from missing, invalid and infinite values', () => {
  expect(decimalOrNull('0')?.isZero()).toBe(true)
  expect(decimalOrNull('0.00')?.isZero()).toBe(true)
  expect(decimalOrNull(undefined)).toBeNull()
  expect(decimalOrNull('n/a')).toBeNull()
  expect(decimalOrNull('Infinity')).toBeNull()
})

test('parser and validator reject malformed XML, invalid money and wrong namespaces', () => {
  expect(() => parseEslogXml('<Invoice>')).toThrow('XML_PARSE_ERROR')
  const xml = readFileSync('fixtures/realistic/komunala-voda-anon.xml', 'utf8')
  const parsed = parseEslogXml(xml)
  parsed.lines[0].net = 'Infinity'
  expect(validateParsed(parsed).errors.map((issue) => issue.code)).toContain('INVALID_LINE_NET')
  const wrongNamespace = parseEslogXml(xml.replace('urn:eslog:2.00', 'urn:wrong'))
  expect(validateParsed(wrongNamespace).errors.map((issue) => issue.code)).toContain('UNSUPPORTED_NAMESPACE')
})

test('tax keys normalize numeric rates and preserve tax categories', () => {
  expect(taxKey({ taxType: 'VAT', category: 'S', rate: '9.5' })).toBe(taxKey({ taxType: 'VAT', category: 'S', rate: '9.50' }))
  expect(taxKey({ taxType: 'VAT', category: 'S', rate: '9.5' })).not.toBe(taxKey({ taxType: 'VAT', category: 'Z', rate: '9.5' }))
})

test('all confirmed water codes and specific descriptions classify as water', () => {
  for (const code of builtInKomunalaNovoMesto.waterExact) expect(classifyLine(line(code, 'Storitev'), builtInKomunalaNovoMesto).category).toBe('water')
  expect(classifyLine(line(undefined, 'Omrežnina vodovod'), builtInKomunalaNovoMesto).category).toBe('water')
  expect(classifyLine(line(undefined, 'Vodno povračilo'), builtInKomunalaNovoMesto).category).toBe('water')
  expect(classifyLine(line(undefined, 'Čiščenje objekta'), builtInKomunalaNovoMesto).category).toBe('unknown')
  expect(classifyLine(line(undefined, 'VodarIna in odvoz odpadkov'), builtInKomunalaNovoMesto).category).toBe('unknown')
})

test('validator rejects duplicate and missing line ids', () => {
  const xml = `<?xml version="1.0"?><E_SLOG xmlns="urn:eslog:2.00"><S_BGM><D_1004>X</D_1004></S_BGM>
    <G_SG26><S_LIN><D_1082>1</D_1082></S_LIN><S_MOA><D_5025>203</D_5025><D_5004>0</D_5004></S_MOA><S_MOA><D_5025>66</D_5025><D_5004>0</D_5004></S_MOA><G_SG34><S_TAX><C_C241><D_5153>VAT</D_5153></C_C241><C_C243><D_5278>0</D_5278></C_C243></S_TAX><S_MOA><D_5025>124</D_5025><D_5004>0</D_5004></S_MOA></G_SG34></G_SG26>
    <G_SG26><S_LIN><D_1082>1</D_1082></S_LIN><S_MOA><D_5025>203</D_5025><D_5004>0</D_5004></S_MOA><S_MOA><D_5025>66</D_5025><D_5004>0</D_5004></S_MOA><G_SG34><S_TAX><C_C241><D_5153>VAT</D_5153></C_C241><C_C243><D_5278>0</D_5278></C_C243></S_TAX><S_MOA><D_5025>124</D_5025><D_5004>0</D_5004></S_MOA></G_SG34></G_SG26></E_SLOG>`
  const result = validateParsed(parseEslogXml(xml))
  expect(result.errors.map((issue) => issue.code)).toContain('DUPLICATE_LINE_ID')
  const missing = validateParsed(parseEslogXml(xml.replace('<D_1082>1</D_1082>', '')))
  expect(missing.errors.map((issue) => issue.code)).toContain('MISSING_LINE_ID')
})

test('proportional prepayment and rounding retain the cent residual and unknown share', () => {
  const source = parseEslogXml(`<?xml version="1.0"?><E_SLOG xmlns="urn:eslog:2.00"><S_BGM><D_1004>X</D_1004></S_BGM>
    ${['10.00', '10.00', '10.00'].map((gross, index) => `<G_SG26><S_LIN><D_1082>${index + 1}</D_1082></S_LIN><S_MOA><D_5025>203</D_5025><D_5004>${gross}</D_5004></S_MOA><S_MOA><D_5025>66</D_5025><D_5004>${gross}</D_5004></S_MOA><G_SG34><S_TAX><C_C241><D_5153>VAT</D_5153></C_C241><C_C243><D_5278>0</D_5278></C_C243></S_TAX><S_MOA><D_5025>124</D_5025><D_5004>0</D_5004></S_MOA></G_SG34></G_SG26>`).join('')}
    <G_SG50><S_MOA><D_5025>113</D_5025><D_5004>0.01</D_5004></S_MOA></G_SG50><G_SG50><S_MOA><D_5025>366</D_5025><D_5004>0.01</D_5004></S_MOA></G_SG50></E_SLOG>`)
  const plan = buildAllocationPlan(source, new Map([[0, 'water'], [1, 'waste'], [2, 'unknown']]))
  const prepaid = Object.values(plan.categories).reduce((sum, category) => sum.plus(category.prepaid), new Decimal(0))
  const rounding = Object.values(plan.categories).reduce((sum, category) => sum.plus(category.rounding), new Decimal(0))
  expect(prepaid.toFixed(2)).toBe('0.01')
  expect(rounding.toFixed(2)).toBe('0.01')
  expect(plan.categories.unknown.prepaid).toBe('0.01')
})

test('payable amount remains separate from gross after prepayment and rounding', () => {
  const parsed = parseEslogXml(readFileSync('fixtures/realistic/komunala-voda-anon.xml', 'utf8'))
  addSummaryMoa(parsed.doc, '113', '10.00')
  addSummaryMoa(parsed.doc, '366', '0.01')
  const withPayments = parseEslogXml(new XMLSerializer().serializeToString(parsed.doc))
  const assignments = new Map(withPayments.lines.map((item) => [item.internalIndex, 'water' as const]))
  const output = buildDerivedXml(withPayments, 'water', assignments)
  const reparsed = parseEslogXml(output.xml)
  expect(output.gross).toBe(85.06)
  expect(output.payable).toBe(75.07)
  expect(reparsed.totals.taxInclusive).toBe('85.06')
  expect(reparsed.totals.prepaid).toBe('10.00')
  expect(reparsed.totals.rounding).toBe('0.01')
  expect(reparsed.totals.payable).toBe('75.07')
})

test('document allowance amount and its tax group are split together', () => {
  const parsed = parseEslogXml(readFileSync('fixtures/realistic/komunala-mesani-anon.xml', 'utf8'))
  const message = Array.from(parsed.doc.documentElement.children).find((node) => node.localName === 'M_INVOIC')!
  const group = eslogElement(parsed.doc, 'G_SG16')
  const alc = eslogElement(parsed.doc, 'S_ALC')
  alc.append(eslogElement(parsed.doc, 'D_5463', 'A'))
  const amountGroup = eslogElement(parsed.doc, 'G_SG20')
  const addAmount = (code: string, value: string) => {
    const moa = eslogElement(parsed.doc, 'S_MOA')
    const composite = eslogElement(parsed.doc, 'C_C516')
    composite.append(eslogElement(parsed.doc, 'D_5025', code), eslogElement(parsed.doc, 'D_5004', value))
    moa.append(composite)
    amountGroup.append(moa)
  }
  addAmount('204', '10.00')
  addAmount('25', '453.14')
  const taxGroup = eslogElement(parsed.doc, 'G_SG22')
  const tax = eslogElement(parsed.doc, 'S_TAX')
  tax.append(eslogElement(parsed.doc, 'D_5283', '7'))
  const type = eslogElement(parsed.doc, 'C_C241')
  type.append(eslogElement(parsed.doc, 'D_5153', 'VAT'))
  tax.append(type)
  const rate = eslogElement(parsed.doc, 'C_C243')
  rate.append(eslogElement(parsed.doc, 'D_5278', '9.5'))
  tax.append(rate, eslogElement(parsed.doc, 'D_5305', 'S'))
  taxGroup.append(tax)
  for (const [code, value] of [['124', '0.95'], ['125', '10.00']] as const) {
    const moa = eslogElement(parsed.doc, 'S_MOA')
    const composite = eslogElement(parsed.doc, 'C_C516')
    composite.append(eslogElement(parsed.doc, 'D_5025', code), eslogElement(parsed.doc, 'D_5004', value))
    moa.append(composite)
    taxGroup.append(moa)
  }
  group.append(alc, amountGroup, taxGroup)
  const firstLine = Array.from(message.children).find((node) => node.localName === 'G_SG26')!
  message.insertBefore(group, firstLine)
  addSummaryMoa(parsed.doc, '260', '10.00')

  const source = parseEslogXml(new XMLSerializer().serializeToString(parsed.doc))
  const assignments = new Map(source.lines.map((item) => [item.internalIndex, classifyLine(item, builtInKomunalaNovoMesto).category]))
  const plan = buildAllocationPlan(source, assignments)
  expect(plan.adjustmentAmounts[0].water).toBe('3.67')
  expect(plan.adjustmentAmounts[0].waste).toBe('6.33')
  const water = parseEslogXml(buildDerivedXml(source, 'water', assignments).xml)
  expect(water.adjustments[0].amount).toBe('3.67')
  expect(water.adjustments[0].tax?.base).toBe('3.67')
  expect(water.adjustments[0].tax?.tax).toBe('0.35')
  expect(water.totals.allowances).toBe('3.67')
})
