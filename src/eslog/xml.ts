export function nsResolver(prefix: string | null) {
  // default map includes eslog namespace and ds
  const map: Record<string, string> = {
    eslog: 'urn:eslog:2.00',
    ds: 'http://www.w3.org/2000/09/xmldsig#'
  }
  return (prefix ? map[prefix] : null) || null
}

export function xpathOne(node: Node, xpath: string): Element | null {
  const doc = node.ownerDocument || (node as Document)
  const resolver = (pref: string | null) => nsResolver(pref) || doc.lookupNamespaceURI(pref)
  const result = doc.evaluate(xpath, node, resolver as any, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
  return result.singleNodeValue as Element | null
}

export function xpathAll(node: Node, xpath: string): Element[] {
  const doc = node.ownerDocument || (node as Document)
  const resolver = (pref: string | null) => nsResolver(pref) || doc.lookupNamespaceURI(pref)
  const iter = doc.evaluate(xpath, node, resolver as any, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
  const out: Element[] = []
  let n = iter.iterateNext() as Element | null
  while (n) {
    out.push(n)
    n = iter.iterateNext() as Element | null
  }
  return out
}
