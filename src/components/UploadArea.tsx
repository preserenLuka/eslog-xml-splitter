import React, { useRef } from 'react'
import { UploadCloud, FolderOpen } from 'lucide-react'
import FileCard from './FileCard'
import { FileEntry } from '../hooks/useProcessor'

export default function UploadArea({ files, addFiles, anyProcessing, hoveredFileId, onHover, onLeave }: { files: FileEntry[]; addFiles: (f: File[])=>void; anyProcessing: boolean; hoveredFileId?: string | null; onHover: (id: string)=>void; onLeave: ()=>void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const list = Array.from(e.dataTransfer.files)
    if (list.length) addFiles(list)
  }

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    if (list.length) addFiles(list)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-1/2 pr-4">
      <div
        className="border-2 border-dashed rounded p-6 text-center mb-4"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-2 mb-4">
          <UploadCloud size={48} className="text-gray-400" />
          <div className="text-sm text-gray-500">Povleci in spusti XML datoteke sem</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <FolderOpen size={16} />
            Izberi datoteke
          </button>
          <div className="text-xs text-gray-400">Ni izbrane datoteke</div>
          <input ref={inputRef} type="file" multiple onChange={onSelect} className="hidden" />
        </div>
      </div>

      <div className="mb-4 text-sm font-semibold text-gray-700">{anyProcessing ? 'Obdelava še poteka…' : 'Vse obdelave končane'}</div>

      <div>
        <div className="mb-2 font-semibold">Datoteke</div>
        <div>
          {files.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              hovered={hoveredFileId === f.id}
              onHover={onHover}
              onLeave={onLeave}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
