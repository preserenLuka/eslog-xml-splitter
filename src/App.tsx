import { useMemo, useState } from 'react'
import { Download, HelpCircle, RotateCcw, Search, Trash2 } from 'lucide-react'
import UploadArea from './components/UploadArea'
import FileCard from './components/FileCard'
import HelpModal from './components/HelpModal'
import { FileStatus, useProcessor } from './hooks/useProcessor'

type Filter = 'all' | 'ready' | 'review' | 'waste_only' | 'failed'

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Vsi' },
  { value: 'ready', label: 'Pripravljeni' },
  { value: 'review', label: 'Potreben pregled' },
  { value: 'waste_only', label: 'Brez vode' },
  { value: 'failed', label: 'Napake' },
]

function matchesFilter(status: FileStatus, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'ready') return status === 'ready' || status === 'ready_with_warnings'
  if (filter === 'review') return status === 'needs_review'
  if (filter === 'waste_only') return status === 'waste_only'
  return status === 'failed' || status === 'duplicate'
}

export default function App() {
  const processor = useProcessor()
  const [showHelp, setShowHelp] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const normalizedSearch = search.trim().toLocaleLowerCase('sl')
  const visibleFiles = useMemo(() => processor.files.filter((file) => {
    if (!matchesFilter(file.status, filter)) return false
    if (!normalizedSearch) return true
    return [file.name, file.invoiceNumber, file.supplierName]
      .filter(Boolean).some((value) => value!.toLocaleLowerCase('sl').includes(normalizedSearch))
  }), [filter, normalizedSearch, processor.files])

  const reviewCount = processor.files.filter((file) => file.status === 'needs_review').length
  const errorCount = processor.files.filter((file) => file.status === 'failed' || file.status === 'duplicate').length

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Razdelilnik računov za vodo</h1>
            <p className="mt-1 text-sm text-slate-600">Računi se obdelajo lokalno v brskalniku in se ne pošiljajo na strežnik.</p>
          </div>
          <button type="button" onClick={() => setShowHelp(true)} className="secondary-button shrink-0" aria-haspopup="dialog">
            <HelpCircle size={17} aria-hidden="true" /> Navodila
          </button>
        </div>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <UploadArea addFiles={processor.addFiles} anyProcessing={processor.anyProcessing || processor.exporting} fileCount={processor.files.length} />

        {processor.files.length > 0 && (
          <>
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Dejanja paketa">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-lg font-semibold">Paket računov ({processor.files.length})</div>
                  <p className="text-sm text-slate-600" aria-live="polite">
                    {processor.anyProcessing ? 'Obdelava še poteka …' : `Pripravljeni za vodo: ${processor.waterReadyCount} · Za pregled: ${reviewCount} · Napake ali dvojniki: ${errorCount}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={processor.anyProcessing || processor.exporting || processor.waterReadyCount === 0}
                    onClick={() => void processor.downloadPackage('water')}
                    aria-label={`Prenesi vodo za uvoz, ${processor.waterReadyCount} datotek`}
                  >
                    <Download size={18} aria-hidden="true" />
                    {processor.exporting ? 'Ustvarjam ZIP …' : `Prenesi vodo za uvoz (${processor.waterReadyCount})`}
                  </button>
                  <button type="button" className="secondary-button" disabled={processor.anyProcessing || processor.exporting} onClick={processor.clearCompleted}>
                    <Trash2 size={17} aria-hidden="true" /> Počisti končane
                  </button>
                  <button type="button" className="secondary-button" disabled={processor.anyProcessing || processor.exporting} onClick={processor.newBatch}>
                    <RotateCcw size={17} aria-hidden="true" /> Nov paket
                  </button>
                </div>
              </div>

              <details className="mt-4 border-t border-slate-200 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">Dodatne možnosti</summary>
                <button
                  type="button"
                  className="secondary-button mt-3"
                  disabled={processor.anyProcessing || processor.exporting || processor.wasteReadyCount === 0}
                  onClick={() => void processor.downloadPackage('waste')}
                  aria-label={`Prenesi odpadke, ${processor.wasteReadyCount} datotek`}
                >
                  <Download size={16} aria-hidden="true" /> Prenesi odpadke ({processor.wasteReadyCount})
                </button>
              </details>

              {processor.exportError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">Izvoza ni bilo mogoče izdelati: {processor.exportError}</div>}
            </section>

            <section className="mt-5" aria-labelledby="invoice-list-heading">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 id="invoice-list-heading" className="text-lg font-semibold">Računi</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative block">
                    <span className="sr-only">Išči po računu, datoteki ali izdajatelju</span>
                    <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} aria-hidden="true" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-9" placeholder="Išči račune …" type="search" />
                  </label>
                  <label>
                    <span className="sr-only">Filtriraj račune</span>
                    <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="field">
                      {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {visibleFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onCategoryChange={processor.updateLineCategory}
                    onAcknowledge={processor.acknowledgeWarnings}
                    onRemove={processor.removeFile}
                    onDownload={processor.downloadOne}
                  />
                ))}
                {visibleFiles.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Noben račun ne ustreza iskanju ali filtru.</div>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
