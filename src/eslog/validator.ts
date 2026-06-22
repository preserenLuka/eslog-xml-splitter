import { ParsedInvoice } from './types'

export function validateParsed(parsed: ParsedInvoice) {
  const errors: string[] = []
  if (!parsed.doc) errors.push('XML not parsed')
  if (!parsed.lines || parsed.lines.length === 0) {
    errors.push('No invoice lines')
    return { ok: false, errors }
  }

  // check numeric reconciliation
  const origGross = parsed.lines.reduce((s, l) => s + Number(l.gross || 0), 0)
  const net = parsed.lines.reduce((s, l) => s + Number(l.net || 0), 0)
  const vat = parsed.lines.reduce((s, l) => s + Number(l.vat || 0), 0)
  if (Math.abs(net + vat - origGross) > 0.01) errors.push('Net+VAT != Gross')

  return { ok: errors.length === 0, errors }
}
