import { fireEvent, render, screen } from '@testing-library/react'
import HelpModal from '../src/components/HelpModal'
import FileCard from '../src/components/FileCard'
import { FileEntry } from '../src/hooks/useProcessor'

const summary = (lineCount = 0, gross = '0.00') => ({ lineCount, net: gross, vat: '0.00', gross })

function reviewEntry(): FileEntry {
  return {
    id: '1', name: 'test.xml', status: 'needs_review', invoiceNumber: 'R-1',
    errors: [], staticWarnings: [], warningsAcknowledged: false,
    warnings: [{ code: 'UNKNOWN_LINES', severity: 'warning', message: 'Postavka ni razvrščena.' }],
    lines: [{
      internalIndex: 0, lineId: '1', serviceCode: 'X', description: 'Neznana storitev',
      net: '10.00', vat: '0.95', gross: '10.95', category: 'unknown', automaticCategory: 'unknown',
      reason: 'Ni ujemajočega pravila', manual: false, meterReferences: [],
    }],
    summaries: { water: summary(), waste: summary(), unknown: summary(1, '10.95'), excluded: summary() },
    meterReferences: { water: [], waste: [], unknown: [] },
  }
}

test('help is an accessible dialog, receives focus and closes with Escape', () => {
  const onClose = vi.fn()
  render(<HelpModal onClose={onClose} />)
  const dialog = screen.getByRole('dialog')
  expect(dialog.getAttribute('aria-modal')).toBe('true')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zapri navodila' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledOnce()
})

test('invoice review exposes manual categories and a consequence confirmation', () => {
  const onCategoryChange = vi.fn()
  const onAcknowledge = vi.fn()
  render(<FileCard file={reviewEntry()} onCategoryChange={onCategoryChange} onAcknowledge={onAcknowledge} onRemove={vi.fn()} onDownload={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Preglej postavke (1)' }))
  fireEvent.change(screen.getByLabelText('Kategorija za postavko Neznana storitev'), { target: { value: 'water' } })
  expect(onCategoryChange).toHaveBeenCalledWith('1', 0, 'water')

  fireEvent.click(screen.getByRole('button', { name: 'Nadaljuj kljub opozorilom' }))
  expect(screen.getByText(/Neznane in namerno izpuščene postavke ne bodo vključene/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Potrdi in nadaljuj' }))
  expect(onAcknowledge).toHaveBeenCalledWith('1')
})
