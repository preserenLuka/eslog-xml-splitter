import { buildDuplicateFilename, buildOutputFilename, buildZipPath, processingReportPath } from '../src/export/outputStructure'

test('uses Slovenian output names and folders', () => {
  expect(buildOutputFilename('racun.xml', 'water')).toBe('racun_voda.xml')
  expect(buildOutputFilename('racun.xml', 'waste')).toBe('racun_odpadki.xml')
  expect(buildZipPath('water', 'racun_voda.xml')).toBe('voda/racun_voda.xml')
  expect(buildZipPath('waste', 'racun_odpadki.xml')).toBe('odpadki/racun_odpadki.xml')
  expect(processingReportPath).toBe('porocila/seznam.json')
})

test('keeps duplicate output filenames Slovenian', () => {
  expect(buildDuplicateFilename('racun_voda.xml', 2)).toBe('racun_voda_02.xml')
})
