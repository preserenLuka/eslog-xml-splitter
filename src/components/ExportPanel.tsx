import React from 'react'
import { FileEntry } from '../hooks/useProcessor'

export default function ExportPanel({ files, onDownloadAll, highlightSourceId, onHoverSource, onLeave }: { files: FileEntry[], onDownloadAll: ()=>void, highlightSourceId?: string | null, onHoverSource: (id: string)=>void, onLeave: ()=>void }) {
  const doneFiles = files.filter(f => f.status === 'done')
  const outputs = doneFiles.flatMap(f => f.outputs.map(o => ({...o, sourceId: f.id})))
  const [pulse, setPulse] = React.useState(false)
  const prevCount = React.useRef(0)
  React.useEffect(()=>{
    if (outputs.length > prevCount.current) {
      setPulse(true)
      setTimeout(()=>setPulse(false), 800)
    }
    prevCount.current = outputs.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputs.length])

  return (
    <div className="w-1/2 pl-4">
      <div className="mb-2 font-semibold">Izvozi</div>
      <div className="mb-4">
        <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={onDownloadAll} disabled={doneFiles.length===0}>Prenesi vse končne kot ZIP</button>
      </div>
      <div className={`p-3 rounded ${pulse? 'animate-pulse':''} border`}> 
        <div className="font-medium">Izhodi ({outputs.length})</div>
        <ul className="mt-2">
          {outputs.map(o => {
            const highlight = highlightSourceId && o.sourceId === highlightSourceId
            return (
              <li
                key={o.filename + o.sourceId}
                onMouseEnter={() => onHoverSource(o.sourceId)}
                onMouseLeave={onLeave}
                className={`mb-2 p-2 rounded ${highlight ? 'bg-blue-50 border border-blue-200' : ''}`}
              >
                <div className="font-medium">{o.filename}</div>
                <div className="mt-1"><a className="text-blue-600" href="#" onClick={(e)=>{e.preventDefault(); const blob=new Blob([o.content as string],{type:'application/xml'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=o.filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}}>Prenesi</a></div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
