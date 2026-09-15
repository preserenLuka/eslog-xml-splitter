import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createPackageStructure, useProcessor } from '../src/hooks/useProcessor'

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto })

function xmlFile(contents: string, name: string): File {
  const file = new File([contents], name, { type: 'application/xml' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(contents).buffer,
  })
  return file
}

const mixedXml = readFileSync('fixtures/realistic/komunala-mesani-anon.xml', 'utf8')
const waterXml = readFileSync('fixtures/realistic/komunala-voda-anon.xml', 'utf8')

test('processor blocks warnings, acknowledges them and invalidates acknowledgement after a line change', async () => {
  const { result } = renderHook(() => useProcessor())
  act(() => result.current.addFiles([xmlFile(mixedXml, 'mesani.xml')]))
  await waitFor(() => expect(result.current.files[0]?.status).toBe('needs_review'))
  expect(result.current.files[0].waterOutput?.gross).toBe(166.22)
  expect(result.current.waterReadyCount).toBe(0)

  act(() => result.current.acknowledgeWarnings(result.current.files[0].id))
  expect(result.current.files[0].status).toBe('ready_with_warnings')
  expect(result.current.waterReadyCount).toBe(1)

  const waterPackage = createPackageStructure(result.current.files, 'water', '2026-09-14T00:00:00.000Z')
  expect(waterPackage.outputCount).toBe(1)
  expect(Object.keys(waterPackage.structure)).toEqual(expect.arrayContaining([
    'voda/mesani_voda.xml', 'porocila/seznam.json', 'porocila/seznam.csv',
  ]))
  const report = JSON.parse(waterPackage.structure['porocila/seznam.json'] as string)
  expect(report.appVersion).toBeTruthy()
  expect(report.rulesVersion).toBeTruthy()
  expect(report.inputs).toHaveLength(1)
  expect(report.inputs[0].waterGross).toBe(166.22)
  expect(report.inputs[0].wasteGross).toBe('286.92')

  const wastePackage = createPackageStructure(result.current.files, 'waste', '2026-09-14T00:00:00.000Z')
  expect(wastePackage.outputCount).toBe(1)
  expect(Object.keys(wastePackage.structure)).toContain('odpadki/mesani_odpadki.xml')
  expect(wastePackage.structure['odpadki/mesani_odpadki.xml']).toContain('<D_1004>TEST-MESANI-001-01</D_1004>')

  const firstWater = result.current.files[0].lines.find((line) => line.category === 'water')!
  act(() => result.current.updateLineCategory(result.current.files[0].id, firstWater.internalIndex, 'excluded'))
  expect(result.current.files[0].warningsAcknowledged).toBe(false)
  expect(result.current.files[0].status).toBe('needs_review')
  expect(result.current.files[0].summaries.excluded.lineCount).toBe(1)
})

test('processor marks identical hashes as duplicates and flags both business duplicates', async () => {
  const { result } = renderHook(() => useProcessor())
  act(() => result.current.addFiles([xmlFile(waterXml, 'prvi.xml'), xmlFile(waterXml, 'kopija.xml')]))
  await waitFor(() => expect(result.current.files.every((file) => !['queued', 'processing'].includes(file.status))).toBe(true))
  expect(result.current.files.filter((file) => file.status === 'duplicate')).toHaveLength(1)
  const packageWithDuplicate = createPackageStructure(result.current.files, 'water', '2026-09-14T00:00:00.000Z')
  const duplicateReport = JSON.parse(packageWithDuplicate.structure['porocila/seznam.json'] as string)
  expect(duplicateReport.inputs).toHaveLength(2)
  expect(duplicateReport.inputs.some((input: { status: string }) => input.status === 'duplicate')).toBe(true)
  expect(packageWithDuplicate.structure['porocila/seznam.csv']).toContain('vsi_id_izdajatelja')
  expect(packageWithDuplicate.structure['porocila/seznam.csv']).toContain('merilna_mesta_neznano')

  act(() => result.current.newBatch())
  const changed = waterXml.replace('<D_0062>900000002</D_0062>', '<D_0062>900000099</D_0062>')
  act(() => result.current.addFiles([xmlFile(waterXml, 'prvi.xml'), xmlFile(changed, 'spremenjen.xml')]))
  await waitFor(() => expect(result.current.files.every((file) => !['queued', 'processing'].includes(file.status))).toBe(true))
  expect(result.current.files).toHaveLength(2)
  expect(result.current.files.every((file) => file.warnings.some((issue) => issue.code === 'BUSINESS_DUPLICATE'))).toBe(true)
  expect(result.current.files.every((file) => file.status === 'needs_review')).toBe(true)
  act(() => result.current.removeFile(result.current.files[0].id))
  expect(result.current.files).toHaveLength(1)
  expect(result.current.files[0].warnings.some((issue) => issue.code === 'BUSINESS_DUPLICATE')).toBe(false)
  expect(result.current.files[0].status).toBe('ready')
})
