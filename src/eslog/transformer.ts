import { ParsedInvoice } from './types'

export function cloneDocument(doc: Document) {
  return doc.cloneNode(true) as Document
}

function removeSignature(doc: Document) {
  const sig = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')
  for (let i = sig.length - 1; i >= 0; i--) {
    const el = sig[i]
    el.parentNode?.removeChild(el)
  }
}

function findAllByLocalName(doc: Document, localName: string) {
  const out: Element[] = []
  const all = doc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as Element
    if (el.localName === localName) out.push(el)
  }
  return out
}

export function buildDerivedXml(parsed: ParsedInvoice, keepCategory: 'water' | 'waste', selectedLineIds: Set<string>) {
  const doc = cloneDocument(parsed.doc)
  const groups = findAllByLocalName(doc, 'G_SG26')
  groups.forEach((g) => {
    const idEl = (function find(el: Element | null): Element | null {
      if (!el) return null
      const nodes = el.getElementsByTagName('*')
      for (let i = 0; i < nodes.length; i++) {
        if ((nodes[i] as Element).localName === 'D_1082') return nodes[i] as Element
      }
      return null
    })(g)
    const id = idEl?.textContent?.trim() || ''
    if (!selectedLineIds.has(id)) {
      g.parentNode?.removeChild(g)
    }
  })

  // renumber remaining
  const remaining = findAllByLocalName(doc, 'G_SG26')
  remaining.forEach((g, idx) => {
    const nodes = g.getElementsByTagName('*')
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as Element
      if (el.localName === 'D_1082') {
        el.textContent = String(idx + 1)
        break
      }
    }
  })

  removeSignature(doc)

  const serialized = new XMLSerializer().serializeToString(doc)
  // Strip any declaration the serializer may have added (browser-dependent) then prepend a consistent one
  const body = serialized.replace(/^<\?xml[^?]*\?>\s*/i, '')
  return `<?xml version="1.0" encoding="utf-8"?>\n${body}`
}
