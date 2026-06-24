import React from 'react'
import { Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { FileEntry } from '../hooks/useProcessor'

const TOLERANCE = 0.02

function VerificationBadge({ file }: { file: FileEntry }) {
  const splits = file.outputs.filter(o => o.net != null && o.gross != null)
  if (splits.length === 0 || (file.totalNet == null && file.totalGross == null)) return null

  const sumNet = splits.reduce((s, o) => s + (o.net ?? 0), 0)
  const sumGross = splits.reduce((s, o) => s + (o.gross ?? 0), 0)
  const netOk = file.totalNet == null || Math.abs(sumNet - file.totalNet) <= TOLERANCE
  const grossOk = file.totalGross == null || Math.abs(sumGross - file.totalGross) <= TOLERANCE
  const ok = netOk && grossOk

  const netParts = splits.map(o => o.net?.toFixed(2)).join(' + ')
  const grossParts = splits.map(o => o.gross?.toFixed(2)).join(' + ')

  return (
    <span className="relative group flex-shrink-0">
      {ok
        ? <CheckCircle2 size={15} className="text-green-500 cursor-default" />
        : <AlertCircle size={15} className="text-red-400 cursor-default" />
      }
      <div className="absolute right-0 bottom-full mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 hidden group-hover:block z-50 shadow-xl pointer-events-none">
        <div className="font-semibold mb-2">{ok ? '✓ Vrednosti preverjene' : '✗ Vrednosti se ne ujemajo'}</div>
        {file.totalNet != null && (
          <div className="mb-1 font-mono">
            <span className="text-gray-400">Brez DDV: </span>
            {netParts} = <span className={netOk ? 'text-green-400' : 'text-red-400'}>{sumNet.toFixed(2)}</span>
            <span className="text-gray-400"> (orig: {file.totalNet.toFixed(2)})</span>
          </div>
        )}
        {file.totalGross != null && (
          <div className="font-mono">
            <span className="text-gray-400">Z DDV:    </span>
            {grossParts} = <span className={grossOk ? 'text-green-400' : 'text-red-400'}>{sumGross.toFixed(2)}</span>
            <span className="text-gray-400"> (orig: {file.totalGross.toFixed(2)})</span>
          </div>
        )}
      </div>
    </span>
  )
}

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
          {file.status === 'done' && <VerificationBadge file={file} />}
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
