import React, { useRef } from 'react'
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
      <div className="border-2 border-dashed rounded p-6 text-center mb-4" onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}>
        <div className="text-lg font-semibold">Povleci in spusti XML datoteke sem</div>
        <div className="text-sm text-gray-600">Ali izberi ročno</div>
        <div className="mt-3">
          <input ref={inputRef} type="file" multiple onChange={onSelect} />
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
