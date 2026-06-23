import React from 'react'
import { X } from 'lucide-react'

const IMG = (name: string) => `/imgs/${encodeURIComponent(name)}`

const steps: { title: string; text: React.ReactNode; images?: string[] }[] = [
  {
    title: '1. Naloži XML račune v polje za prenos',
    text: (
      <>
        Račun ali račune vode povleci v polje za prenos (ali klikni <strong>Izberi datoteke</strong>).
        Datoteke morajo biti tipa <strong>.xml</strong>. Orodje bo vsak račun parciralo in vrnilo
        do 2 XML dokumenta — enega za <strong>smeti</strong> in enega za <strong>vodo</strong>.
      </>
    ),
    images: [IMG('Dropdown-Menu.png')],
  },
  {
    title: '2. Prenesi izvožene datoteke',
    text: (
      <>
        Ko je obdelava končana, vsako datoteko preneseš posebej s klikom na <strong>Prenesi</strong>,
        ali pa vse skupaj klikneš <strong>Prenesi vse končne kot ZIP</strong> — to ustvari en ZIP arhiv
        z vsemi datotekami. Datoteke označene z rdečo so bile zavrnjene (niso XML ali so neveljavne).
      </>
    ),
    images: [IMG('HomeScreen.with many xmls parced and many dennied becouse it was pdf.png')],
  },
  {
    title: '3. Preveri šifro merilnega mesta',
    text: (
      <>
        Pri vsakem uspešno obdelanem računu klikni gumb <strong>ⓘ</strong> (levo od besede "Končano").
        Odpre se tooltip z razdelkom <strong>Merilna mesta</strong>, ki prikaže zaznano šifro za
        vodo in smeti. To šifro moraš preveriti z iot.petrol.si.
      </>
    ),
    images: [IMG('Open-Tooltip-Sucessful conversion.png')],
  },
  {
    title: '4. Preveri šifre na iot.petrol.si',
    text: (
      <>
        Na <strong>iot.petrol.si</strong> pojdi na željeno lokacijo → razdelek{' '}
        <strong>Merilna mesta</strong> → stolpec <strong>Šifre</strong>. Preveri, da se šifra iz
        tooltipa ujema s šifro na portalu za posamezen vir energije (voda / smeti).
        <br />
        <br />
        Če merilno mesto za smeti <strong>ne obstaja</strong>, ga dodate sami na portalu ali pa
        pišete nam:{' '}
        <a href="mailto:luka.preseren@novomesto.si" className="text-blue-600 underline">
          luka.preseren@novomesto.si
        </a>
      </>
    ),
    images: [IMG('iot-petrol overview page of location.png')],
  },
  {
    title: '5. Naloži račune v iot.petrol.si',
    text: (
      <>
        V iot.petrol.si odpri modul <strong>Naloži račune</strong> in vanj naloži vse pripravljene
        XML datoteke. <br />
        <br />
        <strong>Opomba:</strong> Nekatere stranke nimajo merilnega mesta za smeti — te vnesejo samo
        račun vode. Stranke z obema merilnima mestoma vnesejo oba računa.
      </>
    ),
  },
]

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col"
        style={{ width: '60vw', height: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">Navodila za uporabo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Zapri"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <p className="text-gray-600 mb-6">
            Za pravilen vnos računov vode v sistem iot.petrol.si sledite spodnjim korakom.
          </p>

          <div className="flex flex-col gap-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-gray-800 border-l-4 border-blue-500 pl-3">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{step.text}</p>
                {step.images?.map((src, j) => (
                  <img
                    key={j}
                    src={src}
                    alt={`Korak ${i + 1}`}
                    className="rounded border shadow-sm max-h-[500px] w-full object-contain"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
