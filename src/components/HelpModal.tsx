import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function HelpModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="help-title" aria-describedby="help-intro" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 id="help-title" className="text-xl font-bold">Navodila za uporabo</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="icon-button" aria-label="Zapri navodila"><X size={21} aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <p id="help-intro" className="text-slate-600">Račun pripravite za uvoz v petih korakih.</p>
          <ol className="mt-5 space-y-6">
            <li><h3 className="step-title">1. Naložite račune XML</h3><p className="step-text">Povlecite enega ali več računov v polje za nalaganje ali kliknite »Izberi datoteke XML«. Orodje preveri vsebino in vsak račun prikaže v seznamu.</p></li>
            <li><h3 className="step-title">2. Preglejte vodne postavke</h3><p className="step-text">Odprite postavke računa ter preverite znesek vode, izločene odpadke in vodno merilno mesto. Neznano postavko označite kot »Voda«, »Odpadki« ali »Namerno izpusti«. Izbira velja samo do osvežitve strani.</p></li>
            <li><h3 className="step-title">3. Potrdite opozorila</h3><p className="step-text">Račun z opozorili ostane v stanju »Potreben pregled«. Preberite posledice in potrdite nadaljevanje. Tehnične napake izvoza ni mogoče potrditi.</p></li>
            <li><h3 className="step-title">4. Prenesite vodo</h3><p className="step-text">Kliknite »Prenesi vodo za uvoz«. ZIP vsebuje samo pripravljene vodne XML ter kontrolno poročilo v oblikah JSON in CSV.</p></li>
            <li><h3 className="step-title">5. Uvozite v iot.petrol.si</h3><p className="step-text">Vodni XML iz mape <code>voda</code> uvozite v modul za nalaganje računov na iot.petrol.si. Po potrebi je v »Dodatnih možnostih« na voljo ločen paket za odpadke.</p></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
