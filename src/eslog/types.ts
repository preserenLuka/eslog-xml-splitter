export type Money = string // decimal string

export interface LineItem {
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
  AWE?: string | null
  AVE?: string | null
  rawNode?: Element
}

export interface ParsedInvoice {
  filename?: string
  doc: Document
  invoiceNumber?: string
  issueDate?: string
  periodStart?: string | null
  periodEnd?: string | null
  lines: LineItem[]
  totalNet?: number
  totalGross?: number
}
