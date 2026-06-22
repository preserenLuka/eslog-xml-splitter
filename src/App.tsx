import React, { useState } from 'react'
import UploadArea from './components/UploadArea'
import ExportPanel from './components/ExportPanel'
import { useProcessor } from './hooks/useProcessor'

export default function App() {
  const { files, addFiles, anyProcessing, downloadAll } = useProcessor()
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null)
  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">eSLOG Utility Splitter</h1>
        <p className="text-sm text-gray-600">Obdelava poteka lokalno v brskalniku.</p>
      </header>

      <main className="flex gap-4">
        <UploadArea
          files={files}
          addFiles={addFiles}
          anyProcessing={anyProcessing}
          hoveredFileId={hoveredFileId}
          onHover={setHoveredFileId}
          onLeave={() => setHoveredFileId(null)}
        />
        <ExportPanel
          files={files}
          onDownloadAll={() => downloadAll(null)}
          highlightSourceId={hoveredFileId}
          onHoverSource={setHoveredFileId}
          onLeave={() => setHoveredFileId(null)}
        />
      </main>
    </div>
  )
}
