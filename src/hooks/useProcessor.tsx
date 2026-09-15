import { useCallback, useRef, useState } from 'react'
import Decimal from 'decimal.js'
import packageJson from '../../package.json'
import { parseEslogXml } from '../eslog/parser'
import {
  builtInKomunalaNovoMesto, Category, classifyLine, ResolvedCategory,
  RULESET_VERSION, supportsSupplier,
} from '../eslog/classifier'
import { buildDerivedXml, DerivedXmlResult } from '../eslog/transformer'
import { decimalOrNull, validateParsed, ValidationIssue } from '../eslog/validator'
import { MeterReference, ParsedInvoice } from '../eslog/types'
import { buildZip, downloadBlob, downloadText } from '../export/zip'
import { buildJsonReport, buildProcessingReport } from '../export/reports'
import {
  buildDuplicateFilename, buildOutputFilename, buildZipPath,
  processingCsvPath, processingReportPath,
} from '../export/outputStructure'

export type FileStatus =
  | 'queued' | 'processing' | 'needs_review' | 'ready' | 'ready_with_warnings'
  | 'waste_only' | 'duplicate' | 'failed'

export interface OutputFile extends DerivedXmlResult {
  filename: string
  type: 'water' | 'waste'
}

export interface LineReview {
  internalIndex: number
  lineId: string
  serviceCode?: string
  description?: string
  quantity?: string
  unit?: string
  net?: string
  vat?: string
  gross?: string
  category: ResolvedCategory
  automaticCategory: Category
  reason: string
  manual: boolean
  meterReferences: MeterReference[]
}

export interface CategorySummary {
  lineCount: number
  net: string
  vat: string
  gross: string
}

export interface FileEntry {
  id: string
  name: string
  status: FileStatus
  hash?: string
  message?: string
  parsed?: ParsedInvoice
  invoiceNumber?: string
  issueDate?: string
  periodStart?: string | null
  periodEnd?: string | null
  supplierName?: string
  supplierKey?: string
  errors: ValidationIssue[]
  staticWarnings: ValidationIssue[]
  warnings: ValidationIssue[]
  warningsAcknowledged: boolean
  lines: LineReview[]
  summaries: Record<ResolvedCategory, CategorySummary>
  meterReferences: Record<Category, MeterReference[]>
  waterOutput?: OutputFile
  businessKey?: string
}

const emptySummary = (): CategorySummary => ({ lineCount: 0, net: '0.00', vat: '0.00', gross: '0.00' })
const emptySummaries = (): Record<ResolvedCategory, CategorySummary> => ({ water: emptySummary(), waste: emptySummary(), unknown: emptySummary(), excluded: emptySummary() })
const emptyMeters = (): Record<Category, MeterReference[]> => ({ water: [], waste: [], unknown: [] })
const money = (value: Decimal.Value) => new Decimal(value || 0).toFixed(2)
const canExport = (entry: FileEntry) => ['ready', 'ready_with_warnings', 'waste_only'].includes(entry.status)

function uniqueIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue, index) => issues.findIndex((candidate) =>
    candidate.code === issue.code && candidate.lineIndex === issue.lineIndex && candidate.message === issue.message,
  ) === index)
}

function uniqueMeters(meters: MeterReference[]): MeterReference[] {
  return meters.filter((meter, index) => meters.findIndex((candidate) =>
    candidate.AWE === meter.AWE && candidate.AVE === meter.AVE,
  ) === index)
}

function assignmentMap(lines: LineReview[]): Map<number, ResolvedCategory> {
  return new Map(lines.map((line) => [line.internalIndex, line.category]))
}

function buildWasteOutput(entry: FileEntry): OutputFile {
  if (!entry.parsed || entry.summaries.waste.lineCount === 0) throw new Error('Račun nima postavk odpadkov.')
  const output = buildDerivedXml(entry.parsed, 'waste', assignmentMap(entry.lines))
  const filename = buildOutputFilename(entry.name, 'waste')
  const validation = validateParsed(parseEslogXml(output.xml, filename))
  if (!validation.ok) {
    throw new Error(`Odpadkovni XML ni veljaven: ${validation.errors.map((issue) => `${issue.code}: ${issue.message}`).join(' | ')}`)
  }
  return { ...output, filename, type: 'waste' }
}

function summarize(lines: LineReview[]): { summaries: Record<ResolvedCategory, CategorySummary>; meters: Record<Category, MeterReference[]> } {
  const summaries = emptySummaries()
  const meters = emptyMeters()
  for (const line of lines) {
    const category = line.category
    const summary = summaries[category]
    summary.lineCount++
    summary.net = money(new Decimal(summary.net).plus(line.net || 0))
    summary.vat = money(new Decimal(summary.vat).plus(line.vat || 0))
    summary.gross = money(new Decimal(summary.gross).plus(line.gross || 0))
    meters[category === 'excluded' ? 'unknown' : category].push(...line.meterReferences)
  }
  for (const category of ['water', 'waste', 'unknown'] as Category[]) meters[category] = uniqueMeters(meters[category])
  return { summaries, meters }
}

function warning(code: string, message: string): ValidationIssue {
  return { code, severity: 'warning', message }
}

function rebuildEntry(entry: FileEntry): FileEntry {
  if (!entry.parsed || entry.errors.length) return entry
  const { summaries, meters } = summarize(entry.lines)
  const dynamic: ValidationIssue[] = []
  const unknownCount = entry.lines.filter((line) => line.category === 'unknown').length
  const excludedCount = entry.lines.filter((line) => line.category === 'excluded').length
  if (unknownCount) dynamic.push(warning('UNKNOWN_LINES', `${unknownCount} postavk ni razvrščenih in bodo brez ročne izbire izpuščene.`))
  if (excludedCount) dynamic.push(warning('EXCLUDED_LINES', `${excludedCount} postavk je označenih za namerni izpust.`))
  if (meters.water.length > 1) dynamic.push(warning('MULTIPLE_WATER_METERS', `Vodne postavke uporabljajo ${meters.water.length} različnih merilnih mest.`))
  const warnings = uniqueIssues([...entry.staticWarnings, ...dynamic])
  const assignments = assignmentMap(entry.lines)
  let waterOutput: OutputFile | undefined
  let errors = entry.errors
  if (summaries.water.lineCount > 0) {
    try {
      const output = buildDerivedXml(entry.parsed, 'water', assignments)
      const result = validateParsed(parseEslogXml(output.xml, buildOutputFilename(entry.name, 'water')))
      if (!result.ok) errors = uniqueIssues([...errors, ...result.errors.map((issue) => ({ ...issue, message: `Izhodni XML: ${issue.message}` }))])
      else waterOutput = { ...output, filename: buildOutputFilename(entry.name, 'water'), type: 'water' }
    } catch (cause) {
      errors = uniqueIssues([...errors, {
        code: 'OUTPUT_BUILD_FAILED', severity: 'error',
        message: `Izhodnega XML ni bilo mogoče izdelati: ${cause instanceof Error ? cause.message : String(cause)}`,
      }])
    }
  }

  let status: FileStatus
  if (errors.length) status = 'failed'
  else if (warnings.length && !entry.warningsAcknowledged) status = 'needs_review'
  else if (summaries.water.lineCount === 0 && summaries.waste.lineCount > 0 && summaries.unknown.lineCount === 0 && summaries.excluded.lineCount === 0) status = 'waste_only'
  else if (warnings.length) status = 'ready_with_warnings'
  else if (summaries.water.lineCount === 0) status = 'waste_only'
  else status = 'ready'
  return { ...entry, status, errors, warnings, summaries, meterReferences: meters, waterOutput }
}

function reconcileBusinessWarnings(entries: FileEntry[]): FileEntry[] {
  const counts = new Map<string, number>()
  for (const entry of entries) if (entry.businessKey) counts.set(entry.businessKey, (counts.get(entry.businessKey) || 0) + 1)
  return entries.map((entry) => {
    const hadWarning = entry.staticWarnings.some((issue) => issue.code === 'BUSINESS_DUPLICATE')
    const needsWarning = Boolean(entry.businessKey && (counts.get(entry.businessKey) || 0) > 1)
    if (hadWarning === needsWarning) return entry
    const staticWarnings = entry.staticWarnings.filter((issue) => issue.code !== 'BUSINESS_DUPLICATE')
    if (needsWarning) staticWarnings.push(warning('BUSINESS_DUPLICATE', 'V paketu je še en račun istega izdajatelja z enako številko in drugačno vsebino.'))
    return rebuildEntry({ ...entry, staticWarnings, warningsAcknowledged: false })
  })
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function supplierKey(parsed: ParsedInvoice): string {
  return parsed.supplier?.identifiers.VA || parsed.supplier?.identifiers['0199'] || parsed.supplier?.name || 'neznan-izdajatelj'
}

function reportInput(entry: FileEntry, requestedCategory: 'water' | 'waste', outputName?: string): Record<string, unknown> {
  const parsed = entry.parsed
  const sourceGross = parsed?.totals.taxInclusive || ''
  const classifiedGross = new Decimal(entry.summaries.water.gross).plus(entry.summaries.waste.gross)
    .plus(entry.summaries.unknown.gross).plus(entry.summaries.excluded.gross)
  const validSourceGross = decimalOrNull(sourceGross)
  const difference = validSourceGross ? validSourceGross.minus(classifiedGross).toFixed(2) : ''
  return {
    sourceName: entry.name,
    sha256: entry.hash || '',
    supplier: entry.supplierName || '',
    supplierId: entry.supplierKey || '',
    supplierIdentifiers: parsed?.supplier?.identifiers || {},
    invoiceNumber: entry.invoiceNumber || '',
    issueDate: entry.issueDate || '',
    periodStart: entry.periodStart || '',
    periodEnd: entry.periodEnd || '',
    status: entry.status,
    message: entry.message || '',
    errors: entry.errors,
    warnings: entry.warnings,
    warningsAcknowledged: entry.warningsAcknowledged,
    waterLines: entry.summaries.water.lineCount,
    wasteLines: entry.summaries.waste.lineCount,
    unknownLines: entry.summaries.unknown.lineCount,
    excludedLines: entry.summaries.excluded.lineCount,
    waterNet: entry.waterOutput?.net ?? entry.summaries.water.net,
    waterVat: entry.waterOutput?.vat ?? entry.summaries.water.vat,
    waterGross: entry.waterOutput?.gross ?? entry.summaries.water.gross,
    wasteNet: entry.summaries.waste.net,
    wasteVat: entry.summaries.waste.vat,
    wasteGross: entry.summaries.waste.gross,
    unknownGross: entry.summaries.unknown.gross,
    excludedGross: entry.summaries.excluded.gross,
    waterMeters: entry.meterReferences.water,
    wasteMeters: entry.meterReferences.waste,
    unknownMeters: entry.meterReferences.unknown,
    reconciliationDifference: difference,
    requestedCategory,
    outputName: outputName || '',
  }
}

function flatReportRow(input: Record<string, unknown>): Record<string, unknown> {
  const issueText = (issues: unknown) => (issues as ValidationIssue[])
    .map((issue) => `${issue.code}: ${issue.message}`).join(' | ')
  return {
    datoteka: input.sourceName, sha256: input.sha256, izdajatelj: input.supplier,
    id_izdajatelja: input.supplierId, vsi_id_izdajatelja: JSON.stringify(input.supplierIdentifiers),
    stevilka_racuna: input.invoiceNumber,
    datum_izdaje: input.issueDate, obdobje_od: input.periodStart, obdobje_do: input.periodEnd,
    stanje: input.status, sporocilo: input.message, napake: issueText(input.errors),
    opozorila: issueText(input.warnings), potrjena_opozorila: input.warningsAcknowledged,
    postavke_voda: input.waterLines, postavke_odpadki: input.wasteLines, postavke_neznano: input.unknownLines,
    postavke_namerno_izpuscene: input.excludedLines,
    voda_brez_ddv: input.waterNet, voda_ddv: input.waterVat, voda_z_ddv: input.waterGross,
    odpadki_z_ddv: input.wasteGross, neznano_z_ddv: input.unknownGross, namerno_izpusceno_z_ddv: input.excludedGross,
    merilna_mesta_voda: JSON.stringify(input.waterMeters), merilna_mesta_odpadki: JSON.stringify(input.wasteMeters),
    merilna_mesta_neznano: JSON.stringify(input.unknownMeters),
    kontrolna_razlika: input.reconciliationDifference,
    izhod: input.outputName,
  }
}

export function createPackageStructure(files: FileEntry[], category: 'water' | 'waste', generatedAt = new Date().toISOString()) {
  const structure: Record<string, string | Uint8Array> = {}
  const outputNames = new Map<string, string>()
  for (const entry of files) {
    if (!entry.parsed || !canExport(entry)) continue
    let output: OutputFile | undefined
    if (category === 'water') output = entry.waterOutput
    else if (entry.summaries.waste.lineCount) output = buildWasteOutput(entry)
    if (!output) continue
    let filename = output.filename
    let suffix = 1
    while (structure[buildZipPath(category, filename)]) filename = buildDuplicateFilename(output.filename, ++suffix)
    structure[buildZipPath(category, filename)] = output.xml
    outputNames.set(entry.id, filename)
  }
  const inputs = files.map((entry) => reportInput(entry, category, outputNames.get(entry.id)))
  structure[processingReportPath] = buildJsonReport({
    generatedAt, appVersion: packageJson.version, rulesVersion: RULESET_VERSION,
    requestedCategory: category, outputFileCount: outputNames.size,
  }, inputs)
  structure[processingCsvPath] = buildProcessingReport(inputs.map(flatReportRow))
  return { structure, outputCount: outputNames.size }
}

export function useProcessor() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const processingRef = useRef(false)
  const queueRef = useRef<Array<{ file: File; entry: FileEntry }>>([])
  const hashesRef = useRef(new Map<string, string>())
  const businessKeysRef = useRef(new Map<string, string>())
  const removedRef = useRef(new Set<string>())

  const processOne = useCallback(async (file: File, initial: FileEntry) => {
    if (removedRef.current.has(initial.id)) return
    setFiles((current) => current.map((item) => item.id === initial.id ? { ...item, status: 'processing' } : item))
    try {
      const buffer = await file.arrayBuffer()
      const hash = await sha256(buffer)
      if (hashesRef.current.has(hash)) {
        setFiles((current) => current.map((item) => item.id === initial.id ? {
          ...item, hash, status: 'duplicate', message: 'Ta vsebina je že dodana v paket.',
        } : item))
        return
      }
      if (removedRef.current.has(initial.id)) return
      hashesRef.current.set(hash, initial.id)
      if (!file.name.toLowerCase().endsWith('.xml')) {
        setFiles((current) => current.map((item) => item.id === initial.id ? {
          ...item, hash, status: 'failed', message: 'Datoteka ni XML.',
          errors: [{ code: 'FILE_TYPE', severity: 'error', message: 'Datoteka nima končnice .xml.' }],
        } : item))
        return
      }
      const parsed = parseEslogXml(new TextDecoder().decode(buffer), file.name)
      const validation = validateParsed(parsed)
      const supported = supportsSupplier(parsed.supplier, builtInKomunalaNovoMesto)
      const lines: LineReview[] = parsed.lines.map((line) => {
        const classification = supported
          ? classifyLine(line, builtInKomunalaNovoMesto)
          : { category: 'unknown' as const, reason: 'Izdajatelj ni podprt', reasonCode: 'no_match' as const }
        return {
          internalIndex: line.internalIndex, lineId: line.lineId, serviceCode: line.serviceCode,
          description: line.description, quantity: line.quantity, unit: line.unit,
          net: line.net, vat: line.vat, gross: line.gross,
          category: classification.category, automaticCategory: classification.category,
          reason: classification.reason, manual: false, meterReferences: line.meterReferences,
        }
      })
      const partyKey = supplierKey(parsed)
      const businessKey = parsed.invoiceNumber ? `${partyKey}|${parsed.invoiceNumber}` : undefined
      const staticWarnings = [...validation.warnings]
      if (businessKey && businessKeysRef.current.has(businessKey)) {
        staticWarnings.push(warning('BUSINESS_DUPLICATE', 'V paketu je že račun istega izdajatelja z enako številko in drugačno vsebino.'))
        const existingId = businessKeysRef.current.get(businessKey)
        setFiles((current) => current.map((item) => item.id !== existingId ? item : rebuildEntry({
          ...item,
          staticWarnings: uniqueIssues([...item.staticWarnings, warning('BUSINESS_DUPLICATE', 'V paketu je še en račun istega izdajatelja z enako številko in drugačno vsebino.')]),
          warningsAcknowledged: false,
        })))
      } else if (businessKey) businessKeysRef.current.set(businessKey, initial.id)

      let entry: FileEntry = {
        ...initial, hash, parsed, invoiceNumber: parsed.invoiceNumber, issueDate: parsed.issueDate,
        periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, supplierName: parsed.supplier?.name,
        supplierKey: partyKey, businessKey, errors: validation.errors, staticWarnings,
        warnings: staticWarnings, lines, warningsAcknowledged: false,
        summaries: emptySummaries(), meterReferences: emptyMeters(),
        status: validation.ok ? 'needs_review' : 'failed',
      }
      entry = rebuildEntry(entry)
      if (!removedRef.current.has(initial.id)) setFiles((current) => current.map((item) => item.id === initial.id ? entry : item))
    } catch (cause) {
      const malformedXml = cause instanceof Error && cause.message === 'XML_PARSE_ERROR'
      const message = malformedXml
        ? 'XML ni veljaven.' : cause instanceof Error ? cause.message : String(cause)
      setFiles((current) => current.map((item) => item.id === initial.id ? {
        ...item, status: 'failed', message,
        errors: [{ code: malformedXml ? 'XML_PARSE_ERROR' : 'PROCESSING_FAILED', severity: 'error', message }],
      } : item))
    }
  }, [])

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    while (queueRef.current.length) {
      const next = queueRef.current.shift()!
      await processOne(next.file, next.entry)
    }
    processingRef.current = false
  }, [processOne])

  const addFiles = useCallback((list: File[]) => {
    const entries: FileEntry[] = list.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`, name: file.name, status: 'queued',
      errors: [], staticWarnings: [], warnings: [], warningsAcknowledged: false,
      lines: [], summaries: emptySummaries(), meterReferences: emptyMeters(),
    }))
    setFiles((current) => [...entries, ...current])
    list.forEach((file, index) => queueRef.current.push({ file, entry: entries[index] }))
    void drainQueue()
  }, [drainQueue])

  const updateLineCategory = useCallback((fileId: string, internalIndex: number, category: ResolvedCategory | 'auto') => {
    setFiles((current) => current.map((entry) => {
      if (entry.id !== fileId) return entry
      const lines = entry.lines.map((line) => line.internalIndex !== internalIndex ? line : category === 'auto'
        ? { ...line, category: line.automaticCategory, reason: 'Samodejna razvrstitev', manual: false }
        : { ...line, category, reason: category === 'excluded' ? 'Namerni izpust' : 'Ročna izbira za ta račun', manual: true })
      return rebuildEntry({ ...entry, lines, warningsAcknowledged: false })
    }))
  }, [])

  const acknowledgeWarnings = useCallback((fileId: string) => {
    setFiles((current) => current.map((entry) => entry.id === fileId
      ? rebuildEntry({ ...entry, warningsAcknowledged: true }) : entry))
  }, [])

  const removeFile = useCallback((fileId: string) => {
    removedRef.current.add(fileId)
    queueRef.current = queueRef.current.filter(({ entry }) => entry.id !== fileId)
    setFiles((current) => {
      const removed = current.find((entry) => entry.id === fileId)
      if (removed?.hash && hashesRef.current.get(removed.hash) === fileId) hashesRef.current.delete(removed.hash)
      const remaining = reconcileBusinessWarnings(current.filter((entry) => entry.id !== fileId))
      businessKeysRef.current.clear()
      for (const entry of remaining) if (entry.businessKey && !businessKeysRef.current.has(entry.businessKey)) businessKeysRef.current.set(entry.businessKey, entry.id)
      return remaining
    })
  }, [])

  const clearCompleted = useCallback(() => {
    setFiles((current) => {
      const kept = current.filter((entry) => ['queued', 'processing', 'needs_review'].includes(entry.status))
      const keptIds = new Set(kept.map((entry) => entry.id))
      for (const [hash, id] of hashesRef.current) if (!keptIds.has(id)) hashesRef.current.delete(hash)
      for (const [key, id] of businessKeysRef.current) if (!keptIds.has(id)) businessKeysRef.current.delete(key)
      businessKeysRef.current.clear()
      for (const entry of kept) if (entry.businessKey && !businessKeysRef.current.has(entry.businessKey)) businessKeysRef.current.set(entry.businessKey, entry.id)
      return reconcileBusinessWarnings(kept)
    })
  }, [])

  const newBatch = useCallback(() => {
    if (processingRef.current || queueRef.current.length || exporting) return
    setFiles([])
    hashesRef.current.clear()
    businessKeysRef.current.clear()
    removedRef.current.clear()
    setExportError(null)
  }, [exporting])

  const downloadOne = useCallback((fileId: string, category: 'water' | 'waste' = 'water') => {
    const entry = files.find((item) => item.id === fileId)
    if (!entry || !entry.parsed || !canExport(entry)) return
    setExportError(null)
    try {
      const output = category === 'water'
        ? entry.waterOutput
        : entry.summaries.waste.lineCount ? buildWasteOutput(entry) : undefined
      if (output) downloadText(output.xml, output.filename)
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [files])

  const downloadPackage = useCallback(async (category: 'water' | 'waste' = 'water') => {
    if (processingRef.current || queueRef.current.length || exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const { structure } = createPackageStructure(files, category)
      const blob = await buildZip(structure)
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_')
      downloadBlob(blob, `eslog-${category === 'water' ? 'voda' : 'odpadki'}_${timestamp}.zip`)
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setExporting(false)
    }
  }, [exporting, files])

  const anyProcessing = files.some((entry) => entry.status === 'queued' || entry.status === 'processing')
  const waterReadyCount = files.filter((entry) => canExport(entry) && Boolean(entry.waterOutput)).length
  const wasteReadyCount = files.filter((entry) => canExport(entry) && entry.summaries.waste.lineCount > 0).length
  return {
    files, addFiles, anyProcessing, exporting, exportError, waterReadyCount, wasteReadyCount,
    updateLineCategory, acknowledgeWarnings, removeFile, clearCompleted, newBatch,
    downloadOne, downloadPackage,
  }
}
