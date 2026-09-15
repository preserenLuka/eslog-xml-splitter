import { useId, useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Loader2, Trash2, XCircle } from 'lucide-react'
import { ResolvedCategory } from '../eslog/classifier'
import { FileEntry, FileStatus } from '../hooks/useProcessor'

const currency = new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' })

const statusLabels: Record<FileStatus, string> = {
  queued: 'V čakalni vrsti',
  processing: 'Obdelava',
  needs_review: 'Potreben pregled',
  ready: 'Pripravljeno',
  ready_with_warnings: 'Pripravljeno s potrjenimi opozorili',
  waste_only: 'Samo odpadki – brez datoteke za uvoz',
  duplicate: 'Dvojnik – izpuščeno',
  failed: 'Napaka',
}

const statusStyles: Record<FileStatus, string> = {
  queued: 'bg-slate-100 text-slate-700', processing: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-amber-100 text-amber-900', ready: 'bg-emerald-100 text-emerald-800',
  ready_with_warnings: 'bg-emerald-100 text-emerald-800', waste_only: 'bg-slate-100 text-slate-700',
  duplicate: 'bg-slate-100 text-slate-700', failed: 'bg-red-100 text-red-800',
}

function formatMoney(value?: string | number): string {
  if (value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  return currency.format(Number(value))
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  const date = compact ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('sl-SI').format(date)
}

function meterText(file: FileEntry): string {
  const meters = file.meterReferences.water
  if (!meters.length) return '—'
  return meters.map((item) => [item.AWE && `AWE ${item.AWE}`, item.AVE && `AVE ${item.AVE}`].filter(Boolean).join(' / ')).join(', ')
}

function categoryLabel(category: ResolvedCategory): string {
  return category === 'water' ? 'Voda' : category === 'waste' ? 'Odpadki' : category === 'excluded' ? 'Namerno izpuščeno' : 'Neznano'
}

interface Props {
  file: FileEntry
  onCategoryChange: (fileId: string, internalIndex: number, category: ResolvedCategory | 'auto') => void
  onAcknowledge: (fileId: string) => void
  onRemove: (fileId: string) => void
  onDownload: (fileId: string, category?: 'water' | 'waste') => void
}

export default function FileCard({ file, onCategoryChange, onAcknowledge, onRemove, onDownload }: Props) {
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const sourceGross = file.parsed?.totals.taxInclusive
  const classifiedGross = useMemo(() => new Decimal(file.summaries.water.gross)
    .plus(file.summaries.waste.gross).plus(file.summaries.unknown.gross).plus(file.summaries.excluded.gross), [file.summaries])
  const difference = sourceGross && Number.isFinite(Number(sourceGross))
    ? new Decimal(sourceGross).minus(classifiedGross).toFixed(2) : undefined
  const canDownloadWater = Boolean(file.waterOutput) && (file.status === 'ready' || file.status === 'ready_with_warnings')

  return (
    <article className={`rounded-xl border bg-white shadow-sm ${file.status === 'failed' ? 'border-red-200' : file.status === 'needs_review' ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-all text-lg font-semibold">{file.invoiceNumber || file.name}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[file.status]}`} aria-live="polite">
                {file.status === 'processing' && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                {(file.status === 'ready' || file.status === 'ready_with_warnings') && <CheckCircle2 size={13} aria-hidden="true" />}
                {file.status === 'needs_review' && <AlertTriangle size={13} aria-hidden="true" />}
                {file.status === 'failed' && <XCircle size={13} aria-hidden="true" />}
                {statusLabels[file.status]}
              </span>
            </div>
            <p className="mt-1 break-all text-sm text-slate-500">{file.name}</p>
            {(file.supplierName || file.issueDate || file.periodStart) && (
              <p className="mt-2 text-sm text-slate-700">
                {file.supplierName || 'Neznan izdajatelj'} · izdan {formatDate(file.issueDate)} · obdobje {formatDate(file.periodStart)}–{formatDate(file.periodEnd)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canDownloadWater && (
              <button type="button" className="primary-button" onClick={() => onDownload(file.id, 'water')} aria-label={`Prenesi vodni XML za račun ${file.invoiceNumber || file.name}`}>
                <Download size={17} aria-hidden="true" /> Prenesi vodo
              </button>
            )}
            <button type="button" className="icon-button" onClick={() => onRemove(file.id)} aria-label={`Odstrani račun ${file.invoiceNumber || file.name}`} title="Odstrani račun">
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {file.message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{file.message}</p>}

        {file.parsed && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div className="metric"><span>Voda</span><strong>{formatMoney(file.waterOutput?.gross ?? file.summaries.water.gross)}</strong></div>
            <div className="metric"><span>Izločeni odpadki</span><strong>{formatMoney(file.summaries.waste.gross)}</strong></div>
            <div className="metric"><span>Neznani del</span><strong>{formatMoney(file.summaries.unknown.gross)}</strong></div>
            <div className="metric sm:col-span-2 lg:col-span-2"><span>Vodno merilno mesto</span><strong className="break-all text-sm">{meterText(file)}</strong></div>
            <div className="metric"><span>Kontrolna razlika</span><strong className={difference && difference !== '0.00' ? 'text-amber-700' : 'text-emerald-700'}>{formatMoney(difference)}</strong></div>
          </div>
        )}
        {file.summaries.excluded.lineCount > 0 && <p className="mt-2 text-xs text-slate-600">Namerno izpuščeno: {formatMoney(file.summaries.excluded.gross)} ({file.summaries.excluded.lineCount} postavk)</p>}

        {file.errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3" role="alert">
            <div className="font-semibold text-red-900">Izvoz je blokiran</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-800">
              {file.errors.map((issue, index) => <li key={`${issue.code}-${index}`}><code>{issue.code}</code>: {issue.message}</li>)}
            </ul>
          </div>
        )}

        {file.warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <button type="button" className="flex w-full items-center justify-between gap-3 text-left font-semibold text-amber-950" onClick={() => setExpanded(true)} aria-expanded={expanded} aria-controls={detailsId}>
              <span>{file.warnings.length} {file.warnings.length === 1 ? 'opozorilo' : 'opozoril'}</span>
              <span className="text-sm font-normal">Odpri pregled</span>
            </button>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {file.warnings.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
            </ul>
            {file.status === 'needs_review' && !confirming && (
              <button type="button" className="mt-3 text-sm font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2" onClick={() => setConfirming(true)}>
                Nadaljuj kljub opozorilom
              </button>
            )}
            {file.status === 'needs_review' && confirming && (
              <div className="mt-3 rounded-md bg-white p-3 text-sm text-slate-800">
                <p>Vodni izvoz bo vseboval samo postavke, označene kot »Voda«. Neznane in namerno izpuščene postavke ne bodo vključene. Potrditev velja samo za ta račun in se ob spremembi razvrstitve razveljavi.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="primary-button" onClick={() => { onAcknowledge(file.id); setConfirming(false) }}>Potrdi in nadaljuj</button>
                  <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>Prekliči</button>
                </div>
              </div>
            )}
          </div>
        )}

        {file.lines.length > 0 && (
          <button type="button" className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={detailsId}>
            <ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            {expanded ? 'Skrij postavke' : `Preglej postavke (${file.lines.length})`}
          </button>
        )}
      </div>

      {expanded && file.lines.length > 0 && (
        <div id={detailsId} className="border-t border-slate-200 p-4 sm:p-5">
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
              <caption className="sr-only">Postavke računa {file.invoiceNumber || file.name}</caption>
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="table-cell">Opis</th><th scope="col" className="table-cell">Šifra</th>
                <th scope="col" className="table-cell">Količina / enota</th><th scope="col" className="table-cell text-right">Neto</th>
                <th scope="col" className="table-cell text-right">DDV</th><th scope="col" className="table-cell text-right">Bruto</th>
                <th scope="col" className="table-cell">Kategorija</th><th scope="col" className="table-cell">Merilno mesto</th><th scope="col" className="table-cell">Razlog</th>
              </tr></thead>
              <tbody>{file.lines.map((line) => (
                <tr key={line.internalIndex} className="border-b border-slate-100 align-top last:border-0">
                  <td className="table-cell max-w-xs">{line.description || '—'}</td><td className="table-cell font-mono text-xs">{line.serviceCode || '—'}</td>
                  <td className="table-cell">{line.quantity || '—'} {line.unit || ''}</td><td className="table-cell text-right">{formatMoney(line.net)}</td>
                  <td className="table-cell text-right">{formatMoney(line.vat)}</td><td className="table-cell text-right font-medium">{formatMoney(line.gross)}</td>
                  <td className="table-cell">
                    <label><span className="sr-only">Kategorija za postavko {line.description || line.lineId}</span>
                      <select className="field min-w-40 py-1.5" value={line.manual ? line.category : 'auto'} onChange={(event) => onCategoryChange(file.id, line.internalIndex, event.target.value as ResolvedCategory | 'auto')}>
                        <option value="auto">Samodejno ({categoryLabel(line.automaticCategory)})</option>
                        <option value="water">Voda</option><option value="waste">Odpadki</option><option value="excluded">Namerno izpusti</option>
                      </select>
                    </label>
                  </td>
                  <td className="table-cell text-xs">{line.meterReferences.length ? line.meterReferences.map((meter) => [meter.AWE && `AWE ${meter.AWE}`, meter.AVE && `AVE ${meter.AVE}`].filter(Boolean).join(' / ')).join(', ') : '—'}</td>
                  <td className="table-cell text-xs text-slate-600">{line.reason}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}
