import React, { useState } from 'react'
import UploadArea from './components/UploadArea'
import ExportPanel from './components/ExportPanel'
import HelpModal from './components/HelpModal'
import { useProcessor } from './hooks/useProcessor'
import { HelpCircle } from 'lucide-react'

export default function App() {
  const { files, addFiles, anyProcessing, downloadAll } = useProcessor()
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div className="p-6 mx-auto" style={{ maxWidth: '90%' }}>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">eSLOG Utility Splitter</h1>
          <p className="text-sm text-gray-600">Obdelava poteka lokalno v brskalniku.</p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border rounded hover:bg-gray-50 transition-colors"
          title="Navodila za uporabo"
        >
          <HelpCircle size={16} />
          Navodila
        </button>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

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
