export type Money = string

export interface TaxGroup {
  taxType: string
  category: string
  rate: string
  base?: Money
  tax?: Money
}

export interface MeterReference {
  AWE: string | null
  AVE: string | null
}

export interface InvoiceParty {
  qualifier: string
  name?: string
  identifiers: Record<string, string>
}

export interface InvoiceTotals {
  lineNet?: Money
  allowances?: Money
  charges?: Money
  taxExclusive?: Money
  vat?: Money
  taxInclusive?: Money
  prepaid?: Money
  rounding?: Money
  payable?: Money
  byCode: Record<string, Money>
}

export interface DocumentAdjustment {
  internalIndex: number
  kind: 'allowance' | 'charge'
  amount: Money
  base?: Money
  tax?: TaxGroup
  rawNode: Element
}

export interface LineItem {
  internalIndex: number
  lineId: string
  serviceCode?: string
  description?: string
  quantity?: string
  unit?: string
  net?: Money
  vat?: Money
  gross?: Money
  taxRate?: string
  taxCategory?: string
  taxGroups: TaxGroup[]
  meterReferences: MeterReference[]
  AWE?: string | null
  AVE?: string | null
  rawNode?: Element
}

export interface ParsedInvoice {
  filename?: string
  doc: Document
  rootName: string
  namespace: string | null
  invoiceNumber?: string
  issueDate?: string
  periodStart?: string | null
  periodEnd?: string | null
  supplier?: InvoiceParty
  lines: LineItem[]
  totals: InvoiceTotals
  taxSummaries: TaxGroup[]
  adjustments: DocumentAdjustment[]
  totalNet?: number
  totalGross?: number
}
