import Decimal from 'decimal.js'
import { DocumentAdjustment, InvoiceParty, InvoiceTotals, LineItem, MeterReference, ParsedInvoice, TaxGroup } from './types'

function descendants(el: Element | Document, localName: string): Element[] {
  return Array.from(el.getElementsByTagName('*')).filter((node) => node.localName === localName)
}

function first(el: Element | Document, localName: string): Element | null {
  return descendants(el, localName)[0] || null
}

function direct(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((node) => node.localName === localName)
}

function text(el: Element | Document, localName: string): string | undefined {
  return first(el, localName)?.textContent?.trim() || undefined
}

function moaValue(container: Element, code: string): string | undefined {
  for (const moa of descendants(container, 'S_MOA')) {
    if (text(moa, 'D_5025') === code) return text(moa, 'D_5004')
  }
  return undefined
}

function parseTaxGroup(container: Element): TaxGroup {
  return {
    taxType: text(container, 'D_5153') || 'VAT',
    category: text(container, 'D_5305') || '',
    rate: text(container, 'D_5278') || '0',
    base: moaValue(container, '125'),
    tax: moaValue(container, '124'),
  }
}

function sumTax(groups: TaxGroup[]): string | undefined {
  const amounts = groups
    .filter((group) => group.taxType === 'VAT' && group.tax !== undefined)
    .map((group) => group.tax as string)
  if (amounts.length === 0) return undefined
  try {
    return amounts.reduce((sum, value) => sum.plus(new Decimal(value)), new Decimal(0)).toFixed(2)
  } catch {
    return amounts[0]
  }
}

function parseMeterReferences(line: Element): MeterReference[] {
  const pairs: MeterReference[] = []
  let current: MeterReference = { AWE: null, AVE: null }
  for (const group of direct(line, 'G_SG30')) {
    for (const reference of descendants(group, 'C_C506')) {
      const qualifier = text(reference, 'D_1153')
      const value = text(reference, 'D_1154') || null
      if (qualifier === 'AWE') {
        if (current.AWE !== null || current.AVE !== null) pairs.push(current)
        current = { AWE: value, AVE: null }
      } else if (qualifier === 'AVE') {
        current.AVE = value
        pairs.push(current)
        current = { AWE: null, AVE: null }
      }
    }
  }
  if (current.AWE !== null || current.AVE !== null) pairs.push(current)
  return pairs.filter((pair, index, all) =>
    all.findIndex((candidate) => candidate.AWE === pair.AWE && candidate.AVE === pair.AVE) === index,
  )
}

function parseParty(group: Element): InvoiceParty | undefined {
  const nad = direct(group, 'S_NAD')[0]
  if (!nad) return undefined
  const qualifier = text(nad, 'D_3035')
  if (!qualifier) return undefined
  const identifiers: Record<string, string> = {}
  for (const reference of descendants(group, 'C_C506')) {
    const key = text(reference, 'D_1153')
    const value = text(reference, 'D_1154')
    if (key && value) identifiers[key] = value
  }
  return { qualifier, name: text(nad, 'D_3036'), identifiers }
}

function headerDate(message: Element, qualifier: string): string | undefined {
  for (const dtm of direct(message, 'S_DTM')) {
    if (text(dtm, 'D_2005') === qualifier) return text(dtm, 'D_2380')
  }
  return undefined
}

export function parseEslogXml(xmlText: string, filename?: string): ParsedInvoice {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML_PARSE_ERROR')

  const root = doc.documentElement
  const message = direct(root, 'M_INVOIC')[0] || root
  const invoiceNumber = text(direct(message, 'S_BGM')[0] || message, 'D_1004')
  const parties = direct(message, 'G_SG2').map(parseParty).filter((party): party is InvoiceParty => Boolean(party))
  const supplier = parties.find((party) => party.qualifier === 'II') || parties.find((party) => party.qualifier === 'SE')

  const lines: LineItem[] = direct(message, 'G_SG26').map((group, internalIndex) => {
    const taxGroups = direct(group, 'G_SG34').map(parseTaxGroup)
    const meters = parseMeterReferences(group)
    return {
      internalIndex,
      lineId: text(group, 'D_1082') || '',
      serviceCode: text(group, 'D_7140'),
      description: text(group, 'D_7008'),
      quantity: text(group, 'D_6060'),
      unit: text(group, 'D_6411'),
      net: moaValue(group, '203'),
      gross: moaValue(group, '66'),
      vat: sumTax(taxGroups),
      taxRate: taxGroups.find((tax) => tax.taxType === 'VAT')?.rate,
      taxCategory: taxGroups.find((tax) => tax.taxType === 'VAT')?.category,
      taxGroups,
      meterReferences: meters,
      AWE: meters[0]?.AWE || null,
      AVE: meters[0]?.AVE || null,
      rawNode: group,
    }
  })

  const byCode: Record<string, string> = {}
  for (const group of direct(message, 'G_SG50')) {
    const code = text(group, 'D_5025')
    const value = text(group, 'D_5004')
    if (code && value !== undefined) byCode[code] = value
  }
  const totals: InvoiceTotals = {
    lineNet: byCode['79'], allowances: byCode['260'], charges: byCode['259'],
    taxExclusive: byCode['389'], vat: byCode['2'] || byCode['176'], taxInclusive: byCode['388'],
    prepaid: byCode['113'], rounding: byCode['366'], payable: byCode['9'], byCode,
  }
  const taxSummaries = direct(message, 'G_SG52').map(parseTaxGroup)

  const adjustments: DocumentAdjustment[] = direct(message, 'G_SG16').flatMap((group, internalIndex) => {
    const indicator = text(group, 'D_5463')
    const code = indicator === 'A' ? '204' : indicator === 'C' ? '23' : ''
    const amount = code ? moaValue(group, code) : undefined
    if (!amount || !indicator) return []
    const taxNode = direct(group, 'G_SG22')[0]
    return [{
      internalIndex,
      kind: indicator === 'A' ? 'allowance' as const : 'charge' as const,
      amount,
      base: moaValue(group, '25'),
      tax: taxNode ? parseTaxGroup(taxNode) : undefined,
      rawNode: group,
    }]
  })

  const numeric = (value?: string) => {
    if (value === undefined) return undefined
    try { return new Decimal(value).toNumber() } catch { return undefined }
  }

  return {
    filename, doc, rootName: root.localName, namespace: root.namespaceURI, invoiceNumber,
    issueDate: headerDate(message, '137'),
    periodStart: headerDate(message, '167') || null,
    periodEnd: headerDate(message, '168') || null,
    supplier, lines, totals, taxSummaries, adjustments,
    totalNet: numeric(totals.taxExclusive || totals.lineNet),
    totalGross: numeric(totals.taxInclusive),
  }
}
