import Decimal from 'decimal.js'
import { builtInKomunalaNovoMesto, Category, ResolvedCategory, supportsSupplier } from './classifier'
import { normalizeKomunalaDescription } from './descriptionNormalizer'
import { normalizeKomunalaWaterMeterReference } from './meterNormalizer'
import { ParsedInvoice, TaxGroup } from './types'
import { decimalOrNull, taxKey } from './validator'

const ESLOG_NS = 'urn:eslog:2.00'
const CATEGORIES: Category[] = ['water', 'waste', 'unknown']

export interface CategoryAmounts {
  lineNet: string
  lineVat: string
  lineGross: string
  allowances: string
  charges: string
  prepaid: string
  rounding: string
}

export interface AllocationPlan {
  categories: Record<Category, CategoryAmounts>
  adjustmentAmounts: Record<number, Record<Category, string>>
}

export interface DerivedXmlResult {
  xml: string
  net: number
  vat: number
  gross: number
  payable: number
}

const zeroAmounts = (): CategoryAmounts => ({
  lineNet: '0.00', lineVat: '0.00', lineGross: '0.00', allowances: '0.00',
  charges: '0.00', prepaid: '0.00', rounding: '0.00',
})
const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
const decimal = (value?: string) => decimalOrNull(value) || new Decimal(0)

function allByLocalName(el: Element | Document, localName: string): Element[] {
  return Array.from(el.getElementsByTagName('*')).filter((node) => node.localName === localName)
}

function direct(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((node) => node.localName === localName)
}

function first(el: Element | Document, localName: string): Element | null {
  return allByLocalName(el, localName)[0] || null
}

function text(el: Element | Document, localName: string): string | undefined {
  return first(el, localName)?.textContent?.trim() || undefined
}

function message(doc: Document): Element {
  return direct(doc.documentElement, 'M_INVOIC')[0] || doc.documentElement
}

function getMoaEl(container: Element, code: string): Element | null {
  for (const moa of allByLocalName(container, 'S_MOA')) {
    if (text(moa, 'D_5025') === code) return first(moa, 'D_5004')
  }
  return null
}

function setMoaValue(container: Element, code: string, value: string): void {
  const element = getMoaEl(container, code)
  if (element) element.textContent = value
}

function distribute(value: string | undefined, weights: Record<Category, Decimal>): Record<Category, string> {
  const result: Record<Category, string> = { water: '0.00', waste: '0.00', unknown: '0.00' }
  const totalValue = decimal(value)
  const active = CATEGORIES.filter((category) => weights[category].greaterThan(0))
  const totalWeight = active.reduce((sum, category) => sum.plus(weights[category]), new Decimal(0))
  if (active.length === 0 || totalWeight.isZero() || totalValue.isZero()) return result
  let assigned = new Decimal(0)
  active.forEach((category, index) => {
    const part = index === active.length - 1
      ? totalValue.minus(assigned)
      : totalValue.times(weights[category]).dividedBy(totalWeight).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    result[category] = money(part)
    assigned = assigned.plus(part)
  })
  return result
}

export function buildAllocationPlan(
  parsed: ParsedInvoice,
  assignments: Map<number, ResolvedCategory>,
): AllocationPlan {
  const categories: Record<Category, CategoryAmounts> = {
    water: zeroAmounts(), waste: zeroAmounts(), unknown: zeroAmounts(),
  }
  const weights: Record<Category, Decimal> = { water: new Decimal(0), waste: new Decimal(0), unknown: new Decimal(0) }
  for (const line of parsed.lines) {
    const resolved = assignments.get(line.internalIndex) || 'unknown'
    const category: Category = resolved === 'water' || resolved === 'waste' ? resolved : 'unknown'
    const values = categories[category]
    values.lineNet = money(decimal(values.lineNet).plus(decimal(line.net)))
    values.lineVat = money(decimal(values.lineVat).plus(decimal(line.vat)))
    values.lineGross = money(decimal(values.lineGross).plus(decimal(line.gross)))
    weights[category] = weights[category].plus(decimal(line.gross))
  }

  const adjustmentAmounts: Record<number, Record<Category, string>> = {}
  parsed.adjustments.forEach((adjustment, index) => {
    const parts = distribute(adjustment.amount, weights)
    adjustmentAmounts[index] = parts
    for (const category of CATEGORIES) {
      const field = adjustment.kind === 'allowance' ? 'allowances' : 'charges'
      categories[category][field] = money(decimal(categories[category][field]).plus(parts[category]))
    }
  })
  if (parsed.adjustments.length === 0) {
    const allowances = distribute(parsed.totals.allowances, weights)
    const charges = distribute(parsed.totals.charges, weights)
    for (const category of CATEGORIES) {
      categories[category].allowances = allowances[category]
      categories[category].charges = charges[category]
    }
  }
  const prepaid = distribute(parsed.totals.prepaid, weights)
  const rounding = distribute(parsed.totals.rounding, weights)
  for (const category of CATEGORIES) {
    categories[category].prepaid = prepaid[category]
    categories[category].rounding = rounding[category]
  }
  return { categories, adjustmentAmounts }
}

function asAssignments(
  parsed: ParsedInvoice,
  keepCategory: 'water' | 'waste',
  input: Map<number, ResolvedCategory> | Set<number> | Set<string>,
): Map<number, ResolvedCategory> {
  if (input instanceof Map) return input
  const values = input as Set<number | string>
  return new Map(parsed.lines.map((line) => [
    line.internalIndex,
    values.has(line.internalIndex) || values.has(line.lineId)
      ? keepCategory
      : keepCategory === 'water' ? 'waste' : 'water',
  ]))
}

function removeSignature(doc: Document): void {
  const signatures = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')
  for (let index = signatures.length - 1; index >= 0; index--) signatures[index].remove()
}

function normalizePetrolFields(doc: Document, source: ParsedInvoice, category: 'water' | 'waste'): void {
  if (!supportsSupplier(source.supplier, builtInKomunalaNovoMesto)) return
  for (const group of direct(message(doc), 'G_SG26')) {
    const supplierItemCodes = new Set(direct(group, 'S_PIA')
      .filter((pia) => text(pia, 'D_7143') === 'SA')
      .map((pia) => text(pia, 'D_7140'))
      .filter((value): value is string => Boolean(value)))
    for (const pia of direct(group, 'S_PIA')) {
      const itemCode = text(pia, 'D_7140')
      if (text(pia, 'D_7143') === 'UP' && itemCode && supplierItemCodes.has(itemCode)) pia.remove()
    }
    const description = first(group, 'D_7008')
    if (description?.textContent) {
      description.textContent = normalizeKomunalaDescription(description.textContent)
    }
    if (category !== 'water') continue
    for (const reference of allByLocalName(group, 'C_C506')) {
      const qualifier = text(reference, 'D_1153')
      const value = first(reference, 'D_1154')
      if ((qualifier === 'AWE' || qualifier === 'AVE') && value?.textContent) {
        value.textContent = normalizeKomunalaWaterMeterReference(value.textContent)
      }
    }
  }
}

function makeTextElement(doc: Document, name: string, value: string): Element {
  const node = doc.createElementNS(ESLOG_NS, name)
  node.textContent = value
  return node
}

function makeMoa(doc: Document, code: string, value: string): Element {
  const moa = doc.createElementNS(ESLOG_NS, 'S_MOA')
  const composite = doc.createElementNS(ESLOG_NS, 'C_C516')
  composite.append(makeTextElement(doc, 'D_5025', code), makeTextElement(doc, 'D_5004', value))
  moa.append(composite)
  return moa
}

function makeTaxSummary(doc: Document, group: TaxGroup, base: string, tax: string): Element {
  const summary = doc.createElementNS(ESLOG_NS, 'G_SG52')
  const taxNode = doc.createElementNS(ESLOG_NS, 'S_TAX')
  taxNode.append(makeTextElement(doc, 'D_5283', '7'))
  const type = doc.createElementNS(ESLOG_NS, 'C_C241')
  type.append(makeTextElement(doc, 'D_5153', group.taxType))
  taxNode.append(type)
  const rate = doc.createElementNS(ESLOG_NS, 'C_C243')
  rate.append(makeTextElement(doc, 'D_5278', new Decimal(group.rate || 0).toString()))
  taxNode.append(rate)
  if (group.category) taxNode.append(makeTextElement(doc, 'D_5305', group.category))
  summary.append(taxNode, makeMoa(doc, '124', tax), makeMoa(doc, '125', base))
  return summary
}

function rebuildTaxSummaries(doc: Document, source: ParsedInvoice, keptIndexes: Set<number>, category: Category, plan: AllocationPlan): string {
  const taxGroups = new Map<string, { group: TaxGroup; base: Decimal; tax: Decimal }>()
  for (const line of source.lines) {
    if (!keptIndexes.has(line.internalIndex)) continue
    for (const group of line.taxGroups) {
      if (group.base === undefined && group.tax === undefined) continue
      const key = taxKey(group)
      const current = taxGroups.get(key) || { group, base: new Decimal(0), tax: new Decimal(0) }
      current.base = current.base.plus(decimal(group.base))
      current.tax = current.tax.plus(decimal(group.tax))
      taxGroups.set(key, current)
    }
  }

  source.adjustments.forEach((adjustment, index) => {
    if (!adjustment.tax) return
    const amount = decimal(plan.adjustmentAmounts[index]?.[category])
    if (amount.isZero()) return
    const key = taxKey(adjustment.tax)
    const current = taxGroups.get(key) || { group: adjustment.tax, base: new Decimal(0), tax: new Decimal(0) }
    const signedBase = adjustment.kind === 'allowance' ? amount.negated() : amount
    const signedTax = signedBase.times(decimal(adjustment.tax.rate)).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    current.base = current.base.plus(signedBase)
    current.tax = current.tax.plus(signedTax)
    taxGroups.set(key, current)
  })

  const rootMessage = message(doc)
  direct(rootMessage, 'G_SG52').forEach((node) => node.remove())
  const insertBefore = direct(rootMessage, 'G_SG53')[0] || direct(rootMessage, 'S_UNT')[0] || null
  for (const item of taxGroups.values()) {
    rootMessage.insertBefore(makeTaxSummary(doc, item.group, money(item.base), money(item.tax)), insertBefore)
  }
  return money(Array.from(taxGroups.values()).reduce((sum, item) => sum.plus(item.tax), new Decimal(0)))
}

function updateAdjustments(doc: Document, source: ParsedInvoice, category: Category, plan: AllocationPlan): void {
  const groups = direct(message(doc), 'G_SG16')
  const recognized = new Map(source.adjustments.map((adjustment, index) => [adjustment.internalIndex, { adjustment, index }]))
  groups.forEach((group, sourceIndex) => {
    const item = recognized.get(sourceIndex)
    if (!item) return
    const allocated = plan.adjustmentAmounts[item.index]?.[category] || '0.00'
    if (decimal(allocated).isZero()) {
      group.remove()
      return
    }
    setMoaValue(group, item.adjustment.kind === 'allowance' ? '204' : '23', allocated)
    const original = decimal(item.adjustment.amount)
    const originalBase = decimal(item.adjustment.base)
    if (!original.isZero() && !originalBase.isZero()) {
      setMoaValue(group, '25', money(originalBase.times(decimal(allocated)).dividedBy(original)))
    }
    const taxGroup = direct(group, 'G_SG22')[0]
    if (taxGroup && item.adjustment.tax) {
      const allocatedTaxBase = decimal(allocated)
      const allocatedTax = allocatedTaxBase.times(decimal(item.adjustment.tax.rate))
        .dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      setMoaValue(taxGroup, '125', money(allocatedTaxBase))
      setMoaValue(taxGroup, '124', money(allocatedTax))
    }
  })
}

function updateSummary(doc: Document, amounts: CategoryAmounts, vat: string): DerivedXmlResult {
  const lineNet = decimal(amounts.lineNet)
  const allowances = decimal(amounts.allowances)
  const charges = decimal(amounts.charges)
  const taxExclusive = lineNet.minus(allowances).plus(charges)
  const taxInclusive = taxExclusive.plus(decimal(vat))
  const payable = taxInclusive.minus(decimal(amounts.prepaid)).plus(decimal(amounts.rounding))
  const values: Record<string, string> = {
    '79': money(lineNet), '260': money(allowances), '259': money(charges),
    '389': money(taxExclusive), '125': money(taxExclusive), '129': money(taxExclusive), '98': money(taxExclusive),
    '2': money(vat), '176': money(vat), '388': money(taxInclusive), '86': money(taxInclusive),
    '113': money(amounts.prepaid), '366': money(amounts.rounding), '9': money(payable),
  }
  for (const group of direct(message(doc), 'G_SG50')) {
    const code = text(group, 'D_5025')
    if (code && values[code] !== undefined) setMoaValue(group, code, values[code])
  }
  return { xml: '', net: taxExclusive.toNumber(), vat: decimal(vat).toNumber(), gross: taxInclusive.toNumber(), payable: payable.toNumber() }
}

export function buildDerivedXml(
  parsed: ParsedInvoice,
  keepCategory: 'water' | 'waste',
  inputAssignments: Map<number, ResolvedCategory> | Set<number> | Set<string>,
): DerivedXmlResult {
  const assignments = asAssignments(parsed, keepCategory, inputAssignments)
  const plan = buildAllocationPlan(parsed, assignments)
  const doc = parsed.doc.cloneNode(true) as Document
  const keptIndexes = new Set(parsed.lines.filter((line) => assignments.get(line.internalIndex) === keepCategory).map((line) => line.internalIndex))
  direct(message(doc), 'G_SG26').forEach((group, index) => {
    if (!keptIndexes.has(index)) group.remove()
  })
  direct(message(doc), 'G_SG26').forEach((group, index) => {
    const id = first(group, 'D_1082')
    if (id) id.textContent = String(index + 1)
  })
  normalizePetrolFields(doc, parsed, keepCategory)
  updateAdjustments(doc, parsed, keepCategory, plan)
  const vat = rebuildTaxSummaries(doc, parsed, keptIndexes, keepCategory, plan)
  const result = updateSummary(doc, plan.categories[keepCategory], vat)
  if (keepCategory === 'waste') {
    const invoiceNumber = first(doc, 'D_1004')
    if (invoiceNumber?.textContent) invoiceNumber.textContent = `${invoiceNumber.textContent.trim()}-01`
  }
  removeSignature(doc)
  const serialized = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>\s*/i, '')
  result.xml = `<?xml version="1.0" encoding="utf-8"?>\n${serialized}`
  return result
}
