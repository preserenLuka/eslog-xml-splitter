import { InvoiceParty, LineItem } from './types'

export type Category = 'water' | 'waste' | 'unknown'
export type ResolvedCategory = Category | 'excluded'

export interface Classification {
  category: Category
  reason: string
  reasonCode: 'manual' | 'service_code' | 'description' | 'conflict' | 'no_match'
}

export interface Profile {
  id: string
  name: string
  supplierIds: Record<string, string[]>
  waterExact: string[]
  waterPrefixes: string[]
  wasteExact: string[]
  wastePrefixes: string[]
  waterKeywords: string[]
  wasteKeywords: string[]
  manualOverrides: Record<string, Category>
  defaultWasteTarget?: string | null
  filenamePrefix?: string | null
}

export const RULESET_VERSION = '3'

export const builtInKomunalaNovoMesto: Profile = {
  id: 'komunala-novo-mesto',
  name: 'Komunala Novo mesto',
  supplierIds: { VA: ['SI13503766'], '0199': ['5073120000'] },
  waterExact: [
    '11021', '11211', '11731', '11751', '12021', '12211', '12711', '12731',
    '12911', '13021', '13211', '13711', '13731', '13911', '17301', '9991971',
  ],
  waterPrefixes: [],
  wasteExact: [],
  wastePrefixes: ['142', '143', '152', '153', '157'],
  waterKeywords: [
    'VODARINA', 'VODOOSKRBA', 'OMREŽNINA VODOVOD', 'VODNO POVRAČILO',
    'ODVAJANJE ODPADNIH VODA', 'ČIŠČENJE ODPADNIH VODA', 'OMREŽNINA ODVAJANJE',
    'OMREŽNINA ČIŠČENJE', 'OKOL.DAJATEV ODP.VODE', 'ODPADNE VODE', 'ODP.VODE',
  ],
  wasteKeywords: [
    'ODVOZ', 'ODLAGANJE', 'OBDELAVA ODPADKOV', 'KOMUNALNI ODPADKI',
    'BIOLOŠKI ODPADKI', 'BIO ODPADKI', 'EMBALAŽA', 'PAPIR', 'STEKLO',
    'ZABOJNIK', 'ODPADKE', 'ODPADKOV',
  ],
  manualOverrides: {},
  defaultWasteTarget: null,
  filenamePrefix: null,
}

export function supportsSupplier(party: InvoiceParty | undefined, profile: Profile): boolean {
  if (!party) return false
  return Object.entries(profile.supplierIds).some(([qualifier, allowed]) => {
    const actual = party.identifiers[qualifier]
    return Boolean(actual && allowed.includes(actual))
  })
}

export function classifyLine(
  line: LineItem,
  profile: Profile,
  manualCategory?: Category,
): Classification {
  if (manualCategory) return { category: manualCategory, reason: 'Ročna izbira za ta račun', reasonCode: 'manual' }
  if (line.serviceCode && profile.manualOverrides[line.serviceCode]) {
    return { category: profile.manualOverrides[line.serviceCode], reason: 'Ročna nastavitev profila', reasonCode: 'manual' }
  }
  if (line.serviceCode && profile.waterExact.includes(line.serviceCode)) {
    return { category: 'water', reason: 'Potrjena vodna šifra', reasonCode: 'service_code' }
  }
  if (line.serviceCode && profile.waterPrefixes.some((prefix) => line.serviceCode!.startsWith(prefix))) {
    return { category: 'water', reason: 'Predpona vodne šifre', reasonCode: 'service_code' }
  }
  if (line.serviceCode && profile.wasteExact.includes(line.serviceCode)) {
    return { category: 'waste', reason: 'Potrjena šifra odpadkov', reasonCode: 'service_code' }
  }
  if (line.serviceCode && profile.wastePrefixes.some((prefix) => line.serviceCode!.startsWith(prefix))) {
    return { category: 'waste', reason: 'Predpona šifre odpadkov', reasonCode: 'service_code' }
  }

  const description = (line.description || '').toUpperCase().replace(/\s+/g, ' ')
  const water = profile.waterKeywords.some((keyword) => description.includes(keyword))
  const waste = profile.wasteKeywords.some((keyword) => description.includes(keyword))
  if (water && waste) return { category: 'unknown', reason: 'Opis vsebuje vodne in odpadkovne izraze', reasonCode: 'conflict' }
  if (water) return { category: 'water', reason: 'Prepoznan vodni opis', reasonCode: 'description' }
  if (waste) return { category: 'waste', reason: 'Prepoznan opis odpadkov', reasonCode: 'description' }
  return { category: 'unknown', reason: 'Ni ujemajočega pravila', reasonCode: 'no_match' }
}
