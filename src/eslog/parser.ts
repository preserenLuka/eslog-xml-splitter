import { ParsedInvoice, LineItem } from './types'

function findDesc(el: Element | Document, localName: string): Element | null {
  const iter = (el as Element).getElementsByTagName ? (el as Element).getElementsByTagName('*') : (el as Document).getElementsByTagName('*')
  for (let i = 0; i < iter.length; i++) {
    const n = iter[i] as Element
    if (n.localName === localName) return n
  }
  return null
}

function findAllDesc(el: Element | Document, localName: string): Element[] {
  const out: Element[] = []
  const iter = (el as Element).getElementsByTagName ? (el as Element).getElementsByTagName('*') : (el as Document).getElementsByTagName('*')
  for (let i = 0; i < iter.length; i++) {
    const n = iter[i] as Element
    if (n.localName === localName) out.push(n)
  }
  return out
}

export function parseEslogXml(xmlText: string, filename?: string): ParsedInvoice {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')
  if (err.length) throw new Error('XML parse error')

  const invoiceNumber = findDesc(doc, 'D_1004')?.textContent?.trim() || undefined

  // find period start/end by searching S_DTM groups
  let periodStart: string | null = null
  let periodEnd: string | null = null
  const s_dtms = findAllDesc(doc, 'S_DTM')
  s_dtms.forEach((s) => {
    const cc507 = findDesc(s, 'C_C507')
    if (!cc507) return
    const qualifier = findDesc(cc507, 'D_2005')?.textContent?.trim()
    const value = findDesc(cc507, 'D_2380')?.textContent?.trim() || null
    if (qualifier === '167') periodStart = value
    if (qualifier === '168') periodEnd = value
    if (qualifier === '137' && !periodStart) {
      if (!periodStart) periodStart = value
    }
  })

  const lineGroups = findAllDesc(doc, 'G_SG26')
  const lines: LineItem[] = lineGroups.map((g) => {
    const lineId = findDesc(g, 'D_1082')?.textContent?.trim() || ''
    const serviceCode = findDesc(g, 'D_7140')?.textContent?.trim() || undefined
    const description = findDesc(g, 'D_7008')?.textContent?.trim() || undefined
    const quantity = findDesc(g, 'D_6060')?.textContent?.trim() || undefined
    const unit = findDesc(g, 'D_6411')?.textContent?.trim() || undefined

    const net = (() => {
      const moas = findAllDesc(g, 'S_MOA')
      for (const m of moas) {
        const code = findDesc(m, 'D_5025')?.textContent?.trim()
        if (code === '203') return findDesc(m, 'D_5004')?.textContent?.trim()
      }
      return undefined
    })()

    const gross = (() => {
      const moas = findAllDesc(g, 'S_MOA')
      for (const m of moas) {
        const code = findDesc(m, 'D_5025')?.textContent?.trim()
        if (code === '66') return findDesc(m, 'D_5004')?.textContent?.trim()
      }
      return undefined
    })()

    const vat = (() => {
      const g34 = findDesc(g, 'G_SG34')
      if (!g34) return undefined
      const moas = findAllDesc(g34, 'S_MOA')
      for (const m of moas) {
        const code = findDesc(m, 'D_5025')?.textContent?.trim()
        if (code === '124') return findDesc(m, 'D_5004')?.textContent?.trim()
      }
      return undefined
    })()

    const taxRate = findDesc(g, 'D_5278')?.textContent?.trim() || undefined
    const taxCategory = findDesc(g, 'D_5305')?.textContent?.trim() || undefined

    const refEls = findAllDesc(g, 'C_C506')
    let AWE: string | null = null
    let AVE: string | null = null
    refEls.forEach((r) => {
      const qual = findDesc(r, 'D_1153')?.textContent?.trim()
      const val = findDesc(r, 'D_1154')?.textContent?.trim() || null
      if (!qual) return
      if (qual === 'AWE' && val) AWE = val
      if (qual === 'AVE' && val) AVE = val
    })

    return {
      lineId,
      serviceCode,
      description,
      quantity,
      unit,
      net: net || undefined,
      vat: vat || undefined,
      gross: gross || undefined,
      taxRate: taxRate || undefined,
      taxCategory: taxCategory || undefined,
      AWE,
      AVE,
      rawNode: g
    }
  })

  return {
    filename,
    doc,
    invoiceNumber,
    issueDate: undefined,
    periodStart,
    periodEnd,
    lines
  }
}
