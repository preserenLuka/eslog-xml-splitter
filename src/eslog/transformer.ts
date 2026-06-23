import { ParsedInvoice } from './types'

const ESLOG_NS = 'urn:eslog:2.00'

export function cloneDocument(doc: Document) {
  return doc.cloneNode(true) as Document
}

function removeSignature(doc: Document) {
  const sig = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')
  for (let i = sig.length - 1; i >= 0; i--) {
    sig[i].parentNode?.removeChild(sig[i])
  }
}

function findAllByLocalName(doc: Document, localName: string): Element[] {
  const out: Element[] = []
  const all = doc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    if ((all[i] as Element).localName === localName) out.push(all[i] as Element)
  }
  return out
}

function findIn(el: Element, localName: string): Element | null {
  const nodes = el.getElementsByTagName('*')
  for (let i = 0; i < nodes.length; i++) {
    if ((nodes[i] as Element).localName === localName) return nodes[i] as Element
  }
  return null
}

function findAllIn(el: Element, localName: string): Element[] {
  const out: Element[] = []
  const nodes = el.getElementsByTagName('*')
  for (let i = 0; i < nodes.length; i++) {
    if ((nodes[i] as Element).localName === localName) out.push(nodes[i] as Element)
  }
  return out
}

// Returns numeric value of S_MOA with given D_5025 code inside container
function getMoaValue(container: Element, code: string): number {
  for (const moa of findAllIn(container, 'S_MOA')) {
    if (findIn(moa, 'D_5025')?.textContent?.trim() === code) {
      return parseFloat(findIn(moa, 'D_5004')?.textContent?.trim() || '0') || 0
    }
  }
  return 0
}

// Returns the D_5004 element of S_MOA with given D_5025 code inside container
function getMoaEl(container: Element, code: string): Element | null {
  for (const moa of findAllIn(container, 'S_MOA')) {
    if (findIn(moa, 'D_5025')?.textContent?.trim() === code) {
      return findIn(moa, 'D_5004')
    }
  }
  return null
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)

function makeMeterRef(doc: Document, qualifier: string, value: string): Element {
  const g = doc.createElementNS(ESLOG_NS, 'G_SG30')
  const rff = doc.createElementNS(ESLOG_NS, 'S_RFF')
  const c = doc.createElementNS(ESLOG_NS, 'C_C506')
  const q = doc.createElementNS(ESLOG_NS, 'D_1153')
  const v = doc.createElementNS(ESLOG_NS, 'D_1154')
  q.textContent = qualifier
  v.textContent = value
  c.appendChild(q); c.appendChild(v)
  rff.appendChild(c); g.appendChild(rff)
  return g
}

// All waste lines get the same dominant AWE/AVE so iot.petrol.si groups them under one MM
function unifyWasteMeterRefs(doc: Document): void {
  const lines = findAllByLocalName(doc, 'G_SG26')

  const aweCount: Record<string, number> = {}
  const aveCount: Record<string, number> = {}
  for (const line of lines) {
    for (const sg30 of findAllIn(line, 'G_SG30')) {
      const qual = findIn(sg30, 'D_1153')?.textContent?.trim()
      const val = findIn(sg30, 'D_1154')?.textContent?.trim()
      if (!val) continue
      if (qual === 'AWE') aweCount[val] = (aweCount[val] || 0) + 1
      if (qual === 'AVE') aveCount[val] = (aveCount[val] || 0) + 1
    }
  }

  const topAWE = Object.entries(aweCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const topAVE = Object.entries(aveCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!topAWE && !topAVE) return

  for (const line of lines) {
    const sg30s = findAllIn(line, 'G_SG30')
    const hasAWE = sg30s.some(s => findIn(s, 'D_1153')?.textContent?.trim() === 'AWE')
    const hasAVE = sg30s.some(s => findIn(s, 'D_1153')?.textContent?.trim() === 'AVE')
    const anchor = findIn(line, 'G_SG34')
    if (!hasAWE && topAWE) line.insertBefore(makeMeterRef(doc, 'AWE', topAWE), anchor)
    if (!hasAVE && topAVE) line.insertBefore(makeMeterRef(doc, 'AVE', topAVE), anchor)
  }
}

function recalculateTotals(doc: Document): { net: number; gross: number } {
  const lines = findAllByLocalName(doc, 'G_SG26')

  let totalNet = 0
  let totalGross = 0
  // vatMap keyed by rate string — groups all categories at same rate (matching G_SG52 structure)
  const vatMap: Record<string, { base: number; vat: number; rate: string; category: string }> = {}

  for (const line of lines) {
    totalNet += getMoaValue(line, '203')
    totalGross += getMoaValue(line, '66')

    for (const sg34 of findAllIn(line, 'G_SG34')) {
      const rate = findIn(sg34, 'D_5278')?.textContent?.trim() || '0'
      const category = findIn(sg34, 'D_5305')?.textContent?.trim() || 'S'
      if (!vatMap[rate]) vatMap[rate] = { base: 0, vat: 0, rate, category }
      vatMap[rate].base += getMoaValue(sg34, '125')
      vatMap[rate].vat += getMoaValue(sg34, '124')
    }
  }

  const totalVat = Object.values(vatMap).reduce((s, v) => s + v.vat, 0)

  // Update G_SG50 summary amounts
  const grossCodes = new Set(['9', '86', '388'])
  const netCodes = new Set(['79', '125', '129', '389', '98'])

  for (const sg50 of findAllByLocalName(doc, 'G_SG50')) {
    const code = findIn(sg50, 'D_5025')?.textContent?.trim()
    const d5004 = getMoaEl(sg50, code || '')
    if (!code || !d5004) continue
    if (grossCodes.has(code)) d5004.textContent = fmt(totalGross)
    else if (netCodes.has(code)) d5004.textContent = fmt(totalNet)
    else if (code === '176') d5004.textContent = fmt(totalVat)
    // codes 53, 400 (prepaid/advance = 0) left unchanged
  }

  // Update G_SG52 VAT breakdown per rate; remove entries for rates absent in remaining lines
  for (const sg52 of findAllByLocalName(doc, 'G_SG52')) {
    const rate = findIn(sg52, 'D_5278')?.textContent?.trim() || '0'
    if (vatMap[rate]) {
      const vatEl = getMoaEl(sg52, '124')
      const baseEl = getMoaEl(sg52, '125')
      if (vatEl) vatEl.textContent = fmt(vatMap[rate].vat)
      if (baseEl) baseEl.textContent = fmt(vatMap[rate].base)
    } else {
      sg52.parentNode?.removeChild(sg52)
    }
  }

  return {
    net: Math.round(totalNet * 100) / 100,
    gross: Math.round(totalGross * 100) / 100,
  }
}

export function buildDerivedXml(parsed: ParsedInvoice, keepCategory: 'water' | 'waste', selectedLineIds: Set<string>) {
  const doc = cloneDocument(parsed.doc)

  // Remove lines not belonging to this category
  findAllByLocalName(doc, 'G_SG26').forEach((g) => {
    const idEl = (function find(el: Element | null): Element | null {
      if (!el) return null
      const nodes = el.getElementsByTagName('*')
      for (let i = 0; i < nodes.length; i++) {
        if ((nodes[i] as Element).localName === 'D_1082') return nodes[i] as Element
      }
      return null
    })(g)
    if (!selectedLineIds.has(idEl?.textContent?.trim() || '')) {
      g.parentNode?.removeChild(g)
    }
  })

  // Renumber remaining lines sequentially
  findAllByLocalName(doc, 'G_SG26').forEach((g, idx) => {
    const nodes = g.getElementsByTagName('*')
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as Element
      if (el.localName === 'D_1082') { el.textContent = String(idx + 1); break }
    }
  })

  // Ensure all waste lines share the dominant meter reference (some lines lack AWE/AVE)
  if (keepCategory === 'waste') unifyWasteMeterRefs(doc)

  // Recalculate totals and VAT breakdown from remaining lines only
  const totals = recalculateTotals(doc)

  // Waste invoice gets -01 suffix to avoid duplicate invoice number conflict
  if (keepCategory === 'waste') {
    const invoiceNumEl = findAllByLocalName(doc, 'D_1004')[0]
    if (invoiceNumEl?.textContent) {
      invoiceNumEl.textContent = invoiceNumEl.textContent.trim() + '-01'
    }
  }

  removeSignature(doc)

  const serialized = new XMLSerializer().serializeToString(doc)
  const body = serialized.replace(/^<\?xml[^?]*\?>\s*/i, '')
  return { xml: `<?xml version="1.0" encoding="utf-8"?>\n${body}`, net: totals.net, gross: totals.gross }
}
