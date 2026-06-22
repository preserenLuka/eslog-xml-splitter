import { LineItem } from './types'

export type Category = 'water' | 'waste' | 'unknown'

export interface Profile {
  id: string
  name: string
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

export const builtInKomunalaNovoMesto: Profile = {
  id: 'komunala-novo-mesto',
  name: 'Komunala Novo mesto',
  waterExact: ['11211','11751','12211','12731','13211','13731','17301'],
  waterPrefixes: [],
  wasteExact: [],
  wastePrefixes: ['142','143','152','153','157'],
  waterKeywords: ['VODARINA','VODOOSKRBA','ODPADNIH VODA','ODPADNE VODE','ODP.VODE','ODVAJANJE','ČIŠČENJE','ODVAJANJE ODPADNIH VODA','ČIŠČENJE ODPADNIH VODA'],
  wasteKeywords: ['ODPADKOV','ODPADKI','ODVOZ','ODLAGANJE','OBDELAVA','KOMUNALNIH ODPADKOV','EMBALAŽA','PAPIR','BIO'],
  manualOverrides: {},
  defaultWasteTarget: null,
  filenamePrefix: null
}

export function classifyLine(line: LineItem, profile: Profile): { category: Category; reason: string } {
  // manual override by service code
  if (line.serviceCode && profile.manualOverrides[line.serviceCode]) {
    return { category: profile.manualOverrides[line.serviceCode], reason: 'manual override' }
  }

  // exact service code water
  if (line.serviceCode && profile.waterExact.includes(line.serviceCode)) {
    return { category: 'water', reason: 'exact service code match' }
  }

  // service-code prefix water
  if (line.serviceCode) {
    for (const p of profile.waterPrefixes) {
      if (line.serviceCode.startsWith(p)) return { category: 'water', reason: 'service code prefix' }
    }
  }

  // exact service code waste
  if (line.serviceCode && profile.wasteExact.includes(line.serviceCode)) {
    return { category: 'waste', reason: 'exact service code match' }
  }

  // service-code prefix waste
  if (line.serviceCode) {
    for (const p of profile.wastePrefixes) {
      if (line.serviceCode.startsWith(p)) return { category: 'waste', reason: 'service code prefix' }
    }
  }

  // description-based rules: water terms first
  const desc = (line.description || '').toUpperCase()
  for (const w of profile.waterKeywords) {
    if (desc.includes(w)) return { category: 'water', reason: 'description keyword (water)' }
  }
  for (const w of profile.wasteKeywords) {
    if (desc.includes(w)) return { category: 'waste', reason: 'description keyword (waste)' }
  }

  return { category: 'unknown', reason: 'no rule matched' }
}
