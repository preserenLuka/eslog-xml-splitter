import Decimal from 'decimal.js'
import { builtInKomunalaNovoMesto, supportsSupplier } from './classifier'
import { ParsedInvoice, TaxGroup } from './types'

export type ValidationSeverity = 'error' | 'warning'
export interface ValidationIssue {
  code: string
  severity: ValidationSeverity
  message: string
  lineIndex?: number
}
export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

const CENT = new Decimal('0.01')

export function decimalOrNull(value: string | undefined): Decimal | null {
  if (value === undefined || value.trim() === '') return null
  try {
    const parsed = new Decimal(value)
    return parsed.isFinite() ? parsed : null
  } catch {
    return null
  }
}

function normalizedRate(value: string): string {
  const parsed = decimalOrNull(value)
  return parsed ? parsed.toFixed(6).replace(/\.?0+$/, '') || '0' : value
}

export function taxKey(group: TaxGroup): string {
  return `${group.taxType}|${group.category}|${normalizedRate(group.rate)}`
}

export function validateParsed(parsed: ParsedInvoice): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const error = (code: string, message: string, lineIndex?: number) => errors.push({ code, severity: 'error', message, lineIndex })
  const warning = (code: string, message: string, lineIndex?: number) => warnings.push({ code, severity: 'warning', message, lineIndex })

  if (parsed.namespace !== 'urn:eslog:2.00') error('UNSUPPORTED_NAMESPACE', 'XML ne uporablja imenskega prostora eSLOG 2.0.')
  if (!['Invoice', 'E_SLOG'].includes(parsed.rootName)) error('UNSUPPORTED_ROOT', 'Korenski element ni podprt račun eSLOG.')
  if (parsed.rootName === 'E_SLOG') warning('LEGACY_ROOT', 'Uporabljena je poenostavljena oziroma starejša korenska oblika E_SLOG.')
  if (!parsed.invoiceNumber) error('MISSING_INVOICE_NUMBER', 'Manjka številka računa.')
  if (parsed.lines.length === 0) error('NO_LINES', 'Račun nima postavk.')
  if (!supportsSupplier(parsed.supplier, builtInKomunalaNovoMesto)) {
    warning('UNSUPPORTED_SUPPLIER', 'Izdajatelj ni prepoznan kot Komunala Novo mesto; preverite vse razvrstitve.')
  }

  const ids = new Set<string>()
  for (const line of parsed.lines) {
    if (!line.lineId) error('MISSING_LINE_ID', `Postavka ${line.internalIndex + 1} nima identifikatorja.`, line.internalIndex)
    else if (ids.has(line.lineId)) error('DUPLICATE_LINE_ID', `Identifikator postavke ${line.lineId} je podvojen.`, line.internalIndex)
    ids.add(line.lineId)

    const net = decimalOrNull(line.net)
    const vat = decimalOrNull(line.vat)
    const gross = decimalOrNull(line.gross)
    if (!net) error('INVALID_LINE_NET', `Postavka ${line.lineId || line.internalIndex + 1} nima veljavnega neto zneska.`, line.internalIndex)
    if (!vat) error('INVALID_LINE_VAT', `Postavka ${line.lineId || line.internalIndex + 1} nima veljavnega DDV.`, line.internalIndex)
    if (!gross) error('INVALID_LINE_GROSS', `Postavka ${line.lineId || line.internalIndex + 1} nima veljavnega bruto zneska.`, line.internalIndex)
    if (net && vat && gross && net.plus(vat).minus(gross).abs().greaterThan(CENT)) {
      error('LINE_TOTAL_MISMATCH', `Neto in DDV postavke ${line.lineId} se ne ujemata z bruto zneskom.`, line.internalIndex)
    }
    for (const group of line.taxGroups) {
      for (const [label, value] of [['osnova', group.base], ['davek', group.tax]] as const) {
        if (value !== undefined && !decimalOrNull(value)) error('INVALID_TAX_AMOUNT', `Postavka ${line.lineId} ima neveljaven znesek (${label}).`, line.internalIndex)
      }
      if (!decimalOrNull(group.rate)) error('INVALID_TAX_RATE', `Postavka ${line.lineId} ima neveljavno davčno stopnjo.`, line.internalIndex)
    }
  }

  for (const [code, value] of Object.entries(parsed.totals.byCode)) {
    if (!decimalOrNull(value)) error('INVALID_SUMMARY_AMOUNT', `Povzetek MOA ${code} nima veljavnega zneska.`)
  }
  if (parsed.rootName === 'Invoice') {
    if (!parsed.totals.lineNet) error('MISSING_LINE_NET_TOTAL', 'Manjka vsota neto postavk (MOA 79).')
    if (!parsed.totals.taxInclusive) error('MISSING_GROSS_TOTAL', 'Manjka skupni bruto znesek (MOA 388).')
    if (!parsed.totals.payable) error('MISSING_PAYABLE_TOTAL', 'Manjka znesek za plačilo (MOA 9).')
  }

  const lineNet = parsed.lines.reduce((sum, line) => sum.plus(decimalOrNull(line.net) || 0), new Decimal(0))
  const lineVat = parsed.lines.reduce((sum, line) => sum.plus(decimalOrNull(line.vat) || 0), new Decimal(0))
  const lineGross = parsed.lines.reduce((sum, line) => sum.plus(decimalOrNull(line.gross) || 0), new Decimal(0))
  const compare = (code: string, actual: Decimal, expected?: string) => {
    const parsedExpected = decimalOrNull(expected)
    if (parsedExpected && actual.minus(parsedExpected).abs().greaterThan(CENT)) {
      warning('SOURCE_TOTAL_MISMATCH', `Povzetek ${code} se ne ujema s seštevkom postavk.`)
    }
  }
  compare('MOA 79', lineNet, parsed.totals.lineNet)
  if (parsed.adjustments.length === 0) {
    compare('MOA 388', lineGross, parsed.totals.taxInclusive)
    compare('DDV', lineVat, parsed.totals.vat)
  }

  const lineTax = new Map<string, { base: Decimal; tax: Decimal }>()
  for (const line of parsed.lines) {
    for (const group of line.taxGroups) {
      if (group.base === undefined && group.tax === undefined) continue
      const key = taxKey(group)
      const current = lineTax.get(key) || { base: new Decimal(0), tax: new Decimal(0) }
      current.base = current.base.plus(decimalOrNull(group.base) || 0)
      current.tax = current.tax.plus(decimalOrNull(group.tax) || 0)
      lineTax.set(key, current)
    }
  }
  const summaryKeys = new Set(parsed.taxSummaries.map(taxKey))
  for (const [key, amounts] of lineTax) {
    const summary = parsed.taxSummaries.find((group) => taxKey(group) === key)
    if (!summary) {
      warning('TAX_SUMMARY_MISMATCH', `Davčni povzetek ne vsebuje skupine ${key}.`)
      continue
    }
    const base = decimalOrNull(summary.base)
    const tax = decimalOrNull(summary.tax)
    if (!base || !tax || base.minus(amounts.base).abs().greaterThan(CENT) || tax.minus(amounts.tax).abs().greaterThan(CENT)) {
      warning('TAX_SUMMARY_MISMATCH', `Davčni povzetek skupine ${key} se ne ujema s postavkami.`)
    }
    summaryKeys.delete(key)
  }
  if (summaryKeys.size) warning('TAX_SUMMARY_MISMATCH', 'Davčni povzetek vsebuje skupine brez pripadajočih postavk.')
  if (parsed.adjustments.length || decimalOrNull(parsed.totals.prepaid)?.abs().greaterThan(0) || decimalOrNull(parsed.totals.rounding)?.abs().greaterThan(0)) {
    warning('PROPORTIONAL_ADJUSTMENT', 'Predplačila, popusti, dodatki ali zaokrožitve bodo razdeljeni sorazmerno.')
  }

  return { ok: errors.length === 0, errors, warnings }
}
