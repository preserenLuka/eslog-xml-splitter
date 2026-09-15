import { useRef, useState } from 'react'
import { FolderOpen, UploadCloud } from 'lucide-react'

interface Props {
  addFiles: (files: File[]) => void
  anyProcessing: boolean
  fileCount: number
}

export default function UploadArea({ addFiles, anyProcessing, fileCount }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const submit = (files: File[]) => {
    if (anyProcessing) return
    if (files.length) addFiles(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section
      className={`rounded-xl border-2 border-dashed bg-white px-5 py-8 text-center transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); submit(Array.from(event.dataTransfer.files)) }}
      aria-label="Dodajanje računov XML"
    >
      <UploadCloud size={42} className="mx-auto text-blue-600" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">Dodaj račune XML</h2>
      <p className="mt-1 text-sm text-slate-600">
        {fileCount ? `Število računov v paketu: ${fileCount}. Dodate lahko še druge.` : 'Povlecite račune sem ali jih izberite v računalniku.'}
      </p>
      <button type="button" className="primary-button mx-auto mt-4" onClick={() => inputRef.current?.click()} disabled={anyProcessing}>
        <FolderOpen size={18} aria-hidden="true" /> Izberi datoteke XML
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        multiple
        className="sr-only"
        aria-label="Izberi račune XML"
        onChange={(event) => submit(event.target.files ? Array.from(event.target.files) : [])}
      />
    </section>
  )
}
