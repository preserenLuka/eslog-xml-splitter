import React from 'react'
import { FileEntry } from '../hooks/useProcessor'

export default function FileCard({ file, hovered, onHover, onLeave }: { file: FileEntry; hovered?: boolean; onHover: (id: string)=>void; onLeave: ()=>void }) {
  const color = file.status === 'processing' || file.status === 'pending' ? 'bg-yellow-100' : file.status === 'done' ? 'bg-green-50' : file.status === 'failed' ? 'bg-red-50' : 'bg-gray-100'
  const [showInfo, setShowInfo] = React.useState(false)
  const highlightClass = hovered ? 'ring-2 ring-blue-400 bg-blue-50' : ''
  return (
    <div onMouseEnter={()=>onHover(file.id)} onMouseLeave={onLeave} className={`p-3 rounded shadow-sm ${color} ${highlightClass} mb-2`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{file.name}</div>
          <div className="text-sm text-gray-600">{file.message || file.status}</div>
        </div>
        <div className="text-sm flex items-center gap-2">
          <button title="Info" className="text-gray-600" onClick={()=>setShowInfo(s=>!s)}>ⓘ</button>
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
          <div className="mb-2"><strong>Voda:</strong> AWE: {file.detectedReference?.water?.AWE || '-'} AVE: {file.detectedReference?.water?.AVE || '-'} (<strong>{file.detectedReference?.water?.confidence != null ? `${Math.round((file.detectedReference.water.confidence||0)*100)}%` : '0%'}</strong>)</div>
          <div className="mb-2"><strong>Smeti:</strong> AWE: {file.detectedReference?.waste?.AWE || '-'} AVE: {file.detectedReference?.waste?.AVE || '-'} (<strong>{file.detectedReference?.waste?.confidence != null ? `${Math.round((file.detectedReference.waste.confidence||0)*100)}%` : '0%'}</strong>)</div>
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
