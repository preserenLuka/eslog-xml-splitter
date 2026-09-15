import { normalizeKomunalaDescription } from '../src/eslog/descriptionNormalizer'

test.each([
  ['VODARINA - N Osnovna tarifa', 'VODARINA - N'],
  ['OMREŽNINA VODOOSKRBA - N 11731', 'OMREŽNINA VODOOSKRBA - N'],
  ['ODVAJANJE ODPADNIH VODA - N Osnovna tarifa', 'ODVAJANJE ODPADNIH VODA - N'],
  ['OMREŽNINA ODVAJANJE - N 12711', 'OMREŽNINA ODVAJANJE - N'],
  ['ČIŠČENJE ODPADNIH VODA - N Osnovna tarifa', 'ČIŠČENJE ODPADNIH VODA - N'],
  ['OMREŽNINA ČIŠČENJE - N 13711', 'OMREŽNINA ČIŠČENJE - N'],
  ['OMREŽNINA ODVAJANJE II 1-DN 25-OSTALI', 'OMREŽNINA ODVAJANJE II'],
  ['OMREŽNINA ČIŠČENJE II 1-DN 25-OSTALI', 'OMREŽNINA ČIŠČENJE II'],
  ['OMREŽNINA VODOOSKRBA II DN 25 - OSTALI', 'OMREŽNINA VODOOSKRBA II'],
  ['OKOL.DAJATEV ODP.VODE, UrL 80/12 ČN', 'OKOL.DAJATEV ODP.VODE, UrL 80/12'],
])('normalizes a changing Komunala suffix in %s', (input, expected) => {
  expect(normalizeKomunalaDescription(input)).toBe(expected)
})

test('leaves an already stable name unchanged', () => {
  expect(normalizeKomunalaDescription('ČIŠČENJE ODPADNIH VODA II OSTALI'))
    .toBe('ČIŠČENJE ODPADNIH VODA II OSTALI')
})
