import React from 'react'
import { Info } from 'lucide-react'
import { FileEntry } from '../hooks/useProcessor'

export default function FileCard({ file, hovered, onHover, onLeave }: { file: FileEntry; hovered?: boolean; onHover: (id: string)=>void; onLeave: ()=>void }) {
  const color = file.status === 'processing' || file.status === 'pending' ? 'bg-yellow-100' : file.status === 'done' ? 'bg-green-50' : file.status === 'failed' ? 'bg-red-50' : 'bg-gray-100'
  const [showInfo, setShowInfo] = React.useState(false)
  const highlightClass = hovered ? 'ring-2 ring-blue-400 bg-blue-50' : ''

  const waterRef = file.detectedReference?.water?.AWE || file.detectedReference?.water?.AVE || '-'
  const wasteRef = file.detectedReference?.waste?.AWE || file.detectedReference?.waste?.AVE || '-'

  return (
    <div onMouseEnter={()=>onHover(file.id)} onMouseLeave={onLeave} className={`p-3 rounded shadow-sm ${color} ${highlightClass} mb-2`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{file.name}</div>
          <div className="text-sm text-gray-600">{file.message || file.status}</div>
          {file.status === 'done' && (file.totalNet != null || file.totalGross != null) && (
            <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
              {file.totalNet != null && <span>Brez DDV: <span className="font-medium text-gray-700">{file.totalNet.toFixed(2)} €</span></span>}
              {file.totalGross != null && <span>Z DDV: <span className="font-medium text-gray-700">{file.totalGross.toFixed(2)} €</span></span>}
            </div>
          )}
        </div>
        <div className="text-sm flex items-center gap-2">
          <button title="Info" className="text-gray-400 hover:text-gray-600 transition-colors" onClick={()=>setShowInfo(s=>!s)}>
            <Info size={16} />
          </button>
          <div>
            {file.status === 'processing' && <span>Obdelujem…</span>}
            {file.status === 'done' && <span>Končano</span>}
            {file.status === 'failed' && <span>Napaka</span>}
            {file.status === 'refused' && <span>Zavrnjeno</span>}
          </div>
        </div>
      </div>
      {showInfo && (
        <div className="mt-2 text-sm bg-white p-2 rounded border">
          <div className="font-semibold mb-1">Merilna mesta:</div>
          <div className="ml-3">
            <div>Voda: {waterRef}</div>
            <div>Smeti: {wasteRef}</div>
          </div>
          <div className="mt-2"><strong>Vrstice:</strong>
            <ul className="pl-4 list-disc">
              {file.lines?.map(l=> <li key={l.lineId}>{l.lineId} — {l.serviceCode || '-'} — {l.category}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
